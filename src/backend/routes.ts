/**
 * OPHEA REST API Routes
 * Implements Auth, Public, Admin Member Management, Payments, Content CMS, SMS, and Dashboard endpoints.
 */

import { adminContentRouter } from './adminContentRoutes.js';
import { toAdminUserDto, getLang, loadPaymentInfo, toMemberSummaryDto, toMemberDetailDto, normalizeMemberBody, toPaymentDto, toRecentActivityDto } from './adminDto.js';
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  authenticateJWT,
  loadAdminContext,
  requireSuperAdmin,
  requirePermission,
  requireRegionScope,
  customRateLimiter,
  validateBody,
  getJwtSecret,
} from './middleware.js';

import { query, mapRow, dbOperations, hashIdNumber } from './database.js';
import { statsService } from '../services/statsService.js';
import { emailService } from '../services/emailService.js';
import { afroSmsService } from '../services/afroSmsService.js';
import { otpService } from '../services/otpService.js';
import { exportService } from '../services/exportService.js';
import { smsCampaignService } from '../services/smsCampaignService.js';
import { translations, t } from '../translations.js';
import { memberRegistrationUpload, calculateFileHash, PRIVATE_UPLOAD_PATH } from '../config/multer.js';
import { SupportedLanguage } from '../types.js';

export const apiRouter = express.Router();

// Helper to normalize phone numbers to +2519... or +2517...
function normalizeEthiopianPhone(phone: string): string {
  let clean = phone.replace(/[^0-9+]/g, '');
  if (clean.startsWith('09')) clean = '+251' + clean.slice(1);
  else if (clean.startsWith('07')) clean = '+251' + clean.slice(1);
  else if (clean.startsWith('9') && clean.length === 9) clean = '+251' + clean;
  else if (clean.startsWith('7') && clean.length === 9) clean = '+251' + clean;
  else if (clean.startsWith('251')) clean = '+' + clean;
  return clean;
}

// Global API rate limiter: 300 per 15 min
apiRouter.use(
  customRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'Global API rate limit exceeded. Please wait a few moments.',
  })
);

async function loadAdminUserDto(id: string, lang: any) {
  const r = await query(
    'SELECT u.*, r.name AS region_name FROM admin_users u LEFT JOIN regions r ON u.region_id = r.id WHERE u.id = $1',
    [id]
  );
  return r.rows[0] ? toAdminUserDto(mapRow(r.rows[0]), lang) : null;
}

/* ==========================================================================
   1. AUTHENTICATION ROUTES
   ========================================================================== */

const loginSchema = z.object({
  usernameOrEmail: z.string().min(3),
  password: z.string().min(6),
});

const loginRateLimiter = customRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  keyGenerator: (req) => `login:${req.ip || '127.0.0.1'}`,
});

// POST /auth/login & alias /admin/login
const handleLogin = async (req: Request, res: Response) => {
  const { usernameOrEmail, password } = req.body;
  const admin = await dbOperations.getAdminByUsernameOrEmail(usernameOrEmail);

  if (!admin) {
    await dbOperations.createAuditLog({
      action: 'auth.login_failed',
      entity: 'admin_users',
      before: { identifier: usernameOrEmail },
      ip: req.ip,
    });
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  if (!admin.isActive) {
    return res.status(403).json({ success: false, error: 'Your administrator account has been deactivated.' });
  }

  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) {
    await dbOperations.createAuditLog({
      adminId: admin.id,
      action: 'auth.login_failed_password',
      entity: 'admin_users',
      entityId: admin.id,
      ip: req.ip,
    });
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  await dbOperations.updateAdminLastLogin(admin.id);

  const tokenPayload = {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    permissions: admin.permissions || [],
    regionId: admin.regionId,
  };

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: expiresIn as any });

  await dbOperations.createAuditLog({
    adminId: admin.id,
    action: 'auth.login_success',
    entity: 'admin_users',
    entityId: admin.id,
    ip: req.ip,
  });

  return res.json({
    success: true,
    data: {
      token,
      user: await loadAdminUserDto(admin.id, getLang(req)),
    },
  });
};

apiRouter.post('/auth/login', loginRateLimiter, validateBody(loginSchema), handleLogin);
apiRouter.post('/admin/login', loginRateLimiter, validateBody(loginSchema), handleLogin);

// GET /auth/me
apiRouter.get('/auth/me', authenticateJWT, loadAdminContext, async (req: Request, res: Response) => {
  return res.json({ success: true, data: await loadAdminUserDto(req.admin!.id, getLang(req)) });
});

// POST /auth/change-password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

apiRouter.post(
  '/auth/change-password',
  authenticateJWT,
  loadAdminContext,
  validateBody(changePasswordSchema),
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const admin = await dbOperations.getAdminById(req.admin!.id);

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password does not match' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await dbOperations.changeAdminPassword(admin.id, newHash);

    await dbOperations.createAuditLog({
      adminId: admin.id,
      action: 'auth.password_changed',
      entity: 'admin_users',
      entityId: admin.id,
      ip: req.ip,
    });

    return res.json({ success: true, message: 'Password changed successfully' });
  }
);

// POST /auth/logout
apiRouter.post('/auth/logout', authenticateJWT, async (req: Request, res: Response) => {
  if (req.user) {
    await dbOperations.createAuditLog({
      adminId: req.user.id,
      action: 'auth.logout',
      entity: 'admin_users',
      entityId: req.user.id,
      ip: req.ip,
    });
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

/* ==========================================================================
   3. ADMIN: MEMBERS MANAGEMENT
   ========================================================================== */

const adminAuthChain = [authenticateJWT, loadAdminContext];

function memberFilters(req: Request) {
  const q = req.query;
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return {
    q: s(q.q),
    registrationStatus: s(q.registrationStatus),
    membershipStatus: s(q.membershipStatus),
    gender: s(q.gender),
    sectorId: s(q.sectorId),
    fieldId: s(q.fieldId),
    regionId: s(q.regionId),
    occupationType: s(q.occupationType),
    graduationLevelId: s(q.graduationLevelId),
    paid: q.paid === 'true' ? true : q.paid === 'false' ? false : undefined,
    createdFrom: s(q.createdFrom),
    createdTo: s(q.createdTo),
  };
}

function outsideRegion(req: Request, member: any) {
  return req.admin?.role === 'RegionalAdmin' && member.regionId !== req.admin.regionId;
}

async function memberDetail(id: string, lang: any) {
  const member = await dbOperations.getMemberById(id);
  if (!member) return null;
  const [docs, info] = await Promise.all([dbOperations.getMemberDocuments(id), loadPaymentInfo([id])]);
  return toMemberDetailDto(member, docs, lang, info[id]);
}

function validateMemberBody(b: ReturnType<typeof normalizeMemberBody>, creating: boolean) {
  const errors: Record<string, string> = {};
  if (creating) {
    for (const k of ['fullName', 'phone', 'email', 'gender', 'graduationLevelId', 'occupationType', 'sectorId', 'fieldOfStudyId', 'regionId', 'idType', 'idNumber'] as const) {
      if (!b[k]) errors[k] = 'Required';
    }
  }
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) errors.email = 'Invalid email address';
  if (b.gender && !['male', 'female', 'unspecified'].includes(b.gender)) errors.gender = 'Must be male, female or unspecified';
  if (b.occupationType && !['private', 'government', 'other'].includes(b.occupationType)) errors.occupationType = 'Invalid occupation type';
  if (b.idType && !['fayda', 'passport', 'kebele', 'driver'].includes(b.idType)) errors.idType = 'Invalid ID type';
  if (b.phone) {
    const p = normalizeEthiopianPhone(b.phone);
    if (!/^\+251[79]\d{8}$/.test(p)) errors.phone = 'Enter a valid Ethiopian mobile number';
  }
  return errors;
}

// GET /admin/members
apiRouter.get('/admin/members', adminAuthChain, requirePermission('members'), requireRegionScope, async (req: Request, res: Response) => {
  const lang = getLang(req);
  const result = await dbOperations.getMembers({
    ...memberFilters(req),
    page: parseInt(String(req.query.page || '1'), 10),
    pageSize: parseInt(String(req.query.pageSize || '20'), 10),
    sort: req.query.sort as string,
  });
  const info = await loadPaymentInfo(result.items.map((m: any) => m.id));
  return res.json({
    success: true,
    data: result.items.map((m: any) => toMemberSummaryDto(m, lang, info[m.id])),
    meta: result.meta,
  });
});

// GET /admin/registrations/pending-count
apiRouter.get('/admin/registrations/pending-count', adminAuthChain, requirePermission('members'), requireRegionScope, async (req: Request, res: Response) => {
  const regionId = req.query.regionId as string;
  const cond = regionId ? "WHERE registration_status = 'pending' AND region_id = $1" : "WHERE registration_status = 'pending'";
  const resCount = await query(`SELECT count(*) as count FROM members ${cond}`, regionId ? [regionId] : []);
  return res.json({ success: true, data: { pendingCount: parseInt(resCount.rows[0].count, 10) || 0 } });
});

// GET /admin/members/export  (must stay above /admin/members/:id)
apiRouter.get('/admin/members/export', adminAuthChain, requirePermission('members.export'), requireRegionScope, async (req: Request, res: Response) => {
  const format = (req.query.format as string) === 'pdf' ? 'pdf' : 'xlsx';
  const data = await dbOperations.getMembers({ ...memberFilters(req), pageSize: 100, page: 1 });
  let items = data.items;
  for (let page = 2; page <= (data.meta?.totalPages || 1) && page <= 50; page++) {
    const more = await dbOperations.getMembers({ ...memberFilters(req), pageSize: 100, page });
    items = items.concat(more.items);
  }

  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: `member.export_${format}`, entity: 'members', ip: req.ip });

  if (format === 'pdf') {
    const buffer = await exportService.exportMembersToPdf(items);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="ophea-members.pdf"');
    return res.send(buffer);
  }
  const buffer = await exportService.exportMembersToExcel(items);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ophea-members.xlsx"');
  return res.send(buffer);
});

// POST /admin/members (admin creates an approved member directly)
apiRouter.post('/admin/members', adminAuthChain, requirePermission('members.edit'), requireRegionScope, async (req: Request, res: Response) => {
  const b = normalizeMemberBody(req.body || {});
  if (req.admin?.role === 'RegionalAdmin') b.regionId = req.admin.regionId || b.regionId;
  const errors = validateMemberBody(b, true);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, error: 'Please fix the highlighted fields', fields: errors });
  }

  const phone = normalizeEthiopianPhone(b.phone!);
  const dup = await dbOperations.checkDuplicateMember(phone, b.email!, b.idType!, b.idNumber!);
  if (dup) {
    return res.status(409).json({ success: false, error: 'A member with this phone, email or ID number already exists', fields: { phone: 'Possible duplicate' } });
  }

  const created = await dbOperations.createMember({
    memberNo: await dbOperations.getNextMemberNumber(),
    ...b,
    phone,
    idNumberHash: hashIdNumber(b.idType!, b.idNumber!),
    idNumberLast4: b.idNumber!.slice(-4),
    registrationStatus: 'pending',
    membershipStatus: 'pending',
    source: 'admin',
  });
  await dbOperations.approveMember(created.id, req.admin!.fullName);
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: 'member.create_admin', entity: 'members', entityId: created.id, ip: req.ip });
  return res.status(201).json({ success: true, data: await memberDetail(created.id, getLang(req)) });
});

// GET /admin/members/:id
apiRouter.get('/admin/members/:id', adminAuthChain, requirePermission('members'), requireRegionScope, async (req: Request, res: Response) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: 'Forbidden: Member outside your regional jurisdiction.' });
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});

// GET /admin/members/:id/payments
apiRouter.get('/admin/members/:id/payments', adminAuthChain, requirePermission('payments'), requireRegionScope, async (req: Request, res: Response) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: 'Forbidden' });
  const rows = await query(
    `SELECT p.*, m.full_name AS member_name, m.member_no FROM payments p LEFT JOIN members m ON p.member_id = m.id
     WHERE p.member_id = $1 ORDER BY p.paid_at DESC`,
    [req.params.id]
  );
  return res.json({ success: true, data: rows.rows.map(mapRow).map((r: any) => toPaymentDto(r, getLang(req))) });
});

// PUT /admin/members/:id
apiRouter.put('/admin/members/:id', adminAuthChain, requirePermission('members.edit'), requireRegionScope, async (req: Request, res: Response) => {
  const existing = await dbOperations.getMemberById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Member not found' });
  if (outsideRegion(req, existing)) return res.status(403).json({ success: false, error: 'Forbidden' });

  const b = normalizeMemberBody(req.body || {});
  if (req.admin?.role === 'RegionalAdmin') b.regionId = existing.regionId;
  const errors = validateMemberBody(b, false);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, error: 'Please fix the highlighted fields', fields: errors });
  }

  const phone = b.phone ? normalizeEthiopianPhone(b.phone) : undefined;
  if (phone || b.email) {
    const clash = await query(
      'SELECT id FROM members WHERE id <> $1 AND (($2::text IS NOT NULL AND phone = $2) OR ($3::text IS NOT NULL AND LOWER(email) = $3))',
      [req.params.id, phone ?? null, b.email ? b.email.toLowerCase() : null]
    );
    if (clash.rows.length) {
      return res.status(409).json({ success: false, error: 'Another member already uses this phone or email', fields: { phone: 'Already in use' } });
    }
  }

  const cols: Record<string, any> = {
    full_name: b.fullName,
    phone,
    email: b.email ? b.email.toLowerCase() : undefined,
    gender: b.gender,
    date_of_birth: b.dateOfBirth,
    graduation_level_id: b.graduationLevelId,
    occupation_type: b.occupationType,
    sector_id: b.sectorId,
    field_of_study_id: b.fieldOfStudyId,
    professional_category: b.professionalCategory,
    organization_name: b.organizationName,
    job_title: b.jobTitle,
    region_id: b.regionId,
    town: b.town,
    id_type: b.idType,
    preferred_language: b.preferredLanguage,
    membership_category: b.membershipCategory,
    nationality: b.nationality,
    emergency_contact_name: b.emergencyContactName,
    emergency_contact_phone: b.emergencyContactPhone,
    business_tin: b.businessTin,
    skills: b.skills,
    expertise_areas: b.expertiseAreas,
    interests: b.interests,
  };
  if (b.idNumber && !b.idNumber.startsWith('••')) {
    cols.id_number_hash = hashIdNumber(b.idType || existing.idType, b.idNumber);
    cols.id_number_last4 = b.idNumber.slice(-4);
  }
  const keys = Object.keys(cols).filter((k) => cols[k] !== undefined);
  if (keys.length) {
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await query(`UPDATE members SET ${sets}, updated_at = NOW() WHERE id = $${keys.length + 1}`, [...keys.map((k) => cols[k]), req.params.id]);
  }

  await dbOperations.createAuditLog({
    adminId: req.admin?.id,
    action: 'member.edit',
    entity: 'members',
    entityId: req.params.id,
    after: Object.fromEntries(keys.filter((k) => !k.startsWith('id_number')).map((k) => [k, cols[k]])),
    ip: req.ip,
  });
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});

// PATCH /admin/members/:id/status
apiRouter.patch('/admin/members/:id/status', adminAuthChain, requirePermission('members.edit'), requireRegionScope, async (req: Request, res: Response) => {
  const { membershipStatus } = req.body || {};
  if (!['active', 'inactive', 'pending'].includes(membershipStatus)) {
    return res.status(400).json({ success: false, error: 'Invalid membership status', fields: { membershipStatus: 'Must be active, inactive or pending' } });
  }
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: 'Forbidden' });

  await dbOperations.updateMemberStatus(req.params.id, membershipStatus);
  await dbOperations.createAuditLog({
    adminId: req.admin?.id,
    action: 'member.status_change',
    entity: 'members',
    entityId: req.params.id,
    before: { membershipStatus: member.membershipStatus },
    after: { membershipStatus },
    ip: req.ip,
  });
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});

// POST /admin/members/:id/approve
apiRouter.post('/admin/members/:id/approve', adminAuthChain, requirePermission('members.approve'), requireRegionScope, async (req: Request, res: Response) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: 'Forbidden' });

  const approved = await dbOperations.approveMember(req.params.id, req.admin!.fullName);
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: 'member.approve', entity: 'members', entityId: req.params.id, ip: req.ip });

  emailService.sendApprovalEmail(approved.email, approved.fullName, approved.memberNo, approved.preferredLanguage);
  if (process.env.FEATURE_SMS === 'true') {
    afroSmsService.sendSms(approved.phone, `OPHEA: Congratulations ${approved.fullName}! Your membership application (#${approved.memberNo}) is approved.`);
  }
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});

// POST /admin/members/:id/reject
apiRouter.post('/admin/members/:id/reject', adminAuthChain, requirePermission('members.approve'), requireRegionScope, async (req: Request, res: Response) => {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ success: false, error: 'Rejection reason is required', fields: { reason: 'Required' } });

  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: 'Forbidden' });

  const rejected = await dbOperations.rejectMember(req.params.id, reason);
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: 'member.reject', entity: 'members', entityId: req.params.id, before: { reason }, ip: req.ip });
  emailService.sendRejectionEmail(rejected.email, rejected.fullName, reason, rejected.preferredLanguage);
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});

// DELETE /admin/members/:id (SuperAdmin soft delete)
apiRouter.delete('/admin/members/:id', adminAuthChain, requireSuperAdmin, async (req: Request, res: Response) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
  await query(
    "UPDATE members SET membership_status = 'inactive', registration_status = 'rejected', rejection_reason = 'Deactivated by SuperAdmin', updated_at = NOW() WHERE id = $1",
    [req.params.id]
  );
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: 'member.delete', entity: 'members', entityId: req.params.id, ip: req.ip });
  return res.json({ success: true, data: { success: true } });
});

// GET /admin/members/:id/documents/:docId (private streaming, audited)
apiRouter.get('/admin/members/:id/documents/:docId', adminAuthChain, requirePermission('members'), requireRegionScope, async (req: Request, res: Response) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: 'Forbidden' });

  const doc = await dbOperations.getMemberDocumentById(req.params.id, req.params.docId);
  if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });

  const filePath = path.join(PRIVATE_UPLOAD_PATH, 'members', req.params.id, doc.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'File missing from private storage' });

  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: 'document.view', entity: 'member_documents', entityId: doc.id, ip: req.ip });
  res.setHeader('Content-Type', doc.mime);
  res.setHeader('Content-Disposition', `inline; filename="${String(doc.originalName).replace(/"/g, '')}"`);
  return fs.createReadStream(path.resolve(filePath)).pipe(res);
});

/* ==========================================================================
   4. ADMIN: DASHBOARD METRICS
   ========================================================================== */

// GET /admin/dashboard/summary
apiRouter.get(
  '/admin/dashboard/summary',
  adminAuthChain,
  requirePermission('dashboard'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const regionId = req.admin?.role === 'RegionalAdmin' ? req.admin.regionId : (req.query.regionId as string);
    const summary = await statsService.getAdminSummary(regionId);
    return res.json({ success: true, data: summary });
  }
);

// GET /admin/dashboard/members-by
apiRouter.get(
  '/admin/dashboard/members-by',
  adminAuthChain,
  requirePermission('dashboard'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const dimension = (req.query.dimension as any) || 'sector';
    const lang = getLang(req);
    const regionId = req.admin?.role === 'RegionalAdmin' ? req.admin.regionId : (req.query.regionId as string);

    const breakdown = await statsService.getMembersByDimension(dimension, lang, regionId);
    return res.json({ success: true, data: breakdown });
  }
);

// GET /admin/dashboard/contributions
apiRouter.get(
  '/admin/dashboard/contributions',
  adminAuthChain,
  requirePermission('contributions.dashboard'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const range = (req.query.range as any) || '12m';
    const group = (req.query.group as any) || 'month';
    const regionId = req.admin?.role === 'RegionalAdmin' ? req.admin.regionId : (req.query.regionId as string);

    const metrics = await statsService.getContributionsDashboard({ range, group, regionId });
    return res.json({ success: true, data: metrics });
  }
);

// GET /admin/dashboard/recent-activity
apiRouter.get(
  '/admin/dashboard/recent-activity',
  adminAuthChain,
  requirePermission('dashboard'),
  async (req: Request, res: Response) => {
    const logs = await query(
      `SELECT a.*, u.full_name as admin_name 
       FROM audit_logs a 
       LEFT JOIN admin_users u ON a.admin_id = u.id 
       ORDER BY a.created_at DESC LIMIT 15`
    );
    return res.json({ success: true, data: logs.rows.map(mapRow).map(toRecentActivityDto) });
  }
);

/* ==========================================================================
   5. ADMIN: PAYMENTS & CONTRIBUTIONS
   ========================================================================== */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Period boundaries computed on the YYYY-MM-DD string (no timezone drift). */
function periodBounds(period: string, dateStr: string): { start: string; end: string } {
  const [y, m, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  if (period === 'yearly') return { start: `${y}-01-01`, end: `${y}-12-31` };
  if (period === 'monthly') {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start: `${y}-${pad2(m)}-01`, end: `${y}-${pad2(m)}-${pad2(last)}` };
  }
  // weekly: Monday..Sunday containing the date
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // Mon=0
  const mon = new Date(dt.getTime() - dow * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const f = (x: Date) => `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`;
  return { start: f(mon), end: f(sun) };
}

const isYmd = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const todayYmd = () => {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
};

async function findUnpaidMembers(period: string, dateStr: string, regionId?: string) {
  const { start, end } = periodBounds(period, dateStr);
  const params: any[] = [start, end];
  let regionCond = '';
  if (regionId) {
    params.push(regionId);
    regionCond = 'AND m.region_id = $3';
  }
  const res = await query(
    `SELECT m.*, r.name AS region_name, s.label AS sector_label, f.label AS field_label, g.label AS grad_label
     FROM members m
     LEFT JOIN regions r ON m.region_id = r.id
     LEFT JOIN lookup_sectors s ON m.sector_id = s.id
     LEFT JOIN lookup_fields_of_study f ON m.field_of_study_id = f.id
     LEFT JOIN lookup_graduation_levels g ON m.graduation_level_id = g.id
     WHERE m.registration_status = 'approved' AND m.membership_status = 'active'
     ${regionCond}
     AND NOT EXISTS (
       SELECT 1 FROM payments p
       WHERE p.member_id = m.id AND p.status = 'paid' AND p.period_start <= $2 AND p.period_end >= $1
     )
     ORDER BY m.full_name ASC
     LIMIT 1000`,
    params
  );
  return res.rows.map(mapRow);
}

const paymentCreateSchema = z.object({
  memberId: z.string().min(1),
  planId: z.string().optional(),
  amountEtb: z.number().positive(),
  period: z.enum(['weekly', 'monthly', 'yearly']),
  paidForDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  method: z.enum(['cash', 'bank_transfer', 'mobile_money', 'other']),
  reference: z.string().optional(),
  bank: z.string().optional(),
  note: z.string().optional(),
});

// GET /admin/payments/unpaid   (must stay above /admin/payments/:id)
apiRouter.get('/admin/payments/unpaid', adminAuthChain, requirePermission('payments'), requireRegionScope, async (req: Request, res: Response) => {
  const period = ['weekly', 'monthly', 'yearly'].includes(String(req.query.period)) ? String(req.query.period) : 'monthly';
  const date = isYmd(req.query.date) ? (req.query.date as string) : todayYmd();
  const rows = await findUnpaidMembers(period, date, (req.query.regionId as string) || undefined);
  const info = await loadPaymentInfo(rows.map((r: any) => r.id));
  const lang = getLang(req);
  return res.json({ success: true, data: rows.map((m: any) => toMemberSummaryDto(m, lang, info[m.id])) });
});

// GET /admin/payments/export   (must stay above /admin/payments/:id)
apiRouter.get('/admin/payments/export', adminAuthChain, requirePermission('payments'), requireRegionScope, async (req: Request, res: Response) => {
  const filters = {
    memberId: req.query.memberId as string,
    regionId: req.query.regionId as string,
    status: req.query.status as string,
    period: req.query.period as string,
    method: req.query.method as string,
    q: req.query.q as string,
    from: req.query.from as string,
    to: req.query.to as string,
  };
  const first = await dbOperations.getPayments({ ...filters, page: 1, pageSize: 100 });
  let items = first.items;
  for (let page = 2; page <= first.meta.totalPages && page <= 50; page++) {
    items = items.concat((await dbOperations.getPayments({ ...filters, page, pageSize: 100 })).items);
  }
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: 'payment.export', entity: 'payments', ip: req.ip });
  const buffer = await exportService.exportPaymentsToExcel(items);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ophea-payments.xlsx"');
  return res.send(buffer);
});

// POST /admin/payments/reminders   (must stay above /admin/payments/:id)
apiRouter.post('/admin/payments/reminders', adminAuthChain, requirePermission('sms'), requireRegionScope, async (req: Request, res: Response) => {
  const period = ['weekly', 'monthly', 'yearly'].includes(String(req.body?.period)) ? String(req.body.period) : 'monthly';
  const date = isYmd(req.body?.date) ? req.body.date : todayYmd();
  const regionId = req.admin?.role === 'RegionalAdmin' ? req.admin.regionId || undefined : undefined;
  const unpaid = await findUnpaidMembers(period, date, regionId);

  if (process.env.FEATURE_SMS !== 'true') {
    return res.json({ success: true, data: { queuedCount: 0 }, message: 'SMS is not enabled on this server (FEATURE_SMS), so no reminders were queued.' });
  }
  let queued = 0;
  for (const m of unpaid) {
    try {
      await afroSmsService.sendSms(m.phone, `OPHEA: Dear ${m.fullName}, your ${period} contribution is due. Please pay at your earliest convenience. Thank you.`);
      queued++;
    } catch {
      /* continue with remaining members */
    }
  }
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: 'payment.reminders', entity: 'payments', after: { period, date, queued }, ip: req.ip });
  return res.json({ success: true, data: { queuedCount: queued } });
});

// POST /admin/payments
apiRouter.post('/admin/payments', adminAuthChain, requirePermission('payments.record'), validateBody(paymentCreateSchema), async (req: Request, res: Response) => {
  const b = req.body;
  const member = await dbOperations.getMemberById(b.memberId);
  if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
  if (req.admin?.role === 'RegionalAdmin' && member.regionId !== req.admin.regionId) {
    return res.status(403).json({ success: false, error: 'Forbidden: Member outside your regional jurisdiction.' });
  }

  const { start: periodStart, end: periodEnd } = periodBounds(b.period, b.paidForDate);
  const existing = await query(
    `SELECT id FROM payments WHERE member_id = $1 AND period = $2 AND period_start = $3 AND status = 'paid'`,
    [b.memberId, b.period, periodStart]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({
      success: false,
      error: `A contribution has already been recorded for this member for ${periodStart} to ${periodEnd}.`,
      fields: { paidForDate: 'Already paid for this period' },
    });
  }

  const payment = await dbOperations.createPayment({
    memberId: b.memberId,
    planId: b.planId,
    regionId: member.regionId,
    amountEtb: b.amountEtb,
    period: b.period,
    periodStart,
    periodEnd,
    method: b.method,
    reference: b.reference,
    bank: b.bank,
    receivedBy: req.admin!.fullName,
    receiptNo: await dbOperations.getNextReceiptNumber(),
    note: b.note,
  });

  await dbOperations.createAuditLog({
    adminId: req.admin?.id,
    action: 'payment.record',
    entity: 'payments',
    entityId: payment.id,
    after: { receiptNo: payment.receiptNo, amountEtb: payment.amountEtb, period: payment.period, memberNo: member.memberNo },
    ip: req.ip,
  });

  emailService.sendReceiptEmail(member.email, member.fullName, payment.receiptNo, payment.amountEtb, payment.period);
  if (process.env.FEATURE_SMS === 'true') {
    afroSmsService.sendSms(member.phone, `OPHEA: Received ${payment.amountEtb} ETB contribution from ${member.fullName}. Receipt #${payment.receiptNo}. Thank you!`);
  }

  const full = await dbOperations.getPaymentById(payment.id);
  return res.status(201).json({ success: true, data: toPaymentDto(full, getLang(req)) });
});

// GET /admin/payments
apiRouter.get('/admin/payments', adminAuthChain, requirePermission('payments'), requireRegionScope, async (req: Request, res: Response) => {
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const payments = await dbOperations.getPayments({
    memberId: s(req.query.memberId),
    regionId: s(req.query.regionId),
    status: s(req.query.status),
    period: s(req.query.period),
    method: s(req.query.method),
    q: s(req.query.q),
    from: s(req.query.from),
    to: s(req.query.to),
    page: parseInt(String(req.query.page || '1'), 10),
    pageSize: parseInt(String(req.query.pageSize || '20'), 10),
  });
  const lang = getLang(req);
  return res.json({ success: true, data: payments.items.map((p: any) => toPaymentDto(p, lang)), meta: payments.meta });
});

// GET /admin/payments/:id
apiRouter.get('/admin/payments/:id', adminAuthChain, requirePermission('payments'), requireRegionScope, async (req: Request, res: Response) => {
  const payment = await dbOperations.getPaymentById(req.params.id);
  if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
  if (req.admin?.role === 'RegionalAdmin' && payment.regionId !== req.admin.regionId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  return res.json({ success: true, data: toPaymentDto(payment, getLang(req)) });
});

// POST /admin/payments/:id/void
apiRouter.post('/admin/payments/:id/void', adminAuthChain, requirePermission('payments.void'), async (req: Request, res: Response) => {
  const note = String(req.body?.note || '').trim();
  if (!note) return res.status(400).json({ success: false, error: 'A reason is required to void a payment', fields: { note: 'Required' } });
  const existing = await dbOperations.getPaymentById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Payment not found' });
  if (existing.status === 'void') return res.status(409).json({ success: false, error: 'Payment is already void' });

  await dbOperations.voidPayment(req.params.id, note);
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: 'payment.void', entity: 'payments', entityId: req.params.id, after: { reason: note }, ip: req.ip });
  return res.json({ success: true, data: toPaymentDto(await dbOperations.getPaymentById(req.params.id), getLang(req)) });
});

// GET /admin/payments/:id/receipt?format=pdf
apiRouter.get('/admin/payments/:id/receipt', adminAuthChain, requirePermission('payments'), async (req: Request, res: Response) => {
  const payment = await dbOperations.getPaymentById(req.params.id);
  if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
  const pdfBuffer = await exportService.generateReceiptPdf(payment);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="receipt-${payment.receiptNo}.pdf"`);
  return res.send(pdfBuffer);
});

/* ==========================================================================
   7. ADMIN: SMS & COMMUNICATION (Phase 3)
   ========================================================================== */

// POST /admin/sms/send
apiRouter.post('/admin/sms/send', adminAuthChain, requirePermission('sms'), async (req: Request, res: Response) => {
  const { memberId, phone, message } = req.body;
  let targetPhone = phone;

  if (memberId && !targetPhone) {
    const mem = await dbOperations.getMemberById(memberId);
    if (mem) targetPhone = mem.phone;
  }

  if (!targetPhone || !message) {
    return res.status(400).json({ success: false, error: 'Recipient phone number and message are required.' });
  }

  const result = await afroSmsService.sendSms(targetPhone, message);
  await dbOperations.createSmsLog({
    memberId: memberId || null,
    phone: targetPhone,
    message,
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    error: result.error,
  });

  return res.json({ success: result.success, messageId: result.messageId, error: result.error });
});

// POST /admin/sms/campaigns
apiRouter.post('/admin/sms/campaigns', adminAuthChain, requirePermission('sms'), async (req: Request, res: Response) => {
  const { name, message, audienceFilter, scheduledAt } = req.body;
  if (!name || !message) {
    return res.status(400).json({ success: false, error: 'Campaign name and message template are required.' });
  }

  const campaign = await smsCampaignService.createCampaign({
    name,
    message,
    audienceFilter: audienceFilter || {},
    scheduledAt,
    createdBy: req.admin?.fullName || 'Admin',
  });

  return res.status(201).json({ success: true, data: campaign });
});

// GET /admin/sms/balance
apiRouter.get('/admin/sms/balance', adminAuthChain, requirePermission('sms'), async (req: Request, res: Response) => {
  const bal: any = await afroSmsService.getBalance();
  const n = typeof bal === 'number' ? bal : Number(bal?.balance ?? 0);
  return res.json({ success: true, data: { balance: Number.isFinite(n) ? n : 0 } });
});

apiRouter.use(adminContentRouter);

/* ==========================================================================
   9. PHASE 4: GROWTH & MEMBER PORTAL (Gated by FEATURE_MEMBER_PORTAL)
   ========================================================================== */

apiRouter.use('/member', (req, res, next) => {
  if (process.env.FEATURE_MEMBER_PORTAL !== 'true') {
    return res.status(403).json({
      success: false,
      error: 'Member Portal is not enabled yet. Scheduled for Phase 4 deployment.',
    });
  }
  next();
});

apiRouter.get('/member/directory', async (req: Request, res: Response) => {
  const result = await query(
    `SELECT member_no, full_name, occupation_type, town, organization_name 
     FROM members WHERE membership_status = 'active' LIMIT 50`
  );
  return res.json({ success: true, data: result.rows.map(mapRow) });
});
