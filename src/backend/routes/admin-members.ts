import express, { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  authenticateJWT,
  loadAdminContext,
  requireSuperAdmin,
  requirePermission,
  requireRegionScope,
} from '../middleware.js';
import { query, mapRow, dbOperations } from '../database.js';
import { emailService } from '../../services/emailService.js';
import { afroSmsService } from '../../services/afroSmsService.js';
import { exportService } from '../../services/exportService.js';
import { PRIVATE_UPLOAD_PATH } from '../../config/multer.js';

export const adminMembersRouter = express.Router();

// Auth chain reused by every admin-members route
const adminAuthChain = [authenticateJWT, loadAdminContext];

// Helper to normalize phone numbers
function normalizeEthiopianPhone(phone: string): string {
  let clean = phone.replace(/[^0-9+]/g, '');
  if (clean.startsWith('09')) clean = '+251' + clean.slice(1);
  else if (clean.startsWith('07')) clean = '+251' + clean.slice(1);
  else if (clean.startsWith('9') && clean.length === 9) clean = '+251' + clean;
  else if (clean.startsWith('7') && clean.length === 9) clean = '+251' + clean;
  else if (clean.startsWith('251')) clean = '+' + clean;
  return clean;
}

/* ==========================================================================
   GET /admin/members — paginated, filterable list
   ========================================================================== */
adminMembersRouter.get(
  '/admin/members',
  adminAuthChain,
  requirePermission('members'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const result = await dbOperations.getMembers({
      q: req.query.q as string,
      registrationStatus: req.query.registrationStatus as string,
      membershipStatus: req.query.membershipStatus as string,
      gender: req.query.gender as string,
      sectorId: req.query.sectorId as string,
      fieldId: req.query.fieldId as string,
      regionId: req.query.regionId as string,
      occupationType: req.query.occupationType as string,
      graduationLevelId: req.query.graduationLevelId as string,
      paid: req.query.paid === 'true' ? true : req.query.paid === 'false' ? false : undefined,
      period: req.query.period as string,
      createdFrom: req.query.createdFrom as string,
      createdTo: req.query.createdTo as string,
      page: parseInt(String(req.query.page || '1'), 10),
      pageSize: parseInt(String(req.query.pageSize || '20'), 10),
      sort: req.query.sort as string,
    });

    return res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  }
);

/* ==========================================================================
   GET /admin/registrations/pending-count — sidebar badge number
   ========================================================================== */
adminMembersRouter.get(
  '/admin/registrations/pending-count',
  adminAuthChain,
  requirePermission('members'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const regionId = req.query.regionId as string;
    const cond = regionId
      ? "WHERE registration_status = 'pending' AND region_id = $1"
      : "WHERE registration_status = 'pending'";
    const params = regionId ? [regionId] : [];
    const resCount = await query(`SELECT count(*) as count FROM members ${cond}`, params);
    return res.json({ success: true, data: { pendingCount: parseInt(resCount.rows[0].count, 10) } });
  }
);

/* ==========================================================================
   GET /admin/registrations — legacy raw registrations table list
   ========================================================================== */
adminMembersRouter.get(
  '/admin/registrations',
  adminAuthChain,
  requirePermission('members'),
  async (req: Request, res: Response) => {
    const status = req.query.status as string;
    const phone = req.query.phone as string;
    let sql = 'SELECT * FROM registrations';
    const conditions: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (phone) {
      params.push(phone);
      conditions.push(`phone = $${params.length}`);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const result = await query(sql, params);
    return res.json({ success: true, data: result.rows.map(mapRow) });
  }
);

/* ==========================================================================
   GET /admin/registrations/:id — legacy raw registration detail
   ========================================================================== */
adminMembersRouter.get(
  '/admin/registrations/:id',
  adminAuthChain,
  requirePermission('members'),
  async (req: Request, res: Response) => {
    const result = await query('SELECT * FROM registrations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Registration not found' });
    }
    return res.json({ success: true, data: mapRow(result.rows[0]) });
  }
);

/* ==========================================================================
   GET /admin/members/:id/payments
   ⚠️ MUST be registered BEFORE /admin/members/:id
   (otherwise Express treats "payments" as a member id and returns 404)
   ========================================================================== */
adminMembersRouter.get(
  '/admin/members/:id/payments',
  adminAuthChain,
  requirePermission('members'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const member = await dbOperations.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    if (req.admin?.role === 'RegionalAdmin' && member.regionId !== req.admin.regionId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Member outside your regional jurisdiction.' });
    }
    const result = await query(
      'SELECT * FROM payments WHERE member_id = $1 ORDER BY paid_at DESC',
      [req.params.id]
    );
    return res.json({ success: true, data: result.rows.map(mapRow) });
  }
);

/* ==========================================================================
   GET /admin/members/:id — full member profile with documents + payments
   ========================================================================== */
adminMembersRouter.get(
  '/admin/members/:id',
  adminAuthChain,
  requirePermission('members'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const member = await dbOperations.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    if (req.admin?.role === 'RegionalAdmin' && member.regionId !== req.admin.regionId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Member outside your regional jurisdiction.' });
    }

    const [documents, payments] = await Promise.all([
      dbOperations.getMemberDocuments(member.id),
      query('SELECT * FROM payments WHERE member_id = $1 ORDER BY paid_at DESC', [member.id]),
    ]);

    return res.json({
      success: true,
      data: {
        ...member,
        documents,
        payments: payments.rows.map(mapRow),
      },
    });
  }
);

/* ==========================================================================
   PUT /admin/members/:id — update member profile
   ========================================================================== */
adminMembersRouter.put(
  '/admin/members/:id',
  adminAuthChain,
  requirePermission('members.edit'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const existing = await dbOperations.getMemberById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Member not found' });

    if (req.admin?.role === 'RegionalAdmin' && existing.regionId !== req.admin.regionId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const b = req.body;
    const resUpdate = await query(
      `UPDATE members SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        organization_name = COALESCE($4, organization_name),
        job_title = COALESCE($5, job_title),
        town = COALESCE($6, town),
        professional_category = COALESCE($7, professional_category),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [b.fullName, b.phone, b.email, b.organizationName, b.jobTitle, b.town, b.professionalCategory, req.params.id]
    );

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: 'member.edit',
      entity: 'members',
      entityId: req.params.id,
      before: existing,
      after: resUpdate.rows[0],
      ip: req.ip,
    });

    return res.json({ success: true, data: mapRow(resUpdate.rows[0]) });
  }
);

/* ==========================================================================
   PATCH /admin/members/:id/status — activate / deactivate / pending
   ========================================================================== */
adminMembersRouter.patch(
  '/admin/members/:id/status',
  adminAuthChain,
  requirePermission('members.edit'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const { membershipStatus } = req.body;
    if (!['active', 'inactive', 'pending'].includes(membershipStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid membership status' });
    }

    const member = await dbOperations.getMemberById(req.params.id);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    if (req.admin?.role === 'RegionalAdmin' && member.regionId !== req.admin.regionId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const updated = await dbOperations.updateMemberStatus(req.params.id, membershipStatus);

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: 'member.status_change',
      entity: 'members',
      entityId: req.params.id,
      before: { membershipStatus: member.membershipStatus },
      after: { membershipStatus },
      ip: req.ip,
    });

    return res.json({ success: true, data: updated });
  }
);

/* ==========================================================================
   POST /admin/members/:id/approve — approve a pending member
   ========================================================================== */
adminMembersRouter.post(
  '/admin/members/:id/approve',
  adminAuthChain,
  requirePermission('members.approve'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const member = await dbOperations.getMemberById(req.params.id);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    if (req.admin?.role === 'RegionalAdmin' && member.regionId !== req.admin.regionId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const approved = await dbOperations.approveMember(req.params.id, req.admin!.fullName);

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: 'member.approve',
      entity: 'members',
      entityId: req.params.id,
      ip: req.ip,
    });

    emailService.sendApprovalEmail(approved.email, approved.fullName, approved.memberNo, approved.preferredLanguage);
    if (process.env.FEATURE_SMS === 'true') {
      afroSmsService.sendSms(
        approved.phone,
        `OHPEA: Congratulations ${approved.fullName}! Your membership application (#${approved.memberNo}) is approved.`
      );
    }

    return res.json({ success: true, data: approved });
  }
);

/* ==========================================================================
   POST /admin/members/:id/reject — reject with reason
   ========================================================================== */
adminMembersRouter.post(
  '/admin/members/:id/reject',
  adminAuthChain,
  requirePermission('members.approve'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }

    const member = await dbOperations.getMemberById(req.params.id);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    if (req.admin?.role === 'RegionalAdmin' && member.regionId !== req.admin.regionId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const rejected = await dbOperations.rejectMember(req.params.id, reason.trim());

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: 'member.reject',
      entity: 'members',
      entityId: req.params.id,
      before: { reason },
      ip: req.ip,
    });

    emailService.sendRejectionEmail(rejected.email, rejected.fullName, reason, rejected.preferredLanguage);

    return res.json({ success: true, data: rejected });
  }
);

/* ==========================================================================
   DELETE /admin/members/:id — SuperAdmin soft delete (deactivate)
   ========================================================================== */
adminMembersRouter.delete(
  '/admin/members/:id',
  adminAuthChain,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const member = await dbOperations.getMemberById(req.params.id);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    await dbOperations.updateMemberStatus(req.params.id, 'inactive');
    await query(
      "UPDATE members SET registration_status = 'rejected', rejection_reason = 'Deactivated by SuperAdmin' WHERE id = $1",
      [req.params.id]
    );

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: 'member.delete',
      entity: 'members',
      entityId: req.params.id,
      ip: req.ip,
    });

    return res.json({ success: true, message: 'Member deactivated successfully.' });
  }
);

/* ==========================================================================
   POST /admin/members — admin creates a member manually
   ========================================================================== */
adminMembersRouter.post(
  '/admin/members',
  adminAuthChain,
  requirePermission('members.edit'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const b = req.body;
    const memberNo = await dbOperations.getNextMemberNumber();
    const pepper = process.env.SERVER_PEPPER || 'ohpea_pepper_2026';
    const idHash = crypto
      .createHash('sha256')
      .update(`${b.idType || 'fayda'}:${(b.idNumber || '0000').trim()}:${pepper}`)
      .digest('hex');

    const member = await dbOperations.createMember({
      memberNo,
      fullName: b.fullName,
      phone: normalizeEthiopianPhone(b.phone),
      email: b.email,
      gender: b.gender,
      dateOfBirth: b.dateOfBirth,
      graduationLevelId: b.graduationLevelId,
      occupationType: b.occupationType,
      sectorId: b.sectorId,
      fieldOfStudyId: b.fieldOfStudyId,
      professionalCategory: b.professionalCategory,
      organizationName: b.organizationName,
      jobTitle: b.jobTitle,
      regionId: req.admin?.role === 'RegionalAdmin' ? req.admin.regionId : b.regionId,
      town: b.town,
      idType: b.idType || 'fayda',
      idNumberHash: idHash,
      idNumberLast4: (b.idNumber || '0000').slice(-4),
      registrationStatus: 'approved',
      membershipStatus: 'active',
      approvedBy: req.admin?.fullName,
      source: 'admin',
    });

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: 'member.create_admin',
      entity: 'members',
      entityId: member.id,
      ip: req.ip,
    });

    return res.status(201).json({ success: true, data: member });
  }
);

/* ==========================================================================
   GET /admin/members/export — Excel or PDF
   ⚠️ MUST be registered BEFORE /admin/members/:id
   ========================================================================== */
adminMembersRouter.get(
  '/admin/members/export',
  adminAuthChain,
  requirePermission('members.export'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const format = (req.query.format as string) === 'pdf' ? 'pdf' : 'xlsx';
    const membersData = await dbOperations.getMembers({
      q: req.query.q as string,
      registrationStatus: req.query.registrationStatus as string,
      membershipStatus: req.query.membershipStatus as string,
      regionId: req.query.regionId as string,
      sectorId: req.query.sectorId as string,
      pageSize: 500,
    });

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: `member.export_${format}`,
      entity: 'members',
      ip: req.ip,
    });

    if (format === 'pdf') {
      const buffer = await exportService.exportMembersToPdf(membersData.items);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="ohpea-members.pdf"');
      return res.send(buffer);
    } else {
      const buffer = await exportService.exportMembersToExcel(membersData.items);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="ohpea-members.xlsx"');
      return res.send(buffer);
    }
  }
);

/* ==========================================================================
   GET /admin/members/:id/documents/:docId — secure file streaming
   ========================================================================== */
adminMembersRouter.get(
  '/admin/members/:id/documents/:docId',
  adminAuthChain,
  requirePermission('members'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const doc = await dbOperations.getMemberDocumentById(req.params.id, req.params.docId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const filePath = path.join(PRIVATE_UPLOAD_PATH, 'members', req.params.id, doc.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File missing from private storage' });
    }

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: 'document.view',
      entity: 'member_documents',
      entityId: doc.id,
      ip: req.ip,
    });

    res.setHeader('Content-Type', doc.mime);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    const stream = fs.createReadStream(path.resolve(filePath));
    return stream.pipe(res);
  }
);