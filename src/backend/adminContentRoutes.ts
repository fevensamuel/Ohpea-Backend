/**
 * Admin content, communication, settings and user-management routes.
 * Every response goes through adminDto mappers so the admin portal always receives
 * the exact shapes declared in Ophea-Admin/src/types/api.ts.
 */

import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';

import {
  authenticateJWT,
  loadAdminContext,
  requireSuperAdmin,
  requirePermission,
  validateBody,
} from './middleware.js';
import { query, mapRow, dbOperations } from './database.js';
import {
  getLang,
  parseJson,
  toI18n,
  pick,
  slugify,
  str,
  bool,
  num,
  pageParams,
  makeMeta,
  toAdminUserDto,
  toPlanDto,
  toAnnouncementDto,
  toProgramDto,
  toObjectiveDto,
  objectiveCategoryToKind,
  toPartnerDto,
  toActivityDto,
  toRegionDto,
  toLookupDto,
  toMessageDto,
  toSubscriberDto,
  toSmsCampaignDto,
  toSmsLogDto,
  toAuditLogDto,
} from './adminDto.js';

export const adminContentRouter = express.Router();

const auth = [authenticateJWT, loadAdminContext];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function fail(res: Response, status: number, error: string, fields?: Record<string, string>) {
  return res.status(status).json({ success: false, error, ...(fields ? { fields } : {}) });
}

/** UPDATE <table> SET only the provided columns. Returns the updated row (mapRow'd) or null. */
async function updateById(table: string, id: string, cols: Record<string, any>) {
  const keys = Object.keys(cols).filter((k) => cols[k] !== undefined);
  if (keys.length === 0) {
    const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return cur.rows[0] ? mapRow(cur.rows[0]) : null;
  }
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = keys.map((k) => cols[k]);
  const res = await query(`UPDATE ${table} SET ${sets} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id]);
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

async function uniqueSlug(table: string, base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await query(`SELECT id FROM ${table} WHERE slug = $1`, [candidate]);
    if (res.rows.length === 0 || (excludeId && res.rows.every((r: any) => r.id === excludeId))) return candidate;
    candidate = `${base}-${n++}`;
  }
}

function audit(req: Request, action: string, entity: string, entityId?: string, after?: any) {
  return dbOperations.createAuditLog({
    adminId: req.admin?.id,
    action,
    entity,
    entityId,
    after,
    ip: req.ip,
  });
}

const ANNOUNCEMENT_TYPES = ['news', 'event', 'vacancy', 'proposal', 'research'];
const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'archived'];

function normalizeAnnouncementType(t: unknown): string {
  const v = String(t || 'news');
  if (v === 'call_for_proposal') return 'proposal';
  if (v === 'call_for_research') return 'research';
  return ANNOUNCEMENT_TYPES.includes(v) ? v : 'news';
}

/* ================================================================== */
/* Announcements                                                       */
/* ================================================================== */

adminContentRouter.get('/admin/announcements', auth, requirePermission('announcements'), async (req: Request, res: Response) => {
  const conds: string[] = [];
  const values: any[] = [];
  if (req.query.type) {
    values.push(normalizeAnnouncementType(req.query.type));
    conds.push(`type = $${values.length}`);
  }
  if (req.query.status) {
    values.push(String(req.query.status));
    conds.push(`status = $${values.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const result = await query(`SELECT * FROM announcements ${where} ORDER BY created_at DESC`, values);
  let items = result.rows.map(mapRow).map(toAnnouncementDto);

  const q = str(req.query.q)?.toLowerCase();
  if (q) {
    items = items.filter((a: any) => JSON.stringify([a.title, a.summary, a.organization]).toLowerCase().includes(q));
  }
  return res.json({ success: true, data: items });
});

adminContentRouter.get('/admin/announcements/:id', auth, requirePermission('announcements'), async (req: Request, res: Response) => {
  const result = await query('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return fail(res, 404, 'Announcement not found');
  return res.json({ success: true, data: toAnnouncementDto(mapRow(result.rows[0])) });
});

function announcementColumns(b: any) {
  const status = ANNOUNCEMENT_STATUSES.includes(b.status) ? b.status : undefined;
  return {
    type: b.type !== undefined ? normalizeAnnouncementType(b.type) : undefined,
    title: b.title !== undefined ? JSON.stringify(toI18n(b.title)) : undefined,
    summary: b.summary !== undefined ? JSON.stringify(toI18n(b.summary)) : undefined,
    body: b.body !== undefined ? JSON.stringify(toI18n(b.body)) : undefined,
    organization_name:
      b.organization !== undefined || b.organizationName !== undefined
        ? str(b.organization ?? b.organizationName) ?? null
        : undefined,
    location: b.location !== undefined ? str(b.location) ?? null : undefined,
    deadline: b.deadline !== undefined ? str(b.deadline) ?? null : undefined,
    attachment_url: b.attachmentUrl !== undefined ? str(b.attachmentUrl) ?? null : undefined,
    external_link: b.externalLink !== undefined ? str(b.externalLink) ?? null : undefined,
    cover_image_url: b.coverImageUrl !== undefined ? str(b.coverImageUrl) ?? null : undefined,
    event_start_at: b.eventStartAt !== undefined ? str(b.eventStartAt) ?? null : undefined,
    event_end_at: b.eventEndAt !== undefined ? str(b.eventEndAt) ?? null : undefined,
    registration_open: b.registrationOpen !== undefined ? bool(b.registrationOpen, false) : undefined,
    registration_url: b.registrationUrl !== undefined ? str(b.registrationUrl) ?? null : undefined,
    status,
  };
}

adminContentRouter.post('/admin/announcements', auth, requirePermission('announcements'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const title = toI18n(b.title);
  if (!title.en && !title.om && !title.am) return fail(res, 400, 'A title is required', { title: 'Title is required' });

  const cols = announcementColumns(b);
  const status = cols.status || 'draft';
  const id = crypto.randomUUID();
  const slug = await uniqueSlug('announcements', slugify(str(b.slug) || title.en || title.om || title.am, 'post'));

  const res2 = await query(
    `INSERT INTO announcements (
      id, slug, type, title, summary, body, attachment_url, external_link, organization_name, location,
      deadline, event_start_at, event_end_at, registration_url, registration_open, published_at, status,
      cover_image_url, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [
      id,
      slug,
      cols.type || 'news',
      cols.title,
      cols.summary ?? JSON.stringify(toI18n(null)),
      cols.body ?? JSON.stringify(toI18n(null)),
      cols.attachment_url ?? null,
      cols.external_link ?? null,
      cols.organization_name ?? null,
      cols.location ?? null,
      cols.deadline ?? null,
      cols.event_start_at ?? null,
      cols.event_end_at ?? null,
      cols.registration_url ?? null,
      cols.registration_open ?? false,
      status === 'published' ? new Date().toISOString() : null,
      status,
      cols.cover_image_url ?? null,
      req.admin?.fullName || 'Admin',
    ]
  );
  await audit(req, 'announcement.create', 'announcements', id, { title: title.en, status });
  return res.status(201).json({ success: true, data: toAnnouncementDto(mapRow(res2.rows[0])) });
});

adminContentRouter.put('/admin/announcements/:id', auth, requirePermission('announcements'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const cols: Record<string, any> = { ...announcementColumns(b), updated_at: new Date().toISOString() };
  if (cols.status === 'published') {
    const cur = await query('SELECT published_at FROM announcements WHERE id = $1', [req.params.id]);
    if (cur.rows[0] && !cur.rows[0].published_at) cols.published_at = new Date().toISOString();
  }
  const updated = await updateById('announcements', req.params.id, cols);
  if (!updated) return fail(res, 404, 'Announcement not found');
  await audit(req, 'announcement.update', 'announcements', req.params.id);
  return res.json({ success: true, data: toAnnouncementDto(updated) });
});

adminContentRouter.patch('/admin/announcements/:id/publish', auth, requirePermission('announcements'), async (req: Request, res: Response) => {
  const updated = await updateById('announcements', req.params.id, {
    status: 'published',
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (!updated) return fail(res, 404, 'Announcement not found');
  await audit(req, 'announcement.publish', 'announcements', req.params.id);
  return res.json({ success: true, data: toAnnouncementDto(updated) });
});

adminContentRouter.patch('/admin/announcements/:id/archive', auth, requirePermission('announcements'), async (req: Request, res: Response) => {
  const updated = await updateById('announcements', req.params.id, { status: 'archived', updated_at: new Date().toISOString() });
  if (!updated) return fail(res, 404, 'Announcement not found');
  await audit(req, 'announcement.archive', 'announcements', req.params.id);
  return res.json({ success: true, data: toAnnouncementDto(updated) });
});

adminContentRouter.delete('/admin/announcements/:id', auth, requirePermission('announcements'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM announcements WHERE id = $1 RETURNING id', [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, 'Announcement not found');
  await audit(req, 'announcement.delete', 'announcements', req.params.id);
  return res.json({ success: true, data: { success: true } });
});

/* ================================================================== */
/* Programs                                                            */
/* ================================================================== */

adminContentRouter.get('/admin/programs', auth, requirePermission('programs'), async (_req: Request, res: Response) => {
  const result = await query('SELECT * FROM programs ORDER BY sort_order ASC');
  return res.json({ success: true, data: result.rows.map(mapRow).map(toProgramDto) });
});

adminContentRouter.post('/admin/programs', auth, requirePermission('programs'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const title = toI18n(b.title);
  if (!title.en && !title.om && !title.am) return fail(res, 400, 'A title is required', { title: 'Title is required' });
  const description = toI18n(b.description ?? b.summary);
  const body = b.body !== undefined ? toI18n(b.body) : description;
  const id = crypto.randomUUID();
  const slug = await uniqueSlug('programs', slugify(str(b.code) || title.en || title.om, 'program'));

  const ins = await query(
    `INSERT INTO programs (id, slug, icon, title, summary, body, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, slug, str(b.icon) || 'Layers', JSON.stringify(title), JSON.stringify(description), JSON.stringify(body), num(b.order, 0), bool(b.active, true)]
  );
  await audit(req, 'program.create', 'programs', id, { title: title.en });
  return res.status(201).json({ success: true, data: toProgramDto(mapRow(ins.rows[0])) });
});

adminContentRouter.put('/admin/programs/:id', auth, requirePermission('programs'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const cols: Record<string, any> = {
    icon: b.icon !== undefined ? str(b.icon) || 'Layers' : undefined,
    title: b.title !== undefined ? JSON.stringify(toI18n(b.title)) : undefined,
    summary: b.description !== undefined || b.summary !== undefined ? JSON.stringify(toI18n(b.description ?? b.summary)) : undefined,
    body: b.body !== undefined ? JSON.stringify(toI18n(b.body)) : undefined,
    sort_order: b.order !== undefined ? num(b.order, 0) : undefined,
    is_active: b.active !== undefined ? bool(b.active, true) : undefined,
  };
  if (b.code !== undefined && str(b.code)) cols.slug = await uniqueSlug('programs', slugify(String(b.code)), req.params.id);
  const updated = await updateById('programs', req.params.id, cols);
  if (!updated) return fail(res, 404, 'Program not found');
  await audit(req, 'program.update', 'programs', req.params.id);
  return res.json({ success: true, data: toProgramDto(updated) });
});

adminContentRouter.delete('/admin/programs/:id', auth, requirePermission('programs'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM programs WHERE id = $1 RETURNING id', [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, 'Program not found');
  await audit(req, 'program.delete', 'programs', req.params.id);
  return res.json({ success: true, data: { success: true } });
});

/* ================================================================== */
/* Objectives                                                          */
/* ================================================================== */

adminContentRouter.get('/admin/objectives', auth, requirePermission('programs'), async (_req: Request, res: Response) => {
  const result = await query('SELECT * FROM objectives ORDER BY kind ASC, sort_order ASC');
  return res.json({ success: true, data: result.rows.map(mapRow).map(toObjectiveDto) });
});

adminContentRouter.post('/admin/objectives', auth, requirePermission('programs'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const title = toI18n(b.title);
  if (!title.en && !title.om && !title.am) return fail(res, 400, 'A title is required', { title: 'Title is required' });
  const id = crypto.randomUUID();
  const ins = await query(
    `INSERT INTO objectives (id, kind, title, description, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, objectiveCategoryToKind(b.category ?? b.kind), JSON.stringify(title), JSON.stringify(toI18n(b.description)), num(b.order, 0)]
  );
  await audit(req, 'objective.create', 'objectives', id);
  return res.status(201).json({ success: true, data: toObjectiveDto(mapRow(ins.rows[0])) });
});

adminContentRouter.put('/admin/objectives/:id', auth, requirePermission('programs'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const updated = await updateById('objectives', req.params.id, {
    kind: b.category !== undefined || b.kind !== undefined ? objectiveCategoryToKind(b.category ?? b.kind) : undefined,
    title: b.title !== undefined ? JSON.stringify(toI18n(b.title)) : undefined,
    description: b.description !== undefined ? JSON.stringify(toI18n(b.description)) : undefined,
    sort_order: b.order !== undefined ? num(b.order, 0) : undefined,
  });
  if (!updated) return fail(res, 404, 'Objective not found');
  await audit(req, 'objective.update', 'objectives', req.params.id);
  return res.json({ success: true, data: toObjectiveDto(updated) });
});

adminContentRouter.delete('/admin/objectives/:id', auth, requirePermission('programs'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM objectives WHERE id = $1 RETURNING id', [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, 'Objective not found');
  await audit(req, 'objective.delete', 'objectives', req.params.id);
  return res.json({ success: true, data: { success: true } });
});

/* ================================================================== */
/* Partners                                                            */
/* ================================================================== */

adminContentRouter.get('/admin/partners', auth, requirePermission('partners'), async (_req: Request, res: Response) => {
  const result = await query('SELECT * FROM partners ORDER BY sort_order ASC, name ASC');
  return res.json({ success: true, data: result.rows.map(mapRow).map(toPartnerDto) });
});

adminContentRouter.post('/admin/partners', auth, requirePermission('partners'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const name = str(b.name);
  if (!name) return fail(res, 400, 'Partner name is required', { name: 'Name is required' });
  const id = crypto.randomUUID();
  const ins = await query(
    `INSERT INTO partners (id, name, partner_type, logo_url, website_url, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, name, str(b.type) || 'partner', str(b.logoUrl) ?? null, str(b.website ?? b.websiteUrl) ?? null, num(b.order, 0), bool(b.active, true)]
  );
  await audit(req, 'partner.create', 'partners', id, { name });
  return res.status(201).json({ success: true, data: toPartnerDto(mapRow(ins.rows[0])) });
});

adminContentRouter.put('/admin/partners/:id', auth, requirePermission('partners'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const updated = await updateById('partners', req.params.id, {
    name: b.name !== undefined ? str(b.name) : undefined,
    partner_type: b.type !== undefined ? str(b.type) || 'partner' : undefined,
    logo_url: b.logoUrl !== undefined ? str(b.logoUrl) ?? null : undefined,
    website_url: b.website !== undefined || b.websiteUrl !== undefined ? str(b.website ?? b.websiteUrl) ?? null : undefined,
    sort_order: b.order !== undefined ? num(b.order, 0) : undefined,
    is_active: b.active !== undefined ? bool(b.active, true) : undefined,
  });
  if (!updated) return fail(res, 404, 'Partner not found');
  await audit(req, 'partner.update', 'partners', req.params.id);
  return res.json({ success: true, data: toPartnerDto(updated) });
});

adminContentRouter.delete('/admin/partners/:id', auth, requirePermission('partners'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM partners WHERE id = $1 RETURNING id', [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, 'Partner not found');
  await audit(req, 'partner.delete', 'partners', req.params.id);
  return res.json({ success: true, data: { success: true } });
});

/* ================================================================== */
/* Activities                                                          */
/* ================================================================== */

adminContentRouter.get('/admin/activities', auth, requirePermission('activities'), async (_req: Request, res: Response) => {
  const result = await query('SELECT * FROM activities ORDER BY activity_date DESC');
  return res.json({ success: true, data: result.rows.map(mapRow).map(toActivityDto) });
});

adminContentRouter.post('/admin/activities', auth, requirePermission('activities'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const title = str(typeof b.title === 'object' ? b.title?.en : b.title);
  const date = str(b.date ?? b.activityDate);
  const errors: Record<string, string> = {};
  if (!title) errors.title = 'Title is required';
  if (!date) errors.date = 'Date is required';
  if (Object.keys(errors).length) return fail(res, 400, 'Please fix the highlighted fields', errors);

  const id = crypto.randomUUID();
  const description = typeof b.description === 'object' ? b.description : { en: str(b.description) || '' };
  const ins = await query(
    `INSERT INTO activities (id, title, description, activity_date, image_url, is_public, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, JSON.stringify({ en: title }), JSON.stringify(toI18n(description)), date, str(b.imageUrl) ?? null, bool(b.isPublic, true), str(b.location) ?? null]
  );
  await audit(req, 'activity.create', 'activities', id, { title });
  return res.status(201).json({ success: true, data: toActivityDto(mapRow(ins.rows[0])) });
});

adminContentRouter.put('/admin/activities/:id', auth, requirePermission('activities'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const title = b.title !== undefined ? str(typeof b.title === 'object' ? b.title?.en : b.title) : undefined;
  const updated = await updateById('activities', req.params.id, {
    title: title !== undefined ? JSON.stringify({ en: title }) : undefined,
    description:
      b.description !== undefined
        ? JSON.stringify(toI18n(typeof b.description === 'object' ? b.description : { en: str(b.description) || '' }))
        : undefined,
    activity_date: b.date !== undefined || b.activityDate !== undefined ? str(b.date ?? b.activityDate) : undefined,
    image_url: b.imageUrl !== undefined ? str(b.imageUrl) ?? null : undefined,
    is_public: b.isPublic !== undefined ? bool(b.isPublic, true) : undefined,
    location: b.location !== undefined ? str(b.location) ?? null : undefined,
  });
  if (!updated) return fail(res, 404, 'Activity not found');
  await audit(req, 'activity.update', 'activities', req.params.id);
  return res.json({ success: true, data: toActivityDto(updated) });
});

adminContentRouter.delete('/admin/activities/:id', auth, requirePermission('activities'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM activities WHERE id = $1 RETURNING id', [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, 'Activity not found');
  await audit(req, 'activity.delete', 'activities', req.params.id);
  return res.json({ success: true, data: { success: true } });
});

/* ================================================================== */
/* Settings (general | contact | socials | stats)                      */
/* ================================================================== */

export const SETTING_DEFAULTS: Record<string, any> = {
  branding: {
    orgName: 'Oromia Hospitality & Tourism Professionals Association',
    orgNameOm: 'Waldaa Ogeeyyii Keessummeessuu fi Tuuriizimii Oromiyaa',
    tagline: '',
    mission: '',
    vision: '',
    supportEmail: '',
    supportPhone: '',
  },
  contact: {
    phonePrimary: '',
    phoneSecondary: '',
    emailGeneral: '',
    emailSupport: '',
    address: '',
    workingHours: '',
    mapCoordinates: '',
  },
  socials: { facebook: '', telegram: '', linkedin: '', twitter: '', youtube: '' },
  stats: { accreditedHotels: 0, certifiedGuides: 0, trainingGraduates: 0 },
};

const flatStrings = (keys: string[], v: any, defaults: Record<string, any>) =>
  Object.fromEntries(keys.map((k) => [k, v[k] === undefined || v[k] === null ? defaults[k] ?? '' : String(v[k]).trim()]));

function cleanSetting(key: string, value: any): any {
  const v = value && typeof value === 'object' ? value : {};
  switch (key) {
    case 'branding':
      return flatStrings(Object.keys(SETTING_DEFAULTS.branding), v, SETTING_DEFAULTS.branding);
    case 'contact':
      return flatStrings(Object.keys(SETTING_DEFAULTS.contact), v, SETTING_DEFAULTS.contact);
    case 'socials':
      return flatStrings(Object.keys(SETTING_DEFAULTS.socials), v, SETTING_DEFAULTS.socials);
    case 'stats':
      return {
        accreditedHotels: Math.max(0, Math.trunc(num(v.accreditedHotels, 0))),
        certifiedGuides: Math.max(0, Math.trunc(num(v.certifiedGuides, 0))),
        trainingGraduates: Math.max(0, Math.trunc(num(v.trainingGraduates, 0))),
      };
  }
  return v;
}

/** Read a setting (merged over defaults). Exported for the public API. */
export async function readSetting(key: string): Promise<any> {
  const res = await query('SELECT value FROM site_settings WHERE key = $1', [key]);
  const stored = res.rows[0] ? parseJson<any>(res.rows[0].value, {}) : {};
  return cleanSetting(key, { ...SETTING_DEFAULTS[key], ...(stored && typeof stored === 'object' ? stored : {}) });
}

adminContentRouter.get('/admin/settings/:key', auth, requirePermission('settings.site'), async (req: Request, res: Response) => {
  if (!(req.params.key in SETTING_DEFAULTS)) return fail(res, 404, `Unknown setting '${req.params.key}'`);
  return res.json({ success: true, data: await readSetting(req.params.key) });
});

adminContentRouter.put('/admin/settings/:key', auth, requirePermission('settings.site'), async (req: Request, res: Response) => {
  const key = req.params.key;
  if (!(key in SETTING_DEFAULTS)) return fail(res, 404, `Unknown setting '${key}'`);
  const raw = req.body && typeof req.body === 'object' && 'value' in req.body ? req.body.value : req.body;
  const value = cleanSetting(key, raw);
  if (key === 'contact') {
    const errs: Record<string, string> = {};
    for (const k of ['emailGeneral', 'emailSupport']) {
      if (value[k] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value[k])) errs[k] = 'Invalid email address';
    }
    if (Object.keys(errs).length) return fail(res, 400, 'Please fix the highlighted fields', errs);
  }
  await query(
    `INSERT INTO site_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)]
  );
  await audit(req, 'settings.update', 'site_settings', key);
  return res.json({ success: true, data: { success: true } });
});

/* ================================================================== */
/* Regions & lookups                                                   */
/* ================================================================== */

adminContentRouter.get('/admin/regions', auth, requirePermission('regions'), async (_req: Request, res: Response) => {
  const regions = await query('SELECT * FROM regions ORDER BY sort_order ASC');
  const counts = await query('SELECT region_id, COUNT(*) AS total FROM members GROUP BY region_id');
  const byRegion: Record<string, number> = {};
  for (const c of counts.rows) byRegion[c.region_id] = parseInt(c.total, 10) || 0;
  const data = regions.rows.map(mapRow).map((r: any) => toRegionDto(r, byRegion[r.id] || 0));
  return res.json({ success: true, data });
});

adminContentRouter.post('/admin/regions', auth, requirePermission('regions'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const name = toI18n({ en: str(b.name) || '', om: str(b.nameOm) || '', am: str(b.nameAm) || '' });
  if (!name.en) return fail(res, 400, 'Region name is required', { name: 'Name is required' });

  const baseId = `reg-${slugify(name.en, 'region')}`;
  let id = baseId;
  let n = 2;
  while ((await query('SELECT id FROM regions WHERE id = $1', [id])).rows.length > 0) id = `${baseId}-${n++}`;

  const maxRes = await query('SELECT COALESCE(MAX(sort_order), 0) AS max FROM regions');
  const nextOrder = (parseInt(maxRes.rows[0]?.max, 10) || 0) + 1;

  const ins = await query(
    `INSERT INTO regions (id, name, parent_id, type, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, JSON.stringify(name), null, str(b.type) || 'zone', nextOrder, bool(b.active, true)]
  );
  await audit(req, 'region.create', 'regions', id, { name: name.en });
  return res.status(201).json({ success: true, data: toRegionDto(mapRow(ins.rows[0]), 0) });
});

adminContentRouter.put('/admin/regions/:id', auth, requirePermission('regions'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const cur = await query('SELECT * FROM regions WHERE id = $1', [req.params.id]);
  if (cur.rows.length === 0) return fail(res, 404, 'Region not found');

  const existing = toI18n(cur.rows[0].name);
  const name = {
    en: b.name !== undefined ? str(b.name) || existing.en : existing.en,
    om: b.nameOm !== undefined ? str(b.nameOm) || '' : existing.om,
    am: b.nameAm !== undefined ? str(b.nameAm) || '' : existing.am,
  };
  const updated = await updateById('regions', req.params.id, {
    name: JSON.stringify(name),
    type: b.type !== undefined ? str(b.type) || 'zone' : undefined,
    is_active: b.active !== undefined ? bool(b.active, true) : undefined,
  });
  await audit(req, 'region.update', 'regions', req.params.id);
  const cnt = await query('SELECT COUNT(*) AS total FROM members WHERE region_id = $1', [req.params.id]);
  return res.json({ success: true, data: toRegionDto(updated, parseInt(cnt.rows[0]?.total, 10) || 0) });
});

const LOOKUP_TABLES: Record<string, string> = {
  sectors: 'lookup_sectors',
  fields: 'lookup_fields_of_study',
  'graduation-levels': 'lookup_graduation_levels',
  occupations: 'lookup_occupation_types',
};

adminContentRouter.get('/admin/lookups/:type', auth, requirePermission('lookups'), async (req: Request, res: Response) => {
  const table = LOOKUP_TABLES[req.params.type];
  if (!table) return fail(res, 400, 'Invalid lookup type');
  const result = await query(`SELECT * FROM ${table} WHERE is_active = true ORDER BY sort_order ASC`);
  return res.json({ success: true, data: result.rows.map(mapRow).map(toLookupDto) });
});

/* ================================================================== */
/* Contribution plans                                                  */
/* ================================================================== */

const PERIODS = ['weekly', 'monthly', 'yearly'];

adminContentRouter.get('/admin/contribution-plans', auth, requirePermission('payments'), async (_req: Request, res: Response) => {
  const result = await query('SELECT * FROM contribution_plans ORDER BY amount_etb ASC');
  return res.json({ success: true, data: result.rows.map(mapRow).map(toPlanDto) });
});

adminContentRouter.post('/admin/contribution-plans', auth, requirePermission('payments.record'), async (req: Request, res: Response) => {
  const b = req.body || {};
  const errors: Record<string, string> = {};
  if (!str(b.name)) errors.name = 'Name is required';
  if (!PERIODS.includes(b.period)) errors.period = 'Period must be weekly, monthly or yearly';
  if (!(num(b.amountEtb, 0) > 0)) errors.amountEtb = 'Amount must be greater than 0';
  if (Object.keys(errors).length) return fail(res, 400, 'Please fix the highlighted fields', errors);

  const id = crypto.randomUUID();
  const ins = await query(
    `INSERT INTO contribution_plans (id, name, period, amount_etb, description, is_active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, str(b.name), b.period, num(b.amountEtb), str(b.description) ?? null, bool(b.active, true)]
  );
  await audit(req, 'plan.create', 'contribution_plans', id, { name: b.name, amountEtb: b.amountEtb });
  return res.status(201).json({ success: true, data: toPlanDto(mapRow(ins.rows[0])) });
});

adminContentRouter.put('/admin/contribution-plans/:id', auth, requirePermission('payments.record'), async (req: Request, res: Response) => {
  const b = req.body || {};
  if (b.period !== undefined && !PERIODS.includes(b.period)) return fail(res, 400, 'Invalid period', { period: 'Invalid period' });
  if (b.amountEtb !== undefined && !(num(b.amountEtb, 0) > 0)) return fail(res, 400, 'Invalid amount', { amountEtb: 'Amount must be greater than 0' });
  const updated = await updateById('contribution_plans', req.params.id, {
    name: b.name !== undefined ? str(b.name) : undefined,
    period: b.period,
    amount_etb: b.amountEtb !== undefined ? num(b.amountEtb) : undefined,
    description: b.description !== undefined ? str(b.description) ?? null : undefined,
    is_active: b.active !== undefined ? bool(b.active, true) : undefined,
  });
  if (!updated) return fail(res, 404, 'Plan not found');
  await audit(req, 'plan.update', 'contribution_plans', req.params.id);
  return res.json({ success: true, data: toPlanDto(updated) });
});

adminContentRouter.delete('/admin/contribution-plans/:id', auth, requirePermission('payments.record'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM contribution_plans WHERE id = $1 RETURNING id', [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, 'Plan not found');
  await audit(req, 'plan.delete', 'contribution_plans', req.params.id);
  return res.json({ success: true, data: { success: true } });
});

/* ================================================================== */
/* Messages & subscribers                                              */
/* ================================================================== */

const MESSAGE_STATUSES = ['new', 'read', 'in_progress', 'resolved'];

adminContentRouter.get('/admin/messages', auth, requirePermission('messages'), async (req: Request, res: Response) => {
  const { page, pageSize, offset } = pageParams(req);
  const status = str(req.query.status);
  const where = status ? 'WHERE status = $1' : '';
  const values = status ? [status] : [];
  const total = parseInt((await query(`SELECT COUNT(*) AS total FROM contact_messages ${where}`, values)).rows[0].total, 10) || 0;
  const rows = await query(
    `SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset]
  );
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toMessageDto), meta: makeMeta(page, pageSize, total) });
});

adminContentRouter.patch('/admin/messages/:id', auth, requirePermission('messages'), async (req: Request, res: Response) => {
  const status = req.body?.status;
  if (!MESSAGE_STATUSES.includes(status)) return fail(res, 400, 'Invalid status', { status: `Must be one of: ${MESSAGE_STATUSES.join(', ')}` });
  const updated = await updateById('contact_messages', req.params.id, { status });
  if (!updated) return fail(res, 404, 'Message not found');
  return res.json({ success: true, data: toMessageDto(updated) });
});

adminContentRouter.get('/admin/subscribers', auth, requirePermission('subscribers'), async (req: Request, res: Response) => {
  const { page, pageSize, offset } = pageParams(req);
  const total = parseInt((await query('SELECT COUNT(*) AS total FROM newsletter_subscribers')).rows[0].total, 10) || 0;
  const rows = await query('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT $1 OFFSET $2', [pageSize, offset]);
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toSubscriberDto), meta: makeMeta(page, pageSize, total) });
});

adminContentRouter.delete('/admin/subscribers/:id', auth, requirePermission('subscribers'), async (req: Request, res: Response) => {
  const del = await query('DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING id', [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, 'Subscriber not found');
  await audit(req, 'subscriber.delete', 'newsletter_subscribers', req.params.id);
  return res.json({ success: true, data: { success: true } });
});

/* ================================================================== */
/* SMS campaigns & logs (send + balance stay in routes.ts)             */
/* ================================================================== */

adminContentRouter.get('/admin/sms/campaigns', auth, requirePermission('sms'), async (req: Request, res: Response) => {
  const { page, pageSize, offset } = pageParams(req);
  const total = parseInt((await query('SELECT COUNT(*) AS total FROM sms_campaigns')).rows[0].total, 10) || 0;
  const rows = await query('SELECT * FROM sms_campaigns ORDER BY created_at DESC LIMIT $1 OFFSET $2', [pageSize, offset]);
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toSmsCampaignDto), meta: makeMeta(page, pageSize, total) });
});

adminContentRouter.get('/admin/sms/logs', auth, requirePermission('sms'), async (req: Request, res: Response) => {
  const { page, pageSize, offset } = pageParams(req);
  const status = str(req.query.status);
  const where = status ? 'WHERE l.status = $1' : '';
  const values = status ? [status] : [];
  const total = parseInt((await query(`SELECT COUNT(*) AS total FROM sms_logs l ${where}`, values)).rows[0].total, 10) || 0;
  const rows = await query(
    `SELECT l.*, m.full_name AS member_name FROM sms_logs l
     LEFT JOIN members m ON l.member_id = m.id
     ${where} ORDER BY l.sent_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset]
  );
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toSmsLogDto), meta: makeMeta(page, pageSize, total) });
});

/* ================================================================== */
/* Permissions, users, audit logs                                      */
/* ================================================================== */

export const PERMISSION_OPTIONS = [
  { key: 'dashboard', label: 'View Dashboard & Analytics' },
  { key: 'members', label: 'View Members Register' },
  { key: 'members.approve', label: 'Approve & Reject Registrations' },
  { key: 'members.edit', label: 'Edit Member Details' },
  { key: 'members.export', label: 'Export Members (Excel/PDF)' },
  { key: 'payments', label: 'View Payments' },
  { key: 'payments.record', label: 'Record Contributions & Manage Plans' },
  { key: 'payments.void', label: 'Void Payments' },
  { key: 'contributions.dashboard', label: 'View Contribution Charts' },
  { key: 'announcements', label: 'Manage Announcements & Vacancies' },
  { key: 'programs', label: 'Manage Programs & Objectives' },
  { key: 'partners', label: 'Manage Partners' },
  { key: 'activities', label: 'Manage Activities' },
  { key: 'sms', label: 'Send SMS & Campaigns' },
  { key: 'messages', label: 'Manage Contact Inbox' },
  { key: 'subscribers', label: 'Manage Newsletter Subscribers' },
  { key: 'regions', label: 'Manage Regions' },
  { key: 'lookups', label: 'View System Lookups' },
  { key: 'settings.site', label: 'Manage Site Settings' },
  { key: 'audit', label: 'View Audit Logs' },
];

const VALID_PERMISSION_KEYS = PERMISSION_OPTIONS.map((p) => p.key);

adminContentRouter.get('/admin/meta/permissions', auth, (_req: Request, res: Response) => {
  return res.json({ success: true, data: PERMISSION_OPTIONS });
});

const USER_SELECT = `SELECT u.*, r.name AS region_name FROM admin_users u LEFT JOIN regions r ON u.region_id = r.id`;

adminContentRouter.get('/admin/users', auth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { page, pageSize, offset } = pageParams(req);
  const lang = getLang(req);
  const total = parseInt((await query('SELECT COUNT(*) AS total FROM admin_users')).rows[0].total, 10) || 0;
  const rows = await query(`${USER_SELECT} ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, [pageSize, offset]);
  return res.json({
    success: true,
    data: rows.rows.map(mapRow).map((r: any) => toAdminUserDto(r, lang)),
    meta: makeMeta(page, pageSize, total),
  });
});

const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2),
  role: z.enum(['SuperAdmin', 'RegionalAdmin', 'Finance', 'Editor']),
  permissions: z.array(z.string()).optional(),
  regionId: z.string().optional().nullable(),
});

adminContentRouter.post('/admin/users', auth, requireSuperAdmin, validateBody(createUserSchema), async (req: Request, res: Response) => {
  const b = req.body;
  if (b.role === 'RegionalAdmin' && !b.regionId) return fail(res, 400, 'regionId is required for RegionalAdmin role', { regionId: 'Required for RegionalAdmin' });

  const dup = await query('SELECT id FROM admin_users WHERE LOWER(username) = $1 OR LOWER(email) = $2', [b.username.toLowerCase(), b.email.toLowerCase()]);
  if (dup.rows.length > 0) return fail(res, 409, 'A user with this username or email already exists');

  const permissions = (b.permissions || []).filter((p: string) => VALID_PERMISSION_KEYS.includes(p));
  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(b.password, 10);
  await query(
    `INSERT INTO admin_users (id, username, email, password_hash, full_name, role, permissions, region_id, is_active, must_change_password)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true)`,
    [id, b.username.toLowerCase(), b.email.toLowerCase(), hash, b.fullName, b.role, permissions, b.role === 'RegionalAdmin' ? b.regionId : b.regionId || null]
  );
  await audit(req, 'admin.create', 'admin_users', id, { username: b.username, email: b.email, role: b.role });
  const row = await query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return res.status(201).json({ success: true, data: toAdminUserDto(mapRow(row.rows[0]), getLang(req)) });
});

adminContentRouter.put('/admin/users/:id', auth, requireSuperAdmin, async (req: Request, res: Response) => {
  const b = req.body || {};
  const cur = await query('SELECT * FROM admin_users WHERE id = $1', [req.params.id]);
  if (cur.rows.length === 0) return fail(res, 404, 'User not found');

  const role = b.role ?? cur.rows[0].role;
  if (!['SuperAdmin', 'RegionalAdmin', 'Finance', 'Editor'].includes(role)) return fail(res, 400, 'Invalid role', { role: 'Invalid role' });
  const regionId = b.regionId !== undefined ? str(b.regionId) ?? null : cur.rows[0].region_id;
  if (role === 'RegionalAdmin' && !regionId) return fail(res, 400, 'regionId is required for RegionalAdmin role', { regionId: 'Required for RegionalAdmin' });
  if (req.params.id === req.admin!.id && role !== 'SuperAdmin') return fail(res, 400, 'You cannot remove your own SuperAdmin role');

  if (b.email !== undefined) {
    const dup = await query('SELECT id FROM admin_users WHERE LOWER(email) = $1 AND id <> $2', [String(b.email).toLowerCase(), req.params.id]);
    if (dup.rows.length > 0) return fail(res, 409, 'Another user already uses this email', { email: 'Email already in use' });
  }

  await updateById('admin_users', req.params.id, {
    full_name: b.fullName !== undefined ? str(b.fullName) : undefined,
    email: b.email !== undefined ? String(b.email).toLowerCase() : undefined,
    role,
    permissions: Array.isArray(b.permissions) ? b.permissions.filter((p: string) => VALID_PERMISSION_KEYS.includes(p)) : undefined,
    region_id: regionId,
  });
  await audit(req, 'admin.update', 'admin_users', req.params.id, { role });
  const row = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);
  return res.json({ success: true, data: toAdminUserDto(mapRow(row.rows[0]), getLang(req)) });
});

adminContentRouter.patch('/admin/users/:id/active', auth, requireSuperAdmin, async (req: Request, res: Response) => {
  const active = bool(req.body?.active ?? req.body?.isActive, true);
  if (req.params.id === req.admin!.id && !active) return fail(res, 400, 'You cannot deactivate your own account');
  const updated = await updateById('admin_users', req.params.id, { is_active: active });
  if (!updated) return fail(res, 404, 'User not found');
  await audit(req, active ? 'admin.activate' : 'admin.deactivate', 'admin_users', req.params.id);
  const row = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);
  return res.json({ success: true, data: toAdminUserDto(mapRow(row.rows[0]), getLang(req)) });
});

adminContentRouter.post('/admin/users/:id/reset-password', auth, requireSuperAdmin, async (req: Request, res: Response) => {
  const cur = await query('SELECT id FROM admin_users WHERE id = $1', [req.params.id]);
  if (cur.rows.length === 0) return fail(res, 404, 'User not found');
  // 12 chars, guaranteed upper + lower + digit
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  let temp = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  temp = `${temp.slice(0, 9)}Aa7`;
  const hash = await bcrypt.hash(temp, 10);
  await updateById('admin_users', req.params.id, { password_hash: hash, must_change_password: true });
  await audit(req, 'admin.reset_password', 'admin_users', req.params.id);
  return res.json({ success: true, data: { success: true, tempPassword: temp } });
});

adminContentRouter.get('/admin/audit-logs', auth, requirePermission('audit'), async (req: Request, res: Response) => {
  const { page, pageSize, offset } = pageParams(req, 25);
  const total = parseInt((await query('SELECT COUNT(*) AS total FROM audit_logs')).rows[0].total, 10) || 0;
  const rows = await query(
    `SELECT a.*, u.full_name AS admin_name, u.username AS admin_username
     FROM audit_logs a LEFT JOIN admin_users u ON a.admin_id = u.id
     ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toAuditLogDto), meta: makeMeta(page, pageSize, total) });
});

// kept for type-checking helpers that are imported but only used by other modules
export const _unused = { pick };
