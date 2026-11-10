/**
 * OHPEA API Shared TypeScript Types and Interfaces
 */

export type SupportedLanguage = 'en' | 'om' | 'am' | 'ar' | 'fr';

export type I18nString = {
  en: string;
  om?: string;
  am?: string;
  ar?: string;
  fr?: string;
  [key: string]: string | undefined;
};

export type AdminRole = 'SuperAdmin' | 'RegionalAdmin' | 'Finance' | 'Editor';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';
export type MembershipStatus = 'pending' | 'active' | 'inactive';
export type MemberSource = 'online' | 'admin' | 'migration';
export type IdType = 'fayda' | 'passport';
export type Gender = 'male' | 'female';
export type OccupationType = 'private' | 'government' | 'other';
export type PeriodType = 'weekly' | 'monthly' | 'yearly';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'other';
export type PaymentStatus = 'paid' | 'void';
export type DocumentKind = 'id' | 'credential';
export type RegionType = 'zone' | 'city' | 'region';
export type ObjectiveKind = 'general' | 'main' | 'specific' | 'official';
export type AnnouncementType = 'vacancy' | 'call_for_proposal' | 'call_for_research' | 'news' | 'event';
export type AnnouncementStatus = 'draft' | 'published' | 'archived';
export type ContactStatus = 'new' | 'read' | 'replied' | 'archived';
export type SmsCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fields?: Record<string, string>;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  meta?: PaginationMeta;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: string[];
  regionId?: string | null;
  mustChangePassword?: boolean;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: AdminRole;
  permissions: string[];
  regionId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export interface Region {
  id: string;
  name: I18nString;
  parentId: string | null;
  type: RegionType;
  isActive: boolean;
  sortOrder?: number;
}

export interface LookupItem {
  id: string;
  code: string;
  label: I18nString;
  sortOrder: number;
  isActive: boolean;
}

export interface Member {
  id: string;
  memberNo: string;
  fullName: string;
  phone: string;
  email: string;
  gender: Gender;
  dateOfBirth?: string | null;
  graduationLevelId: string;
  occupationType: OccupationType;
  sectorId: string;
  fieldOfStudyId: string;
  professionalCategory?: string | null;
  organizationName?: string | null;
  jobTitle?: string | null;
  regionId: string;
  town?: string | null;
  idType: IdType;
  idNumberHash?: string;
  idNumberLast4?: string;
  registrationStatus: RegistrationStatus;
  membershipStatus: MembershipStatus;
  rejectionReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  consentAt: string;
  preferredLanguage: SupportedLanguage;
  emailVerifiedAt?: string | null;
  source: MemberSource;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemberDocument {
  id: string;
  memberId: string;
  kind: DocumentKind;
  originalName: string;
  storedName: string;
  mime: string;
  size: number;
  sha256: string;
  uploadedAt: string;
}

export interface ContributionPlan {
  id: string;
  name: string;
  period: PeriodType;
  amountEtb: number;
  appliesTo?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface Payment {
  id: string;
  memberId: string;
  planId?: string | null;
  regionId: string;
  amountEtb: number;
  period: PeriodType;
  periodStart: string;
  periodEnd: string;
  method: PaymentMethod;
  reference?: string | null;
  bank?: string | null;
  receivedBy: string;
  receiptNo: string;
  status: PaymentStatus;
  paidAt: string;
  note?: string | null;
  isDemo?: boolean;
  createdAt?: string;
}

export interface Announcement {
  id: string;
  slug: string;
  type: AnnouncementType;
  title: I18nString;
  summary: I18nString;
  body: I18nString;
  attachmentUrl?: string | null;
  externalLink?: string | null;
  organizationName?: string | null;
  location?: string | null;
  deadline?: string | null;
  eventStartAt?: string | null;
  eventEndAt?: string | null;
  registrationUrl?: string | null;
  registrationOpen: boolean;
  publishedAt?: string | null;
  status: AnnouncementStatus;
  coverImageUrl?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Program {
  id: string;
  slug: string;
  icon: string;
  title: I18nString;
  summary: I18nString;
  body: I18nString;
  sortOrder: number;
  isActive: boolean;
}

export interface Objective {
  id: string;
  kind: ObjectiveKind;
  title: I18nString;
  description: I18nString;
  sortOrder: number;
}

export interface Partner {
  id: string;
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Activity {
  id: string;
  title: I18nString;
  description: I18nString;
  activityDate: string;
  imageUrl?: string | null;
  isPublic: boolean;
  createdAt?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: string;
}

export interface NewsletterSubscriber {
  id: string;
  name?: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: any;
  after?: any;
  ip?: string;
  createdAt: string;
}

export interface SmsCampaign {
  id: string;
  name: string;
  message: string;
  audienceFilter: Record<string, any>;
  status: SmsCampaignStatus;
  scheduledAt?: string | null;
  createdBy: string;
  totals: {
    targetCount: number;
    sentCount: number;
    failedCount: number;
  };
  createdAt: string;
}

export interface SmsLog {
  id: string;
  campaignId?: string | null;
  memberId?: string | null;
  phone: string;
  message: string;
  status: 'sent' | 'failed' | 'delivered';
  providerMessageId?: string | null;
  error?: string | null;
  sentAt: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      admin?: AuthUser;
    }
  }
}
