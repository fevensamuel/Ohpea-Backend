// src/lib/ophea-api-client.ts
export interface ApiMeta { page: number; pageSize: number; total: number; totalPages: number }
export interface ApiEnvelope<T> { success: boolean; data: T; meta?: ApiMeta; error?: string; fields?: Record<string, string> }

export class ApiError extends Error {
  constructor(public message: string, public status: number, public fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Paginated<T> { data: T[]; meta: ApiMeta }

export type LocalizedText = string | { en?: string; om?: string; am?: string; [k: string]: unknown };

export interface SiteSettings {
  name?: LocalizedText;
  tagline?: LocalizedText;
  email?: string;
  phone?: string;
  address?: LocalizedText;
  coordinates?: { lat: number; lng: number };
  social?: Record<string, string>;
  hotlines?: string[];
  [k: string]: unknown;
}

export interface PublicStats {
  totalMembers: number;
  accreditedHotels: number;
  certifiedGuides: number;
  trainingGraduates: number;
  [k: string]: unknown;
}

export interface Program {
  id: string;
  slug: string;
  title: LocalizedText;
  summary?: LocalizedText;
  body?: LocalizedText;
  iconUrl?: string;
  orderIndex?: number;
  [k: string]: unknown;
}

export interface Announcement {
  id: string;
  slug: string;
  type: 'news' | 'event' | 'vacancy' | 'proposal' | 'research';
  title: LocalizedText;
  summary?: LocalizedText;
  body?: LocalizedText;
  coverImageUrl?: string;
  eventStartAt?: string;
  deadline?: string;
  publishedAt?: string;
  [k: string]: unknown;
}

export interface Partner {
  id: string;
  name: LocalizedText;
  website?: string;
  logoUrl?: string;
  [k: string]: unknown;
}

export interface Activity {
  id: string;
  title: LocalizedText;
  summary?: LocalizedText;
  date?: string;
  photos?: string[];
  [k: string]: unknown;
}

export interface Region {
  id: string;
  name: LocalizedText;
  woredas?: { id: string; name: LocalizedText }[];
}

export interface Objective {
  id: string;
  kind: 'general' | 'official' | 'main' | 'specific';
  title: LocalizedText;
  description?: LocalizedText;
  [k: string]: unknown;
}

export interface LookupItem {
  id?: string;
  code?: string;
  label?: LocalizedText;
  localizedLabel?: string;
  name?: LocalizedText;
  [k: string]: unknown;
}

export interface RegistrationForm {
  fullName: string;
  email: string;
  phone: string;
  qualification?: string;
  fieldOfStudy?: string;
  organization?: string;
  zone?: string;
  idType: 'fayda' | 'passport' | 'kebele' | 'driver';
  idNumber: string;
  idDocument: File;
  credentialDocs?: File[];
}

type Query = Record<string, string | number | boolean | undefined | null>;

export class OpheaPublicClient {
  private baseUrl: string;
  constructor(rawBase: string) {
    this.baseUrl = rawBase.replace(/\/+$/, '');
  }

  private url(path: string, query?: Query) {
    const u = new URL(this.baseUrl + (path.startsWith('/') ? '' : '/') + path);
    if (query) for (const [k, v] of Object.entries(query))
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    return u.toString();
  }

  private async call<T>(method: 'GET' | 'POST', path: string, opts: { query?: Query; json?: unknown; form?: FormData } = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json); }

    const res = await fetch(this.url(path, opts.query), { method, headers, body, credentials: 'omit' });
    const text = await res.text();
    const parsed = text ? safeJson<ApiEnvelope<T>>(text) : undefined;

    if (!res.ok || (parsed && parsed.success === false)) {
      throw new ApiError(parsed?.error || `HTTP ${res.status}`, res.status, parsed?.fields);
    }
    return parsed && parsed.success ? parsed.data : (parsed as unknown as T);
  }

  private async callPaginated<T>(path: string, query?: Query): Promise<Paginated<T>> {
    const res = await fetch(this.url(path, query), { headers: { Accept: 'application/json' }, credentials: 'omit' });
    const parsed = safeJson<ApiEnvelope<T[]>>(await res.text());
    if (!res.ok || !parsed?.success) throw new ApiError(parsed?.error || `HTTP ${res.status}`, res.status, parsed?.fields);
    return { data: parsed.data, meta: parsed.meta ?? { page: 1, pageSize: parsed.data.length, total: parsed.data.length, totalPages: 1 } };
  }

  // ── READ ─────────────────────────────────────────────
  getSiteSettings     = () => this.call<SiteSettings>('GET', '/public/site-settings');
  getStats            = () => this.call<PublicStats>('GET', '/public/stats');
  getLookups          = () => this.call<Record<string, unknown>>('GET', '/public/lookups');
  getTranslations     = (lang: string) => this.call<Record<string, string>>('GET', `/public/translations/${encodeURIComponent(lang)}`);
  getPrograms         = () => this.call<Program[]>('GET', '/public/programs');
  getProgram          = (slug: string) => this.call<Program>('GET', `/public/programs/${encodeURIComponent(slug)}`);
  getAnnouncements    = (q: { type?: Announcement['type']; limit?: number; page?: number } = {}) => this.callPaginated<Announcement>('/public/announcements', q);
  getAnnouncement     = (slug: string) => this.call<Announcement>('GET', `/public/announcements/${encodeURIComponent(slug)}`);
  getPartners         = () => this.call<Partner[]>('GET', '/public/partners');
  getActivities       = () => this.call<Activity[]>('GET', '/public/activities');
  getRegions          = () => this.call<Region[]>('GET', '/public/lookups/regions');
  getGraduationLevels = () => this.call<LookupItem[]>('GET', '/public/lookups/graduation-levels');
  getFieldsOfStudy    = () => this.call<LookupItem[]>('GET', '/public/lookups/fields');
  getSectors          = () => this.call<LookupItem[]>('GET', '/public/lookups/sectors');
  getObjectives       = () => this.call<Objective[]>('GET', '/public/objectives');

  // ── WRITE ────────────────────────────────────────────
  submitRegistration(form: RegistrationForm | FormData) {
    if (form instanceof FormData) {
      return this.call<{ registrationId?: string }>('POST', '/public/registrations', { form });
    }

    const fd = new FormData();
    fd.append('fullName', form.fullName);
    fd.append('email', form.email);
    fd.append('phone', form.phone);
    if (form.qualification) fd.append('qualification', form.qualification);
    if (form.fieldOfStudy)  fd.append('fieldOfStudy', form.fieldOfStudy);
    if (form.organization)  fd.append('organization', form.organization);
    if (form.zone)          fd.append('zone', form.zone);
    fd.append('idType', form.idType);
    fd.append('idNumber', form.idNumber);
    fd.append('idDocument', form.idDocument);
    (form.credentialDocs ?? []).forEach(f => fd.append('credentialDocs', f));
    return this.call<{ registrationId: string }>('POST', '/public/registrations', { form: fd });
  }
  sendRegistrationOtp   = (phone: string) => this.call<{ message: string }>('POST', '/public/registrations/otp/send', { json: { phone } });
  verifyRegistrationOtp = (phone: string, code: string) => this.call<{ verified: boolean }>('POST', '/public/registrations/otp/verify', { json: { phone, code } });
  sendContact = (b: { fullName: string; email: string; phone: string; subject: string; message: string }) => this.call<{ message: string }>('POST', '/public/contact', { json: b });
  subscribeNewsletter = (b: { email: string; name?: string; language?: 'en' | 'om' | 'am' }) => this.call<{ message: string }>('POST', '/public/newsletter', { json: b });
}

function safeJson<T>(t: string): T | undefined { try { return JSON.parse(t) as T; } catch { return undefined; } }

const envUrl: string | undefined = (import.meta as any).env?.VITE_API_URL || (typeof process !== 'undefined' ? process.env?.VITE_API_URL : undefined);
const isProd: boolean = Boolean((import.meta as any).env?.PROD);

if (!envUrl && isProd) {
  // eslint-disable-next-line no-console
  console.error(
    '[ophea-api] VITE_API_URL is NOT set in this production build. ' +
    'Every API call will fail. Set VITE_API_URL in your CI/CD environment and rebuild.'
  );
}

export const api = new OpheaPublicClient(envUrl || 'http://localhost:3000/api');