/**
 * Admin DTO mappers.
 *
 * The database stores snake_case columns and JSONB translations. The admin portal
 * (Ophea-Admin/src/types/api.ts) expects flat, display-ready objects. Every admin
 * route returns data through these mappers so both sides always agree.
 *
 * All mappers expect rows that already went through mapRow() (camelCase keys).
 */

import type { Request } from 'express';
import { query } from './database.js';

export type Lang = 'en' | 'om' | 'am';
export interface I18n {
  en: string;
  om: string;
  am: string;
}

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

export function getLang(req: Request): Lang {
  const l = String(req.query.lang || '').toLowerCase();
  return l === 'om' || l === 'am' ? (l as Lang) : 'en';
}

export function parseJson<T = any>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** Normalise anything (string | partial object | JSON string | null) to a full {en,om,am} object. */
export function toI18n(value: unknown): I18n {
  const v = parseJson<any>(value, null);
  if (v === null || v === undefined) return { en: '', om: '', am: '' };
  if (typeof v === 'string') return { en: v, om: '', am: '' };
  if (typeof v === 'object') {
    return {
      en: String(v.en ?? ''),
      om: String(v.om ?? ''),
      am: String(v.am ?? ''),
    };
  }
  return { en: String(v), om: '', am: '' };
}

/** Pick the display string for a language with fallback to English, then any non-empty value. */
export function pick(value: unknown, lang: Lang = 'en'): string {
  const t = toI18n(value);
  return t[lang] || t.en || t.om || t.am || '';
}

/** Format a DATE / TIMESTAMP value as YYYY-MM-DD without timezone drift. */
export function ymd(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) {
    const utcMidnight =
      value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0;
    if (utcMidnight) return value.toISOString().slice(0, 10);
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${m}-${d}`;
  }
  return undefined;
}

export function iso(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function slugify(input: string, fallback = 'item'): string {
  const s = String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

export function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

export function bool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return Boolean(v);
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function pageParams(req: Request, defaultSize = 20) {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || String(defaultSize)), 10) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function makeMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/* ------------------------------------------------------------------ */
/* Admin users                                                         */
/* ------------------------------------------------------------------ */

export function toAdminUserDto(row: any, lang: Lang = 'en') {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone || '',
    username: row.username,
    role: row.role,
    regionId: row.regionId || undefined,
    regionName: row.regionName ? pick(row.regionName, lang) : undefined,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    active: row.isActive !== false,
    mustChangePassword: Boolean(row.mustChangePassword),
    lastLoginAt: iso(row.lastLogin),
    createdAt: iso(row.createdAt) || new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export interface PaymentInfo {
  hasPaidRecentPeriod: boolean;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
}

/** Look up last-payment info for a set of member ids (one query, JS aggregation). */
export async function loadPaymentInfo(memberIds: string[]): Promise<Record<string, PaymentInfo>> {
  const out: Record<string, PaymentInfo> = {};
  if (memberIds.length === 0) return out;

  const placeholders = memberIds.map((_, i) => `$${i + 1}`).join(',');
  const res = await query(
    `SELECT member_id, amount_etb, paid_at, period_end FROM payments
     WHERE status = 'paid' AND member_id IN (${placeholders})
     ORDER BY paid_at DESC`,
    memberIds
  );

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  for (const r of res.rows) {
    const id = r.member_id;
    const periodEnd = ymd(r.period_end) || '';
    const paidCurrent = periodEnd >= firstOfMonth;
    if (!out[id]) {
      out[id] = {
        hasPaidRecentPeriod: paidCurrent,
        lastPaymentDate: ymd(r.paid_at),
        lastPaymentAmount: Number(r.amount_etb),
      };
    } else if (paidCurrent) {
      out[id].hasPaidRecentPeriod = true;
    }
  }
  return out;
}

export function toMemberSummaryDto(row: any, lang: Lang, info?: PaymentInfo) {
  return {
    id: row.id,
    memberNo: row.memberNo,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    gender: row.gender,
    regionId: row.regionId,
    regionName: pick(row.regionName, lang),
    sectorId: row.sectorId,
    sectorName: pick(row.sectorLabel, lang),
    fieldId: row.fieldOfStudyId,
    fieldName: pick(row.fieldLabel, lang),
    occupationType: row.occupationType || 'other',
    graduationLevel: pick(row.gradLabel, lang),
    institution: row.organizationName || undefined,
    registrationStatus: row.registrationStatus,
    membershipStatus: row.membershipStatus,
    hasPaidRecentPeriod: info?.hasPaidRecentPeriod ?? false,
    lastPaymentDate: info?.lastPaymentDate,
    lastPaymentAmount: info?.lastPaymentAmount,
    registeredAt: iso(row.createdAt) || '',
  };
}

export function toMemberDocumentDto(doc: any, memberId: string) {
  return {
    id: doc.id,
    name: doc.originalName,
    type: doc.kind,
    category: doc.documentCategory || doc.document_category || doc.kind,
    size: Number(doc.size) || 0,
    uploadedAt: iso(doc.uploadedAt) || '',
    url: `/admin/members/${memberId}/documents/${doc.id}`,
  };
}

export function toMemberDetailDto(row: any, docs: any[], lang: Lang, info?: PaymentInfo) {
  const last4 = row.idNumberLast4 ? String(row.idNumberLast4) : '';
  return {
    ...toMemberSummaryDto(row, lang, info),
    birthDate: ymd(row.dateOfBirth),
    idType: row.idType,
    idNumber: last4 ? `••••${last4}` : '',
    address: row.town || undefined,
    employer: row.organizationName || undefined,
    jobTitle: row.jobTitle || undefined,
    documents: docs.map((d) => toMemberDocumentDto(d, row.id)),
    rejectionReason: row.rejectionReason || undefined,
    approvedAt: iso(row.approvedAt),
    approvedBy: row.approvedBy || undefined,
    // additive fields (needed by the edit form)
    graduationLevelId: row.graduationLevelId,
    fieldOfStudyId: row.fieldOfStudyId,
    professionalCategory: row.professionalCategory || undefined,
    town: row.town || undefined,
    preferredLanguage: row.preferredLanguage || 'en',
    source: row.source || 'online',
    phoneVerifiedAt: iso(row.phoneVerifiedAt),
    membershipCategory: row.membershipCategory || undefined,
    dateOfBirth: ymd(row.dateOfBirth),
    nationality: row.nationality || undefined,
    emergencyContactName: row.emergencyContactName || undefined,
    emergencyContactPhone: row.emergencyContactPhone || undefined,
    businessTin: row.businessTin || undefined,
    skills: splitList(row.skills),
    expertiseAreas: Array.isArray(row.expertiseAreas) ? row.expertiseAreas : [],
    interests: Array.isArray(row.interests) ? row.interests : [],
    employmentStatus: row.employmentStatus || undefined,
    yearEstablished: row.yearEstablished ?? undefined,
    zoneSubCity: row.zoneSubCity || undefined,
    woreda: row.woreda || undefined,
    institutionName: row.institutionName || undefined,
    registrationDetails: row.registrationDetails && typeof row.registrationDetails === 'object' ? row.registrationDetails : {},
  };
}

function splitList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v !== 'string') return [];
  return v.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
}

/** Accept the field-name aliases the admin forms may send and normalise to backend names. */
export function normalizeMemberBody(b: any) {
  const pickFirst = (...keys: string[]) => {
    for (const k of keys) {
      if (b[k] !== undefined && b[k] !== null && b[k] !== '') return b[k];
    }
    return undefined;
  };
  return {
    fullName: str(pickFirst('fullName', 'name')),
    phone: str(pickFirst('phone')),
    email: str(pickFirst('email')),
    gender: str(pickFirst('gender')),
    dateOfBirth: str(pickFirst('dateOfBirth', 'birthDate')),
    graduationLevelId: str(pickFirst('graduationLevelId', 'graduationLevel')),
    occupationType: str(pickFirst('occupationType')),
    sectorId: str(pickFirst('sectorId')),
    fieldOfStudyId: str(pickFirst('fieldOfStudyId', 'fieldId')),
    professionalCategory: str(pickFirst('professionalCategory')),
    organizationName: str(pickFirst('organizationName', 'employer', 'institution')),
    jobTitle: str(pickFirst('jobTitle')),
    regionId: str(pickFirst('regionId')),
    town: str(pickFirst('town', 'address')),
    idType: str(pickFirst('idType')),
    idNumber: str(pickFirst('idNumber')),
    preferredLanguage: str(pickFirst('preferredLanguage')),
    membershipCategory: str(pickFirst('membershipCategory')),
    nationality: str(pickFirst('nationality')),
    emergencyContactName: str(pickFirst('emergencyContactName')),
    emergencyContactPhone: str(pickFirst('emergencyContactPhone')),
    businessTin: str(pickFirst('businessTin')),
    employmentStatus: str(pickFirst('employmentStatus')),
    yearEstablished: (() => {
      const v = pickFirst('yearEstablished');
      if (v === undefined) return undefined;
      const n = Number(v);
      return Number.isInteger(n) && n >= 1900 && n <= new Date().getFullYear() ? n : undefined;
    })(),
    zoneSubCity: str(pickFirst('zoneSubCity', 'subCityZone')),
    woreda: str(pickFirst('woreda')),
    institutionName: str(pickFirst('institutionName')),
    skills: b.skills === undefined ? undefined : (Array.isArray(b.skills) ? b.skills.map(String).join(', ') : str(b.skills) ?? ''),
    expertiseAreas: b.expertiseAreas === undefined ? undefined : (Array.isArray(b.expertiseAreas) ? b.expertiseAreas.map(String) : []),
    interests: b.interests === undefined ? undefined : (Array.isArray(b.interests) ? b.interests.map(String) : []),
  };
}

/* ------------------------------------------------------------------ */
/* Payments & plans                                                    */
/* ------------------------------------------------------------------ */

export function toPaymentDto(row: any, lang: Lang = 'en') {
  return {
    id: row.id,
    receiptNo: row.receiptNo,
    memberId: row.memberId,
    memberNo: row.memberNo || '',
    memberName: row.memberName || '',
    memberPhone: row.memberPhone || undefined,
    regionId: row.regionId,
    regionName: pick(row.regionName, lang),
    amountEtb: Number(row.amountEtb),
    period: row.period,
    paidForDate: ymd(row.periodStart) || '',
    method: row.method,
    bank: row.bank || undefined,
    reference: row.reference || undefined,
    note: row.note || undefined,
    status: row.status,
    voidReason: row.voidReason || undefined,
    voidedAt: iso(row.voidedAt),
    recordedBy: row.receivedBy,
    createdAt: iso(row.paidAt || row.createdAt) || '',
  };
}

export function toPlanDto(row: any) {
  return {
    id: row.id,
    name: row.name,
    period: row.period,
    amountEtb: Number(row.amountEtb),
    active: row.isActive !== false,
    description: row.description || undefined,
    createdAt: iso(row.createdAt),
  };
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export function toAnnouncementDto(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    status: row.status,
    title: toI18n(row.title),
    summary: toI18n(row.summary),
    body: toI18n(row.body),
    organization: row.organizationName || undefined,
    location: row.location || undefined,
    deadline: ymd(row.deadline),
    attachmentUrl: row.attachmentUrl || undefined,
    externalLink: row.externalLink || undefined,
    coverImageUrl: row.coverImageUrl || undefined,
    eventStartAt: iso(row.eventStartAt),
    eventEndAt: iso(row.eventEndAt),
    registrationOpen: Boolean(row.registrationOpen),
    registrationUrl: row.registrationUrl || undefined,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt) || '',
  };
}

export function toProgramDto(row: any) {
  return {
    id: row.id,
    code: row.slug,
    icon: row.icon,
    order: Number(row.sortOrder ?? 0),
    title: toI18n(row.title),
    description: toI18n(row.summary),
    body: toI18n(row.body),
    active: row.isActive !== false,
  };
}

const OBJECTIVE_KIND_TO_CATEGORY: Record<string, string> = {
  general: 'General',
  official: 'Official',
  main: 'Main',
  specific: 'Specific',
};

export function objectiveCategoryToKind(category: unknown): string {
  const k = String(category || 'general').toLowerCase();
  return ['general', 'official', 'main', 'specific'].includes(k) ? k : 'general';
}

export function toObjectiveDto(row: any) {
  return {
    id: row.id,
    category: OBJECTIVE_KIND_TO_CATEGORY[row.kind] || 'General',
    order: Number(row.sortOrder ?? 0),
    title: toI18n(row.title),
    description: toI18n(row.description),
  };
}

export function toPartnerDto(row: any) {
  return {
    id: row.id,
    name: row.name,
    type: row.partnerType || 'partner',
    logoUrl: row.logoUrl || undefined,
    website: row.websiteUrl || undefined,
    order: Number(row.sortOrder ?? 0),
    active: row.isActive !== false,
  };
}

export function toActivityDto(row: any) {
  return {
    id: row.id,
    title: pick(row.title, 'en'),
    description: pick(row.description, 'en') || undefined,
    date: ymd(row.activityDate) || '',
    imageUrl: row.imageUrl || undefined,
    isPublic: row.isPublic !== false,
    location: row.location || undefined,
  };
}

export function toRegionDto(row: any, memberCount = 0) {
  const name = toI18n(row.name);
  return {
    id: row.id,
    code: String(row.id).replace(/^reg-/, ''),
    name: name.en || name.om || name.am,
    nameOm: name.om || undefined,
    nameAm: name.am || undefined,
    active: row.isActive !== false,
    memberCount,
  };
}

export function toLookupDto(row: any) {
  const label = toI18n(row.label);
  return {
    id: row.id,
    code: row.code,
    name: label.en || label.om || label.am,
    nameOm: label.om || undefined,
    nameAm: label.am || undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Communication & audit                                               */
/* ------------------------------------------------------------------ */

export function toMessageDto(row: any) {
  return {
    id: row.id,
    fullName: row.fullName || row.name || '',
    email: row.email,
    phone: row.phone || undefined,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: iso(row.createdAt) || '',
  };
}

export function toSubscriberDto(row: any) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || undefined,
    language: row.language || undefined,
    active: row.isActive !== false,
    subscribedAt: iso(row.createdAt) || '',
  };
}

export function toSmsCampaignDto(row: any) {
  const totals = parseJson<any>(row.totals, {});
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    audienceFilter: parseJson<Record<string, unknown>>(row.audienceFilter, {}),
    recipientCount: Number(totals.targetCount ?? 0),
    sentCount: Number(totals.sentCount ?? 0),
    failedCount: Number(totals.failedCount ?? 0),
    status: row.status,
    createdAt: iso(row.createdAt) || '',
  };
}

export function toSmsLogDto(row: any) {
  const status = ['delivered', 'sent', 'failed', 'not_configured', 'queued'].includes(row.status) ? row.status : 'unknown';
  return {
    id: row.id,
    recipientPhone: row.phone,
    recipientName: row.memberName || undefined,
    message: row.message,
    status,
    errorMessage: row.error || undefined,
    sentAt: iso(row.sentAt) || '',
  };
}

function summariseAuditDetails(row: any): string | undefined {
  const after = parseJson<any>(row.after, null);
  const before = parseJson<any>(row.before, null);
  const src = after || before;
  if (!src || typeof src !== 'object') return undefined;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(src)) {
    if (v === null || v === undefined || typeof v === 'object') continue;
    const s = String(v);
    if (/hash|password|token/i.test(k)) continue;
    parts.push(`${k}: ${s.length > 60 ? `${s.slice(0, 57)}...` : s}`);
    if (parts.length >= 4) break;
  }
  return parts.length ? parts.join(' · ') : undefined;
}

export function toAuditLogDto(row: any) {
  return {
    id: row.id,
    adminId: row.adminId || '',
    adminName: row.adminName || row.adminUsername || 'System',
    action: row.action,
    entity: row.entity,
    entityId: row.entityId || undefined,
    details: summariseAuditDetails(row),
    ipAddress: row.ip || undefined,
    createdAt: iso(row.createdAt) || '',
  };
}

export function toRecentActivityDto(row: any) {
  let type: 'registration' | 'approval' | 'payment' | 'announcement' = 'registration';
  if (row.action.startsWith('payment')) type = 'payment';
  else if (row.action.startsWith('announcement')) type = 'announcement';
  else if (row.action === 'member.approve' || row.action === 'member.reject') type = 'approval';

  const label = row.action.replace(/[._]/g, ' ');
  return {
    id: row.id,
    type,
    title: label.charAt(0).toUpperCase() + label.slice(1),
    description: summariseAuditDetails(row) || `${row.entity}${row.entityId ? ` #${String(row.entityId).slice(0, 8)}` : ''}`,
    timestamp: iso(row.createdAt) || '',
    actor: row.adminName || row.adminUsername || 'System',
  };
}
