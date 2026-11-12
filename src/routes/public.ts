/**
 * Public Unauthenticated Router for OHPEA Website
 * Mounted at /api/public without authentication requirements.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { query } from '../backend/database.js';
import { success, paginated, fail } from '../utils/response.js';
import {
  buildPublicProgram,
  buildPublicAnnouncement,
  buildPublicPartner,
  buildPublicActivity,
} from '../services/public/publicMappers.js';
import {
  DuplicateRegistrationError,
  validateRegistrationInput,
  processRegistrationFilesAndSave,
} from '../services/public/registrationService.js';
import {
  sendRegistrationOtp,
  verifyRegistrationOtp,
} from '../services/public/publicOtpService.js';
import {
  getPublicSiteSettings,
  getPublicStatsNumbers,
  getPublicRegionsWithWoredas,
  submitPublicContact,
  subscribePublicNewsletter,
} from '../services/public/publicContentService.js';

export const publicRouter = Router();

// Ensure tmp upload directory exists
const tmpDir = path.resolve('uploads/tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Dedicated Multer for Public Registration
const registrationUpload = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).fields([
  { name: 'idDocument', maxCount: 1 },
  { name: 'credentialDocs', maxCount: 10 },
]);

// Rate Limiters: 100 req/min global, 5 req/min on OTP routes (with test headroom in dev)
const globalPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});

const otpRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP requests from this IP. Please try again later.' },
});

publicRouter.use(globalPublicLimiter);

/* 2.1 GET /api/public/site-settings */
publicRouter.get('/site-settings', async (req: Request, res: Response) => {
  try {
    const data = await getPublicSiteSettings();
    return success(res, data);
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

const PUBLIC_STATS_CONTRACT_VERSION = 1;

/* 2.2 GET /api/public/stats */
const statsHandler = async (_req: Request, res: Response) => {
  try {
    // Total active members (do not expose pending/rejected).
    const membersResult = await query(
      `SELECT COUNT(*)::int AS total FROM members WHERE membership_status = 'active'`
    );
    const totalMembers = membersResult.rows[0]?.total ?? 0;

    // The other three come from settings counters (edited via the admin UI).
    const settingsResult = await query(
      `SELECT key, value FROM site_settings WHERE key IN
        ('stats.accreditedHotels', 'stats.certifiedGuides', 'stats.trainingGraduates')`
    );
    const settingsMap = Object.fromEntries(
      settingsResult.rows.map((r: any) => {
        let val = r.value;
        if (typeof val === 'string') {
          try {
            val = JSON.parse(val);
          } catch {
            // keep raw value
          }
        }
        return [r.key, val];
      })
    );

    const toInt = (v: unknown, fallback = 0): number => {
      if (v === null || v === undefined) return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : fallback;
    };

    const data = {
      totalMembers: toInt(totalMembers, 0),
      accreditedHotels: toInt(settingsMap['stats.accreditedHotels'], 87),
      certifiedGuides: toInt(settingsMap['stats.certifiedGuides'], 143),
      trainingGraduates: toInt(settingsMap['stats.trainingGraduates'], 320),
    };

    // Hard guard: the shape MUST be exactly these four keys.
    const keys = Object.keys(data).sort();
    const expected = ['accreditedHotels', 'certifiedGuides', 'totalMembers', 'trainingGraduates'];
    if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) {
      return res.status(500).json({
        success: false,
        error: 'Stats contract violated — expected exactly four fields.',
      });
    }

    res.setHeader('X-Contract-Version', String(PUBLIC_STATS_CONTRACT_VERSION));
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json({ success: true, data });
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
};

publicRouter.get('/stats', statsHandler);
publicRouter.get('/public/stats', statsHandler);

/* 2.3 GET /api/public/programs & /:slug */
publicRouter.get('/programs', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM programs WHERE is_published = true OR is_active = true ORDER BY COALESCE(order_index, sort_order, 0) ASC`
    );
    return success(res, result.rows.map(buildPublicProgram));
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

publicRouter.get('/programs/:slug', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM programs WHERE slug = $1 AND (is_published = true OR is_active = true)`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return fail(res, 'Not found', 404);
    }
    return success(res, buildPublicProgram(result.rows[0]));
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

/* 2.4 GET /api/public/announcements & /:slug */
publicRouter.get('/announcements', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
    const offset = (page - 1) * limit;

    let whereClause = `WHERE status = 'published' AND (published_at IS NULL OR published_at <= NOW())`;
    const params: any[] = [];

    if (req.query.type) {
      params.push(req.query.type);
      whereClause += ` AND type = $${params.length}`;
    }

    const countRes = await query(`SELECT COUNT(*) as count FROM announcements ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);
    const totalPages = Math.ceil(total / limit) || 1;

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const listRes = await query(
      `SELECT * FROM announcements ${whereClause} ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    return paginated(res, listRes.rows.map(buildPublicAnnouncement), {
      page,
      pageSize: limit,
      total,
      totalPages,
    });
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

publicRouter.get('/announcements/:slug', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM announcements WHERE slug = $1 AND status = 'published' AND (published_at IS NULL OR published_at <= NOW())`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return fail(res, 'Not found', 404);
    }
    return success(res, buildPublicAnnouncement(result.rows[0]));
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

/* 2.5 GET /api/public/partners */
publicRouter.get('/partners', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM partners WHERE is_published = true OR is_active = true ORDER BY COALESCE(order_index, sort_order, 0) ASC, name ASC`
    );
    return success(res, result.rows.map(buildPublicPartner));
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

/* 2.6 GET /api/public/activities */
publicRouter.get('/activities', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM activities WHERE is_public = true ORDER BY activity_date DESC LIMIT 50`
    );
    return success(res, result.rows.map(buildPublicActivity));
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

/* 2.7 GET /api/public/lookups/regions */
publicRouter.get('/lookups/regions', async (req: Request, res: Response) => {
  try {
    const data = await getPublicRegionsWithWoredas();
    return success(res, data);
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

/* 2.8 POST /api/public/registrations (multipart/form-data) */
publicRouter.post('/registrations', (req: Request, res: Response, next: NextFunction) => {
  registrationUpload(req, res, async (uploadErr: any) => {
    if (uploadErr) {
      return fail(res, uploadErr.message || 'File upload error', 400);
    }

    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const idDocFile = files?.['idDocument']?.[0];
      const credentialFiles = files?.['credentialDocs'] || [];

      const validation = validateRegistrationInput(req.body, idDocFile);
      if (!validation.isValid) {
        return fail(res, 'Validation failed', 400, validation.fields);
      }

      const member = await processRegistrationFilesAndSave(
        req.body,
        idDocFile!,
        credentialFiles
      );

      return res.status(201).json({
        success: true,
        data: {
          memberId: member.memberId,
          memberNo: member.memberNo,
          registrationStatus: 'pending',
          membershipStatus: 'pending',
        },
      });
    } catch (err: any) {
      if (err instanceof DuplicateRegistrationError) {
        return fail(res, err.message, 409);
      }
      return fail(res, err.message, 500);
    }
  });
});

/* 2.9 POST /api/public/registrations/otp/send */
publicRouter.post('/registrations/otp/send', otpRouteLimiter, async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    const result = await sendRegistrationOtp(phone);
    if (!result.success) {
      return fail(res, result.error || 'Failed to send OTP', 400);
    }
    const responseData: any = { message: 'OTP sent' };
    if (process.env.NODE_ENV !== 'production' && (result as any).code) {
      responseData.code = (result as any).code;
    }
    return success(res, responseData);
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

/* 2.10 POST /api/public/registrations/otp/verify */
publicRouter.post('/registrations/otp/verify', otpRouteLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;
    const result = await verifyRegistrationOtp(phone, code);
    if (!result.success) {
      return fail(res, result.error || 'Invalid or expired code', 400);
    }
    return success(res, { verified: true });
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

/* 2.11 POST /api/public/contact */
publicRouter.post('/contact', async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone, subject, message } = req.body;
    const fields: Record<string, string> = {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      fields.fullName = 'Full name is required';
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fields.email = 'Valid email is required';
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      fields.phone = 'Phone number is required';
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      fields.subject = 'Subject is required';
    }
    if (!message || typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 2000) {
      fields.message = 'Message must be between 10 and 2000 characters';
    }

    if (Object.keys(fields).length > 0) {
      return fail(res, 'Validation failed', 400, fields);
    }

    await submitPublicContact({ fullName, email, phone, subject, message });
    return success(res, { message: 'Message received' });
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});

/* 2.12 POST /api/public/newsletter */
publicRouter.post('/newsletter', async (req: Request, res: Response) => {
  try {
    const { email, name, language } = req.body;
    const fields: Record<string, string> = {};

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fields.email = 'Valid email is required';
    }
    if (language !== undefined && language !== null && !['en', 'om', 'am'].includes(language)) {
      fields.language = 'Language must be one of: en, om, am';
    }

    if (Object.keys(fields).length > 0) {
      return fail(res, 'Validation failed', 400, fields);
    }

    await subscribePublicNewsletter({ email, name, language });
    return success(res, { message: 'Subscribed' });
  } catch (err: any) {
    return fail(res, err.message, 500);
  }
});
