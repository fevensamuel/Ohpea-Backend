/**
 * OHPEA REST API Routes
 * Implements Auth, Public, Admin Member Management, Payments, Content CMS, SMS, and Dashboard endpoints.
 */

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

import { query, mapRow, dbOperations } from './database.js';
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
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
        regionId: admin.regionId,
        mustChangePassword: admin.mustChangePassword,
      },
    },
  });
};

apiRouter.post('/auth/login', loginRateLimiter, validateBody(loginSchema), handleLogin);
apiRouter.post('/admin/login', loginRateLimiter, validateBody(loginSchema), handleLogin);

// GET /auth/me
apiRouter.get('/auth/me', authenticateJWT, loadAdminContext, (req: Request, res: Response) => {
  return res.json({
    success: true,
    data: req.admin,
  });
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
   2. PUBLIC ENDPOINTS (No auth, rate-limited)
   ========================================================================== */

// GET /public/site-settings
apiRouter.get('/public/site-settings', async (req: Request, res: Response) => {
  const result = await query('SELECT key, value FROM site_settings');
  const settings: Record<string, any> = {};
  for (const row of result.rows) {
    settings[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  }
  return res.json({ success: true, data: settings });
});

// GET /public/stats
apiRouter.get('/public/stats', async (req: Request, res: Response) => {
  const stats = await statsService.getPublicStats();
  return res.json({ success: true, data: stats });
});

// GET /public/activities
apiRouter.get('/public/activities', async (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
  const result = await query(
    'SELECT * FROM activities WHERE is_public = true ORDER BY activity_date DESC LIMIT $1',
    [limit]
  );
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

// GET /public/partners
apiRouter.get('/public/partners', async (req: Request, res: Response) => {
  const result = await query(
    'SELECT * FROM partners WHERE is_active = true ORDER BY sort_order ASC'
  );
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

// GET /public/objectives
apiRouter.get('/public/objectives', async (req: Request, res: Response) => {
  const kind = req.query.kind as string;
  let sql = 'SELECT * FROM objectives';
  const params: any[] = [];
  if (kind) {
    sql += ' WHERE kind = $1';
    params.push(kind);
  }
  sql += ' ORDER BY sort_order ASC';
  const result = await query(sql, params);
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

// GET /public/programs
apiRouter.get('/public/programs', async (req: Request, res: Response) => {
  const result = await query(
    'SELECT * FROM programs WHERE is_active = true ORDER BY sort_order ASC'
  );
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

// GET /public/programs/:slug
apiRouter.get('/public/programs/:slug', async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM programs WHERE slug = $1 AND is_active = true', [req.params.slug]);
  if (!result.rows[0]) {
    return res.status(404).json({ success: false, error: 'Program not found' });
  }
  return res.json({ success: true, data: mapRow(result.rows[0]) });
});

// GET /public/announcements
apiRouter.get('/public/announcements', async (req: Request, res: Response) => {
  const { type, q, when, includeClosed } = req.query;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize || '10'), 10)));
  const offset = (page - 1) * pageSize;

  const conditions = ["status = 'published'"];
  const params: any[] = [];
  let idx = 1;

  if (type) {
    conditions.push(`type = $${idx}`);
    params.push(type);
    idx++;
  }

  if (q) {
    conditions.push(`(title::text ILIKE $${idx} OR summary::text ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }

  if (when === 'upcoming') {
    conditions.push(`(event_start_at >= NOW() OR deadline >= CURRENT_DATE)`);
  } else if (when === 'past') {
    conditions.push(`(event_end_at < NOW() OR (event_end_at IS NULL AND deadline < CURRENT_DATE))`);
  } else if (includeClosed !== '1') {
    conditions.push(`(deadline IS NULL OR deadline >= CURRENT_DATE)`);
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;

  const countRes = await query(`SELECT count(*) as total FROM announcements ${whereSql}`, params);
  const total = parseInt(countRes.rows[0].total, 10);

  const listRes = await query(
    `SELECT * FROM announcements ${whereSql} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, pageSize, offset]
  );

  return res.json({
    success: true,
    data: listRes.rows.map(mapRow),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  });
});

// GET /public/announcements/:slug
apiRouter.get('/public/announcements/:slug', async (req: Request, res: Response) => {
  const result = await query(
    "SELECT * FROM announcements WHERE slug = $1 AND status = 'published'",
    [req.params.slug]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ success: false, error: 'Announcement not found' });
  }
  return res.json({ success: true, data: mapRow(result.rows[0]) });
});

// GET /public/lookups
apiRouter.get('/public/lookups', async (req: Request, res: Response) => {
  const lang = (req.query.lang as SupportedLanguage) || 'en';

  const [regionsRes, sectorsRes, fieldsRes, gradRes, occRes] = await Promise.all([
    query('SELECT * FROM regions WHERE is_active = true ORDER BY sort_order ASC'),
    query('SELECT * FROM lookup_sectors WHERE is_active = true ORDER BY sort_order ASC'),
    query('SELECT * FROM lookup_fields_of_study WHERE is_active = true ORDER BY sort_order ASC'),
    query('SELECT * FROM lookup_graduation_levels WHERE is_active = true ORDER BY sort_order ASC'),
    query('SELECT * FROM lookup_occupation_types WHERE is_active = true ORDER BY sort_order ASC'),
  ]);

  const localize = (items: any[]) =>
    items.map((item) => {
      const mapped = mapRow(item);
      let localizedLabel = mapped.name || mapped.label;
      if (typeof localizedLabel === 'object' && localizedLabel !== null) {
        localizedLabel = localizedLabel[lang] || localizedLabel.en || Object.values(localizedLabel)[0];
      }
      return {
        ...mapped,
        displayName: localizedLabel,
      };
    });

  return res.json({
    success: true,
    data: {
      regions: localize(regionsRes.rows),
      sectors: localize(sectorsRes.rows),
      fieldsOfStudy: localize(fieldsRes.rows),
      graduationLevels: localize(gradRes.rows),
      occupationTypes: localize(occRes.rows),
    },
  });
});

// OTP Request & Verify (Phase 3 gated by FEATURE_EMAIL_OTP)
const otpRequestSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  lang: z.enum(['en', 'om', 'am', 'ar', 'fr']).optional(),
});

apiRouter.post(
  '/public/registrations/otp/request',
  customRateLimiter({ windowMs: 3600 * 1000, max: 3, message: 'Maximum 3 OTP requests per hour allowed.' }),
  validateBody(otpRequestSchema),
  async (req: Request, res: Response) => {
    const { email, phone, lang = 'en' } = req.body;
    const result = await otpService.requestOtp(email, phone, req.ip, lang);
    if (!result.success) {
      return res.status(429).json({ success: false, error: result.error });
    }
    return res.json({ success: true, message: 'Verification code sent successfully.' });
  }
);

const otpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

apiRouter.post(
  '/public/registrations/otp/verify',
  validateBody(otpVerifySchema),
  async (req: Request, res: Response) => {
    const { email, code } = req.body;
    const result = await otpService.verifyOtp(email, code);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: { otpToken: result.otpToken } });
  }
);

// POST /public/registrations (Multipart or JSON)
const registrationRateLimiter = customRateLimiter({
  windowMs: 3600 * 1000,
  max: 5,
  message: 'Registration limit reached (max 5 per hour). Please try again later.',
});

apiRouter.post(
  '/public/registrations',
  registrationRateLimiter,
  memberRegistrationUpload,
  async (req: Request, res: Response) => {
    try {
      const body = req.body;

      // Check OTP token if FEATURE_EMAIL_OTP is active
      if (process.env.FEATURE_EMAIL_OTP === 'true') {
        const otpToken = req.headers['x-otp-token'] as string;
        if (!otpToken || !otpService.verifyOtpToken(otpToken, body.email)) {
          return res.status(400).json({
            success: false,
            error: 'Email verification is required. Please verify your email via OTP first.',
          });
        }
      }

      // Basic validation
      const regSchema = z.object({
        fullName: z.string().min(3),
        phone: z.string().min(9),
        email: z.string().email(),
        gender: z.enum(['male', 'female']),
        dateOfBirth: z.string().optional(),
        graduationLevelId: z.string().min(1),
        occupationType: z.enum(['private', 'government', 'other']),
        sectorId: z.string().min(1),
        fieldOfStudyId: z.string().min(1),
        professionalCategory: z.string().optional(),
        organizationName: z.string().optional(),
        jobTitle: z.string().optional(),
        regionId: z.string().min(1),
        town: z.string().optional(),
        idType: z.enum(['fayda', 'passport']),
        idNumber: z.string().min(4),
        consent: z.union([z.boolean(), z.string()]),
      });

      const parsed = regSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          fields: parsed.error.flatten().fieldErrors,
        });
      }

      const normalizedPhone = normalizeEthiopianPhone(parsed.data.phone);
      const pepper = process.env.SERVER_PEPPER || 'ohpea_pepper_2026';
      const idHash = crypto
        .createHash('sha256')
        .update(`${parsed.data.idType}:${parsed.data.idNumber.trim()}:${pepper}`)
        .digest('hex');
      const idLast4 = parsed.data.idNumber.trim().slice(-4);

      // Duplicate check
      const duplicate = await dbOperations.checkDuplicateMember(
        normalizedPhone,
        parsed.data.email,
        parsed.data.idType,
        parsed.data.idNumber
      );

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: 'A member with this phone number, email address, or ID number already exists.',
        });
      }

      const memberNo = await dbOperations.getNextMemberNumber();
      const memberId = crypto.randomUUID();

      const member = await dbOperations.createMember({
        id: memberId,
        memberNo,
        fullName: parsed.data.fullName,
        phone: normalizedPhone,
        email: parsed.data.email,
        gender: parsed.data.gender,
        dateOfBirth: parsed.data.dateOfBirth,
        graduationLevelId: parsed.data.graduationLevelId,
        occupationType: parsed.data.occupationType,
        sectorId: parsed.data.sectorId,
        fieldOfStudyId: parsed.data.fieldOfStudyId,
        professionalCategory: parsed.data.professionalCategory,
        organizationName: parsed.data.organizationName,
        jobTitle: parsed.data.jobTitle,
        regionId: parsed.data.regionId,
        town: parsed.data.town,
        idType: parsed.data.idType,
        idNumberHash: idHash,
        idNumberLast4: idLast4,
        registrationStatus: 'pending',
        membershipStatus: 'pending',
        preferredLanguage: (req.query.lang as SupportedLanguage) || 'en',
        source: 'online',
      });

      // Handle uploaded files safely into private member directory
      const memberDir = path.join(PRIVATE_UPLOAD_PATH, 'members', memberId);
      if (!fs.existsSync(memberDir)) fs.mkdirSync(memberDir, { recursive: true });

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      if (files) {
        if (files.idDocument?.[0]) {
          const file = files.idDocument[0];
          const storedName = `id-${Date.now()}-${path.basename(file.path)}`;
          const targetPath = path.join(memberDir, storedName);
          fs.renameSync(file.path, targetPath);
          const hash = calculateFileHash(targetPath);
          await dbOperations.addMemberDocument({
            memberId,
            kind: 'id',
            originalName: file.originalname,
            storedName,
            mime: file.mimetype,
            size: file.size,
            sha256: hash,
          });
        }

        if (files.credentials) {
          for (const file of files.credentials) {
            const storedName = `cred-${Date.now()}-${path.basename(file.path)}`;
            const targetPath = path.join(memberDir, storedName);
            fs.renameSync(file.path, targetPath);
            const hash = calculateFileHash(targetPath);
            await dbOperations.addMemberDocument({
              memberId,
              kind: 'credential',
              originalName: file.originalname,
              storedName,
              mime: file.mimetype,
              size: file.size,
              sha256: hash,
            });
          }
        }
      }

      // Notifications (async)
      emailService.sendRegistrationReceived(member.email, member.fullName, member.memberNo, member.preferredLanguage);
      if (process.env.FEATURE_SMS === 'true') {
        afroSmsService.sendSms(
          member.phone,
          `OHPEA: Hello ${member.fullName}, your registration #${member.memberNo} has been received and is under review.`
        );
      }

      return res.status(201).json({
        success: true,
        data: {
          memberNo: member.memberNo,
          registrationStatus: 'pending',
          membershipStatus: 'pending',
          fullName: member.fullName,
        },
      });
    } catch (err: any) {
      console.error('[Registration Error]', err);
      return res.status(500).json({ success: false, error: 'Registration failed due to an internal error' });
    }
  }
);

// POST /public/contact
const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(3),
  message: z.string().min(10),
});

apiRouter.post(
  '/public/contact',
  customRateLimiter({ windowMs: 3600 * 1000, max: 5 }),
  validateBody(contactSchema),
  async (req: Request, res: Response) => {
    const { name, email, phone, subject, message } = req.body;
    await query(
      `INSERT INTO contact_messages (id, name, email, phone, subject, message, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'new', NOW())`,
      [crypto.randomUUID(), name, email, phone || null, subject, message]
    );
    return res.json({ success: true, message: 'Message sent successfully. We will be in touch shortly.' });
  }
);

// POST /public/newsletter
const newsletterSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

apiRouter.post(
  '/public/newsletter',
  customRateLimiter({ windowMs: 3600 * 1000, max: 5 }),
  validateBody(newsletterSchema),
  async (req: Request, res: Response) => {
    const { email, name } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    await query(
      `INSERT INTO newsletter_subscribers (id, name, email, is_active, created_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (email) DO UPDATE SET is_active = true`,
      [crypto.randomUUID(), name || null, cleanEmail]
    );
    return res.json({ success: true, message: 'Subscribed to OHPEA newsletter.' });
  }
);

// GET /public/translations/:lang
apiRouter.get('/public/translations/:lang', (req: Request, res: Response) => {
  const lang = (req.params.lang as SupportedLanguage) || 'en';
  return res.json({
    success: true,
    data: translations[lang] || translations.en,
  });
});

/* ==========================================================================
   3. ADMIN: MEMBERS MANAGEMENT
   ========================================================================== */

const adminAuthChain = [authenticateJWT, loadAdminContext];

// GET /admin/members
apiRouter.get(
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

// GET /admin/registrations/pending-count
apiRouter.get(
  '/admin/registrations/pending-count',
  adminAuthChain,
  requirePermission('members'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const regionId = req.query.regionId as string;
    const cond = regionId ? "WHERE registration_status = 'pending' AND region_id = $1" : "WHERE registration_status = 'pending'";
    const params = regionId ? [regionId] : [];
    const resCount = await query(`SELECT count(*) as count FROM members ${cond}`, params);
    return res.json({ success: true, data: { pendingCount: parseInt(resCount.rows[0].count, 10) } });
  }
);

// GET /admin/registrations
apiRouter.get(
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

// GET /admin/registrations/:id
apiRouter.get(
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

// GET /admin/members/:id
apiRouter.get(
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

// PUT /admin/members/:id
apiRouter.put(
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

// PATCH /admin/members/:id/status
apiRouter.patch(
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

// POST /admin/members/:id/approve
apiRouter.post(
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

    // Notify member
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

// POST /admin/members/:id/reject
apiRouter.post(
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

    // Notify member
    emailService.sendRejectionEmail(rejected.email, rejected.fullName, reason, rejected.preferredLanguage);

    return res.json({ success: true, data: rejected });
  }
);

// DELETE /admin/members/:id (SuperAdmin soft delete / deactivation)
apiRouter.delete(
  '/admin/members/:id',
  adminAuthChain,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const member = await dbOperations.getMemberById(req.params.id);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    await dbOperations.updateMemberStatus(req.params.id, 'inactive');
    await query("UPDATE members SET registration_status = 'rejected', rejection_reason = 'Deactivated by SuperAdmin' WHERE id = $1", [req.params.id]);

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

// POST /admin/members (Admin creates member directly)
apiRouter.post(
  '/admin/members',
  adminAuthChain,
  requirePermission('members.edit'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const b = req.body;
    const memberNo = await dbOperations.getNextMemberNumber();
    const pepper = process.env.SERVER_PEPPER || 'ohpea_pepper_2026';
    const idHash = crypto.createHash('sha256').update(`${b.idType || 'fayda'}:${(b.idNumber || '0000').trim()}:${pepper}`).digest('hex');

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

// GET /admin/members/export
apiRouter.get(
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
      pageSize: 500, // Export batch
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

// GET /admin/members/:id/documents/:docId (Secure streaming with audit log)
apiRouter.get(
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
    const lang = (req.query.lang as SupportedLanguage) || 'en';
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
    return res.json({ success: true, data: logs.rows.map(mapRow) });
  }
);

/* ==========================================================================
   5. ADMIN: PAYMENTS & CONTRIBUTIONS
   ========================================================================== */

const paymentCreateSchema = z.object({
  memberId: z.string().min(1),
  planId: z.string().optional(),
  amountEtb: z.number().positive(),
  period: z.enum(['weekly', 'monthly', 'yearly']),
  paidForDate: z.string(), // YYYY-MM-DD
  method: z.enum(['cash', 'bank_transfer', 'mobile_money', 'other']),
  reference: z.string().optional(),
  bank: z.string().optional(),
  note: z.string().optional(),
});

// POST /admin/payments
apiRouter.post(
  '/admin/payments',
  adminAuthChain,
  requirePermission('payments.record'),
  validateBody(paymentCreateSchema),
  async (req: Request, res: Response) => {
    const b = req.body;
    const member = await dbOperations.getMemberById(b.memberId);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    // Compute period start and end
    const paidFor = new Date(b.paidForDate);
    let periodStart = b.paidForDate;
    let periodEnd = b.paidForDate;

    if (b.period === 'monthly') {
      const year = paidFor.getFullYear();
      const month = paidFor.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      periodStart = firstDay.toISOString().split('T')[0];
      periodEnd = lastDay.toISOString().split('T')[0];
    } else if (b.period === 'yearly') {
      const year = paidFor.getFullYear();
      periodStart = `${year}-01-01`;
      periodEnd = `${year}-12-31`;
    }

    // Check duplicate payment for this period
    const existing = await query(
      `SELECT id FROM payments WHERE member_id = $1 AND period = $2 AND period_start = $3 AND status = 'paid'`,
      [b.memberId, b.period, periodStart]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `A contribution has already been recorded for this member for the period ${periodStart} to ${periodEnd}.`,
      });
    }

    const receiptNo = await dbOperations.getNextReceiptNumber();

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
      receiptNo,
      note: b.note,
    });

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: 'payment.record',
      entity: 'payments',
      entityId: payment.id,
      after: payment,
      ip: req.ip,
    });

    // Notify member
    emailService.sendReceiptEmail(member.email, member.fullName, payment.receiptNo, payment.amountEtb, payment.period);
    if (process.env.FEATURE_SMS === 'true') {
      afroSmsService.sendSms(
        member.phone,
        `OHPEA: Received ${payment.amountEtb} ETB contribution from ${member.fullName}. Receipt #${payment.receiptNo}. Thank you!`
      );
    }

    return res.status(201).json({ success: true, data: payment });
  }
);

// GET /admin/payments
apiRouter.get(
  '/admin/payments',
  adminAuthChain,
  requirePermission('payments'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const payments = await dbOperations.getPayments({
      memberId: req.query.memberId as string,
      regionId: req.query.regionId as string,
      status: req.query.status as string,
      period: req.query.period as string,
      page: parseInt(String(req.query.page || '1'), 10),
      pageSize: parseInt(String(req.query.pageSize || '20'), 10),
    });

    return res.json({
      success: true,
      data: payments.items,
      meta: payments.meta,
    });
  }
);

// GET /admin/payments/:id
apiRouter.get(
  '/admin/payments/:id',
  adminAuthChain,
  requirePermission('payments'),
  async (req: Request, res: Response) => {
    const payment = await dbOperations.getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
    return res.json({ success: true, data: payment });
  }
);

// POST /admin/payments/:id/void
apiRouter.post(
  '/admin/payments/:id/void',
  adminAuthChain,
  requirePermission('payments.void'),
  async (req: Request, res: Response) => {
    const voided = await dbOperations.voidPayment(req.params.id, req.body.note);
    if (!voided) return res.status(404).json({ success: false, error: 'Payment not found' });

    await dbOperations.createAuditLog({
      adminId: req.admin?.id,
      action: 'payment.void',
      entity: 'payments',
      entityId: req.params.id,
      ip: req.ip,
    });

    return res.json({ success: true, data: voided });
  }
);

// GET /admin/payments/:id/receipt?format=pdf
apiRouter.get(
  '/admin/payments/:id/receipt',
  adminAuthChain,
  requirePermission('payments'),
  async (req: Request, res: Response) => {
    const payment = await dbOperations.getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });

    const pdfBuffer = await exportService.generateReceiptPdf(payment);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${payment.receiptNo}.pdf"`);
    return res.send(pdfBuffer);
  }
);

// GET /admin/payments/unpaid
apiRouter.get(
  '/admin/payments/unpaid',
  adminAuthChain,
  requirePermission('payments'),
  requireRegionScope,
  async (req: Request, res: Response) => {
    const period = (req.query.period as string) || 'monthly';
    const targetDate = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const d = new Date(targetDate);
    let start = targetDate;
    if (period === 'monthly') {
      start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }

    const regionCond = req.query.regionId ? 'AND m.region_id = $2' : '';
    const params = req.query.regionId ? [start, req.query.regionId] : [start];

    const resUnpaid = await query(
      `SELECT m.id, m.member_no, m.full_name, m.phone, m.email, m.region_id, r.name as region_name
       FROM members m
       LEFT JOIN regions r ON m.region_id = r.id
       WHERE m.membership_status IN ('active', 'pending')
       ${regionCond}
       AND NOT EXISTS (
         SELECT 1 FROM payments p 
         WHERE p.member_id = m.id AND p.status = 'paid' AND p.period_start = $1
       )
       ORDER BY m.full_name ASC`,
      params
    );

    return res.json({
      success: true,
      data: resUnpaid.rows.map(mapRow),
      meta: { totalUnpaid: resUnpaid.rows.length },
    });
  }
);

// GET /admin/contribution-plans
apiRouter.get('/admin/contribution-plans', adminAuthChain, async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM contribution_plans ORDER BY amount_etb ASC');
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

/* ==========================================================================
   6. ADMIN: CONTENT CMS (Announcements, Programs, Objectives, Partners)
   ========================================================================== */

// Announcements CRUD
apiRouter.get('/admin/announcements', adminAuthChain, requirePermission('announcements'), async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM announcements ORDER BY created_at DESC');
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

apiRouter.post('/admin/announcements', adminAuthChain, requirePermission('announcements'), async (req: Request, res: Response) => {
  const b = req.body;
  const id = crypto.randomUUID();
  const slug = (b.slug || b.title?.en || `post-${Date.now()}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const resIns = await query(
    `INSERT INTO announcements (
      id, slug, type, title, summary, body, deadline, event_start_at, event_end_at,
      registration_open, registration_url, status, published_at, cover_image_url, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13,$14) RETURNING *`,
    [
      id,
      slug,
      b.type || 'news',
      JSON.stringify(b.title || { en: 'Announcement' }),
      JSON.stringify(b.summary || { en: '' }),
      JSON.stringify(b.body || { en: '' }),
      b.deadline || null,
      b.eventStartAt || null,
      b.eventEndAt || null,
      Boolean(b.registrationOpen),
      b.registrationUrl || null,
      b.status || 'published',
      b.coverImageUrl || null,
      req.admin?.fullName || 'Admin',
    ]
  );

  return res.status(201).json({ success: true, data: mapRow(resIns.rows[0]) });
});

apiRouter.patch('/admin/announcements/:id/publish', adminAuthChain, requirePermission('announcements'), async (req: Request, res: Response) => {
  const resUp = await query("UPDATE announcements SET status = 'published', published_at = NOW() WHERE id = $1 RETURNING *", [req.params.id]);
  return res.json({ success: true, data: mapRow(resUp.rows[0]) });
});

apiRouter.patch('/admin/announcements/:id/archive', adminAuthChain, requirePermission('announcements'), async (req: Request, res: Response) => {
  const resUp = await query("UPDATE announcements SET status = 'archived' WHERE id = $1 RETURNING *", [req.params.id]);
  return res.json({ success: true, data: mapRow(resUp.rows[0]) });
});

// Contact Messages & Subscribers
apiRouter.get('/admin/messages', adminAuthChain, requirePermission('messages'), async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM contact_messages ORDER BY created_at DESC');
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

apiRouter.patch('/admin/messages/:id', adminAuthChain, requirePermission('messages'), async (req: Request, res: Response) => {
  const { status } = req.body;
  const result = await query('UPDATE contact_messages SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  return res.json({ success: true, data: mapRow(result.rows[0]) });
});

apiRouter.get('/admin/subscribers', adminAuthChain, requirePermission('subscribers'), async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC');
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

/* ==========================================================================
   6. ADMIN: CONTENT CMS (Programs, Objectives, Partners, Activities, Settings, Regions, Lookups)
   ========================================================================== */

// Programs CRUD
apiRouter.get('/admin/programs', adminAuthChain, requirePermission('programs'), async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM programs ORDER BY COALESCE(order_index, sort_order, 0) ASC');
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

apiRouter.post('/admin/programs', adminAuthChain, requirePermission('programs'), async (req: Request, res: Response) => {
  const b = req.body;
  const id = crypto.randomUUID();
  const slug = (b.slug || b.title?.en || `program-${Date.now()}`).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const ins = await query(
    `INSERT INTO programs (id, slug, icon, title, summary, body, sort_order, is_active, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      id,
      slug,
      b.iconUrl || b.icon_url || 'Circle',
      JSON.stringify(b.title && typeof b.title === 'object' ? b.title : { en: b.title || '' }),
      JSON.stringify(b.summary && typeof b.summary === 'object' ? b.summary : { en: b.summary || '' }),
      JSON.stringify(b.body && typeof b.body === 'object' ? b.body : { en: b.body || '' }),
      b.sortOrder ?? 0,
      b.isActive ?? true,
      b.isPublished ?? true,
    ]
  );
  return res.status(201).json({ success: true, data: mapRow(ins.rows[0]) });
});

apiRouter.put('/admin/programs/:id', adminAuthChain, requirePermission('programs'), async (req: Request, res: Response) => {
  const b = req.body;
  const up = await query(
    `UPDATE programs
     SET title = $1,
         summary = $2,
         body = $3,
         icon = $4,
         sort_order = $5,
         is_active = $6,
         is_published = COALESCE($7, is_published)
     WHERE id = $8 RETURNING *`,
    [
      JSON.stringify(b.title && typeof b.title === 'object' ? b.title : { en: b.title || '' }),
      JSON.stringify(b.summary && typeof b.summary === 'object' ? b.summary : { en: b.summary || '' }),
      JSON.stringify(b.body && typeof b.body === 'object' ? b.body : { en: b.body || '' }),
      b.iconUrl || b.icon_url || 'Circle',
      b.sortOrder ?? 0,
      b.isActive ?? true,
      b.isPublished ?? null,
      req.params.id,
    ]
  );
  if (up.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: mapRow(up.rows[0]) });
});

apiRouter.delete('/admin/programs/:id', adminAuthChain, requirePermission('programs'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM programs WHERE id = $1 RETURNING *', [req.params.id]);
  if (del.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: { deleted: true } });
});

// Objectives CRUD
apiRouter.get('/admin/objectives', adminAuthChain, requirePermission('programs'), async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM objectives ORDER BY kind, sort_order');
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

apiRouter.post('/admin/objectives', adminAuthChain, requirePermission('programs'), async (req: Request, res: Response) => {
  const b = req.body;
  const id = crypto.randomUUID();
  const ins = await query(
    `INSERT INTO objectives (id, kind, title, description, sort_order)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [
      id,
      b.kind || 'general',
      JSON.stringify(b.title && typeof b.title === 'object' ? b.title : { en: b.title || '' }),
      JSON.stringify(b.description && typeof b.description === 'object' ? b.description : { en: b.description || '' }),
      b.sortOrder ?? 0,
    ]
  );
  return res.status(201).json({ success: true, data: mapRow(ins.rows[0]) });
});

apiRouter.put('/admin/objectives/:id', adminAuthChain, requirePermission('programs'), async (req: Request, res: Response) => {
  const b = req.body;
  const up = await query(
    `UPDATE objectives
     SET kind = COALESCE($1, kind),
         title = COALESCE($2, title),
         description = COALESCE($3, description),
         sort_order = COALESCE($4, sort_order)
     WHERE id = $5 RETURNING *`,
    [
      b.kind ?? null,
      b.title ? JSON.stringify(b.title && typeof b.title === 'object' ? b.title : { en: b.title || '' }) : null,
      b.description ? JSON.stringify(b.description && typeof b.description === 'object' ? b.description : { en: b.description || '' }) : null,
      b.sortOrder ?? null,
      req.params.id,
    ]
  );
  if (up.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: mapRow(up.rows[0]) });
});

apiRouter.delete('/admin/objectives/:id', adminAuthChain, requirePermission('programs'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM objectives WHERE id = $1 RETURNING *', [req.params.id]);
  if (del.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: { deleted: true } });
});

// Partners CRUD
apiRouter.get('/admin/partners', adminAuthChain, requirePermission('partners'), async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM partners ORDER BY COALESCE(order_index, sort_order, 0) ASC, name ASC');
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

apiRouter.post('/admin/partners', adminAuthChain, requirePermission('partners'), async (req: Request, res: Response) => {
  const b = req.body;
  const id = crypto.randomUUID();
  const ins = await query(
    `INSERT INTO partners (id, name, website_url, logo_url, sort_order, is_active, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      id,
      b.name || '',
      b.website || b.websiteUrl || null,
      b.logoUrl || b.logo_url || null,
      b.sortOrder ?? 0,
      b.isActive ?? true,
      b.isPublished ?? true,
    ]
  );
  return res.status(201).json({ success: true, data: mapRow(ins.rows[0]) });
});

apiRouter.put('/admin/partners/:id', adminAuthChain, requirePermission('partners'), async (req: Request, res: Response) => {
  const b = req.body;
  const up = await query(
    `UPDATE partners
     SET name = COALESCE($1, name),
         website_url = COALESCE($2, website_url),
         logo_url = COALESCE($3, logo_url),
         sort_order = COALESCE($4, sort_order),
         is_active = COALESCE($5, is_active),
         is_published = COALESCE($6, is_published)
     WHERE id = $7 RETURNING *`,
    [
      b.name ?? null,
      b.website ?? b.websiteUrl ?? null,
      b.logoUrl ?? b.logo_url ?? null,
      b.sortOrder ?? null,
      b.isActive ?? null,
      b.isPublished ?? null,
      req.params.id,
    ]
  );
  if (up.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: mapRow(up.rows[0]) });
});

apiRouter.delete('/admin/partners/:id', adminAuthChain, requirePermission('partners'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM partners WHERE id = $1 RETURNING *', [req.params.id]);
  if (del.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: { deleted: true } });
});

// Activities CRUD
apiRouter.get('/admin/activities', adminAuthChain, requirePermission('activities'), async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM activities ORDER BY activity_date DESC');
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

apiRouter.post('/admin/activities', adminAuthChain, requirePermission('activities'), async (req: Request, res: Response) => {
  const b = req.body;
  const id = crypto.randomUUID();
  const ins = await query(
    `INSERT INTO activities (id, title, description, activity_date, image_url, is_public)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      id,
      JSON.stringify(b.title && typeof b.title === 'object' ? b.title : { en: b.title || '' }),
      JSON.stringify(b.description && typeof b.description === 'object' ? b.description : { en: b.description || '' }),
      b.activityDate || null,
      b.imageUrl || b.image_url || null,
      b.isPublic ?? true,
    ]
  );
  return res.status(201).json({ success: true, data: mapRow(ins.rows[0]) });
});

apiRouter.put('/admin/activities/:id', adminAuthChain, requirePermission('activities'), async (req: Request, res: Response) => {
  const b = req.body;
  const up = await query(
    `UPDATE activities
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         activity_date = COALESCE($3, activity_date),
         image_url = COALESCE($4, image_url),
         is_public = COALESCE($5, is_public)
     WHERE id = $6 RETURNING *`,
    [
      b.title ? JSON.stringify(b.title && typeof b.title === 'object' ? b.title : { en: b.title || '' }) : null,
      b.description ? JSON.stringify(b.description && typeof b.description === 'object' ? b.description : { en: b.description || '' }) : null,
      b.activityDate ?? null,
      b.imageUrl ?? b.image_url ?? null,
      b.isPublic ?? null,
      req.params.id,
    ]
  );
  if (up.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: mapRow(up.rows[0]) });
});

apiRouter.delete('/admin/activities/:id', adminAuthChain, requirePermission('activities'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM activities WHERE id = $1 RETURNING *', [req.params.id]);
  if (del.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: { deleted: true } });
});

// Site settings
apiRouter.get('/admin/settings/:key', adminAuthChain, requirePermission('settings.site'), async (req: Request, res: Response) => {
  const result = await query('SELECT value FROM site_settings WHERE key = $1', [req.params.key]);
  if (result.rows.length === 0) return res.json({ success: true, data: null });
  return res.json({ success: true, data: result.rows[0].value });
});

apiRouter.put('/admin/settings/:key', adminAuthChain, requirePermission('settings.site'), async (req: Request, res: Response) => {
  const raw = req.body;
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 1 && 'value' in raw ? raw.value : raw;
  await query(
    `INSERT INTO site_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [req.params.key, JSON.stringify(value)]
  );
  return res.json({ success: true, data: value });
});

// Regions CRUD
apiRouter.get('/admin/regions', adminAuthChain, requirePermission('regions'), async (req: Request, res: Response) => {
  const result = await query(
    `SELECT * FROM regions ORDER BY COALESCE(name->>'en', name->>'am', name->>'om', name::text) ASC`
  );
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

apiRouter.post('/admin/regions', adminAuthChain, requirePermission('regions'), async (req: Request, res: Response) => {
  const b = req.body;
  const id = crypto.randomUUID();
  const ins = await query(
    `INSERT INTO regions (id, name, parent_id, type, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      id,
      JSON.stringify(b.name && typeof b.name === 'object' ? b.name : { en: b.name || '' }),
      b.parentId || b.parent_id || null,
      b.type || 'region',
      b.isActive ?? true,
      b.sortOrder ?? 0,
    ]
  );
  return res.status(201).json({ success: true, data: mapRow(ins.rows[0]) });
});

apiRouter.put('/admin/regions/:id', adminAuthChain, requirePermission('regions'), async (req: Request, res: Response) => {
  const b = req.body;
  const up = await query(
    `UPDATE regions
     SET name = COALESCE($1, name),
         parent_id = COALESCE($2, parent_id),
         type = COALESCE($3, type),
         is_active = COALESCE($4, is_active)
     WHERE id = $5 RETURNING *`,
    [
      b.name ? JSON.stringify(b.name && typeof b.name === 'object' ? b.name : { en: b.name || '' }) : null,
      b.parentId ?? b.parent_id ?? null,
      b.type ?? null,
      b.isActive ?? null,
      req.params.id,
    ]
  );
  if (up.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: mapRow(up.rows[0]) });
});

// Lookups
apiRouter.get('/admin/lookups/:type', adminAuthChain, requirePermission('lookups'), async (req: Request, res: Response) => {
  const tableMap: Record<string, string> = {
    sectors: 'lookup_sectors',
    fields: 'lookup_fields_of_study',
    'graduation-levels': 'lookup_graduation_levels',
  };
  const table = tableMap[req.params.type];
  if (!table) return res.status(400).json({ success: false, error: 'Invalid lookup type' });
  const result = await query(`SELECT * FROM ${table} WHERE is_active = true ORDER BY sort_order ASC`);
  return res.json({ success: true, data: result.rows.map(mapRow) });
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

// GET /admin/sms/campaigns
apiRouter.get('/admin/sms/campaigns', adminAuthChain, requirePermission('sms'), async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM sms_campaigns ORDER BY created_at DESC');
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

// GET /admin/sms/balance
apiRouter.get('/admin/sms/balance', adminAuthChain, requirePermission('sms'), async (req: Request, res: Response) => {
  const bal = await afroSmsService.getBalance();
  return res.json({ success: true, data: bal });
});

/* ==========================================================================
   8. ADMIN: USERS, ROLES, PERMISSIONS & AUDIT LOGS
   ========================================================================== */

// GET /admin/meta/permissions (Single source of truth for UI checkboxes)
apiRouter.get('/admin/meta/permissions', adminAuthChain, (req: Request, res: Response) => {
  const permissions = [
    { key: 'dashboard', label: 'View Dashboard & Analytics' },
    { key: 'members', label: 'View Members Register' },
    { key: 'members.approve', label: 'Approve & Reject Registrations' },
    { key: 'members.edit', label: 'Edit Member Details' },
    { key: 'members.export', label: 'Export Members (Excel/PDF)' },
    { key: 'payments', label: 'View Payments' },
    { key: 'payments.record', label: 'Record Member Contributions' },
    { key: 'payments.void', label: 'Void Payments' },
    { key: 'contributions.dashboard', label: 'View Contributions Financial Charts' },
    { key: 'announcements', label: 'Manage Announcements & Vacancies' },
    { key: 'programs', label: 'Manage Programs' },
    { key: 'partners', label: 'Manage Partners' },
    { key: 'activities', label: 'Manage Activities' },
    { key: 'sms', label: 'Send SMS & Campaigns' },
    { key: 'messages', label: 'Manage Contact Inbox' },
    { key: 'subscribers', label: 'Manage Newsletter Subscribers' },
    { key: 'regions', label: 'Manage Regions & Zones' },
    { key: 'lookups', label: 'Manage System Lookups' },
    { key: 'settings.site', label: 'Manage Site Settings' },
    { key: 'audit', label: 'View Audit Logs' },
    // Phase 4
    { key: 'jobs', label: 'Manage Job Board' },
    { key: 'b2b', label: 'Manage B2B Directory' },
    { key: 'investments', label: 'Manage Investment Opportunities' },
    { key: 'resources', label: 'Manage Tourism Research Repository' },
  ];
  return res.json({ success: true, data: permissions });
});

// GET /admin/users (SuperAdmin only)
apiRouter.get('/admin/users', adminAuthChain, requireSuperAdmin, async (req: Request, res: Response) => {
  const result = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.role, u.permissions, u.region_id, u.is_active, u.must_change_password, u.last_login, u.created_at, r.name as region_name
     FROM admin_users u
     LEFT JOIN regions r ON u.region_id = r.id
     ORDER BY u.created_at DESC`
  );
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

// POST /admin/users (SuperAdmin creates admin)
const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(['SuperAdmin', 'RegionalAdmin', 'Finance', 'Editor']),
  permissions: z.array(z.string()).optional(),
  regionId: z.string().optional(),
});

apiRouter.post('/admin/users', adminAuthChain, requireSuperAdmin, validateBody(createUserSchema), async (req: Request, res: Response) => {
  const b = req.body;
  if (b.role === 'RegionalAdmin' && !b.regionId) {
    return res.status(400).json({ success: false, error: 'regionId is required for RegionalAdmin role' });
  }

  const hash = await bcrypt.hash(b.password, 10);
  const id = crypto.randomUUID();

  const resUser = await query(
    `INSERT INTO admin_users (
      id, username, email, password_hash, full_name, role, permissions, region_id, is_active, must_change_password
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true) RETURNING id, username, email, full_name, role, permissions, region_id, is_active`,
    [id, b.username.toLowerCase(), b.email.toLowerCase(), hash, b.fullName, b.role, b.permissions || [], b.regionId || null]
  );

  await dbOperations.createAuditLog({
    adminId: req.admin?.id,
    action: 'admin.create',
    entity: 'admin_users',
    entityId: id,
    after: { username: b.username, email: b.email, role: b.role },
    ip: req.ip,
  });

  return res.status(201).json({ success: true, data: mapRow(resUser.rows[0]) });
});

// PATCH /admin/users/:id/active
apiRouter.patch('/admin/users/:id/active', adminAuthChain, requireSuperAdmin, async (req: Request, res: Response) => {
  const { isActive } = req.body;
  const resUp = await query('UPDATE admin_users SET is_active = $1 WHERE id = $2 RETURNING id, username, is_active', [Boolean(isActive), req.params.id]);
  return res.json({ success: true, data: mapRow(resUp.rows[0]) });
});

// GET /admin/audit-logs
apiRouter.get('/admin/audit-logs', adminAuthChain, requirePermission('audit'), async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '25'), 10)));
  const offset = (page - 1) * pageSize;

  const countRes = await query('SELECT count(*) as total FROM audit_logs');
  const total = parseInt(countRes.rows[0].total, 10);

  const listRes = await query(
    `SELECT a.*, u.full_name as admin_name, u.username as admin_username 
     FROM audit_logs a 
     LEFT JOIN admin_users u ON a.admin_id = u.id 
     ORDER BY a.created_at DESC 
     LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );

  return res.json({
    success: true,
    data: listRes.rows.map(mapRow),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  });
});

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
