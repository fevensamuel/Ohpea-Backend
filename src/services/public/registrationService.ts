/**
 * Public registration -> creates a PENDING member (visible in the admin "Pending registrations").
 * Accepts both the canonical contract field names and the field names used by the public website form.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPool, query, hashIdNumber, dbOperations } from '../../backend/database.js';
import { PRIVATE_UPLOAD_PATH } from '../../config/multer.js';
import { normalizeEthiopianPhone, ETHIOPIAN_MOBILE } from '../../utils/phone.js';

export type RegistrationInput = Record<string, any>;

export class DuplicateRegistrationError extends Error {
  constructor() {
    super('A member with this phone number, email address, or ID number already exists.');
    this.name = 'DuplicateRegistrationError';
  }
}

export class RegistrationValidationError extends Error {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super('Validation failed');
    this.name = 'RegistrationValidationError';
    this.fields = fields;
  }
}

export interface UploadedDoc {
  file: Express.Multer.File;
  kind: 'id' | 'credential' | 'cv';
  category?: string;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const first = (b: RegistrationInput, ...keys: string[]): string => {
  for (const k of keys) {
    const v = text(b[k]);
    if (v) return v;
  }
  return '';
};

function toList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map((x) => text(x)).filter(Boolean);
  const raw = text(value);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => text(x)).filter(Boolean);
  } catch {
    /* comma separated */
  }
  return raw.split(',').map((x) => x.trim()).filter(Boolean);
}

const ALLOWED_CATEGORIES = ['Professional', 'Entrepreneur', 'Corporate', 'Associate'];
const ALLOWED_ID_TYPES = ['fayda', 'passport', 'kebele', 'driver'];
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

export function isPhoneOtpRequired(): boolean {
  return process.env.FEATURE_PHONE_OTP === 'true';
}

/** Synchronous field validation. Returns field -> message. */
export function validateRegistrationInput(
  body: RegistrationInput,
  idDocumentFile?: Express.Multer.File,
  extraDocs: UploadedDoc[] = []
): { isValid: boolean; fields: Record<string, string> } {
  const fields: Record<string, string> = {};

  const fullName = text(body.fullName);
  if (fullName.length < 2 || fullName.length > 120) fields.fullName = 'Full name is required (2-120 characters)';

  const phone = normalizeEthiopianPhone(text(body.phone));
  if (!ETHIOPIAN_MOBILE.test(phone)) fields.phone = 'Enter a valid Ethiopian mobile number (+2519... or +2517...)';

  const email = text(body.email);
  if (!email) fields.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Invalid email address';

  const gender = text(body.gender).toLowerCase();
  if (gender && !['male', 'female', 'unspecified'].includes(gender)) fields.gender = 'Gender must be male, female or unspecified';

  const category = text(body.membershipCategory);
  if (category && !ALLOWED_CATEGORIES.includes(category)) fields.membershipCategory = `Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`;

  const dob = text(body.dateOfBirth);
  if (dob) {
    const parsed = new Date(`${dob}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob) {
      fields.dateOfBirth = 'Use a valid date (YYYY-MM-DD)';
    }
  }

  const idNumber = first(body, 'idNumber', 'nationalId');
  if (!idNumber) fields.idNumber = 'ID number is required';
  const idType = first(body, 'idType').toLowerCase() || 'fayda';
  if (!ALLOWED_ID_TYPES.includes(idType)) fields.idType = `Must be one of: ${ALLOWED_ID_TYPES.join(', ')}`;

  if (!first(body, 'regionId', 'region')) fields.region = 'Region is required';

  const consent = first(body, 'consent', 'declaration').toLowerCase();
  if (consent !== 'true' && consent !== 'on' && consent !== '1') fields.consent = 'You must accept the declaration';

  if (!idDocumentFile) fields.idDocument = 'ID document file is required (PDF, JPG or PNG, max 5MB)';
  else if (!ALLOWED_MIMES.includes(idDocumentFile.mimetype)) fields.idDocument = 'Only PDF, JPG and PNG files are accepted';
  if (!extraDocs.some((doc) => doc.category === 'cvCompanyProfile')) fields.cvCompanyProfile = 'CV or company profile is required';
  for (const doc of extraDocs) {
    if (!ALLOWED_MIMES.includes(doc.file.mimetype)) fields[doc.category || 'documents'] = 'Only PDF, JPG and PNG files are accepted';
  }

  return { isValid: Object.keys(fields).length === 0, fields };
}

/** Find a lookup row id by id, code or English label (case-insensitive). */
async function resolveLookup(table: string, value: string): Promise<string | null> {
  if (!value) return null;
  const res = await query(`SELECT id, code, label FROM ${table}`);
  const v = value.toLowerCase();
  for (const row of res.rows) {
    let label: any = row.label;
    if (typeof label === 'string') {
      try { label = JSON.parse(label); } catch { label = { en: label }; }
    }
    if (String(row.id).toLowerCase() === v || String(row.code).toLowerCase() === v || String(label?.en || '').toLowerCase() === v) {
      return row.id;
    }
  }
  return null;
}

async function resolveRegion(value: string): Promise<string | null> {
  const res = await query('SELECT id, name FROM regions WHERE is_active = true');
  const v = value.toLowerCase();
  for (const row of res.rows) {
    let name: any = row.name;
    if (typeof name === 'string') {
      try { name = JSON.parse(name); } catch { name = { en: name }; }
    }
    const names = [name?.en, name?.om, name?.am].filter(Boolean).map((x: string) => x.toLowerCase());
    if (String(row.id).toLowerCase() === v || String(row.id).toLowerCase() === `reg-${v}` || names.includes(v)) return row.id;
  }
  return null;
}

async function assertPhoneVerified(phone: string): Promise<void> {
  const res = await query('SELECT verified_for_phone_at AS verified_at FROM otp_codes WHERE phone = $1', [phone]);
  const at = res.rows[0]?.verified_at ? new Date(res.rows[0].verified_at).getTime() : 0;
  if (!at || Date.now() - at > 15 * 60 * 1000) {
    throw new RegistrationValidationError({ phone: 'Please verify this phone number with the SMS code first' });
  }
}

export async function processRegistrationFilesAndSave(
  body: RegistrationInput,
  idDocumentFile: Express.Multer.File,
  extraDocs: UploadedDoc[] = []
): Promise<{ memberId: string; memberNo: string }> {
  const phone = normalizeEthiopianPhone(text(body.phone));
  const email = text(body.email).toLowerCase();
  const idType = first(body, 'idType').toLowerCase() || 'fayda';
  const idNumber = first(body, 'idNumber', 'nationalId');

  // Resolve lookups (real rows only; nothing is defaulted)
  const errors: Record<string, string> = {};
  const regionId = await resolveRegion(first(body, 'regionId', 'region'));
  if (!regionId) errors.region = 'Unknown region';

  const gradInput = first(body, 'graduationLevelId', 'highestQualification');
  const graduationLevelId = gradInput ? await resolveLookup('lookup_graduation_levels', gradInput) : null;
  if (gradInput && !graduationLevelId) errors.highestQualification = 'Unknown qualification';

  const fieldInput = first(body, 'fieldOfStudyId', 'fieldOfStudy');
  const fieldOfStudyId = fieldInput ? await resolveLookup('lookup_fields_of_study', fieldInput) : null;
  if (fieldInput && !fieldOfStudyId) errors.fieldOfStudy = 'Unknown field of study';

  const subSectors = toList(body.industrySubSectors);
  const sectorInput = first(body, 'sectorId') || subSectors[0] || '';
  const sectorId = sectorInput ? await resolveLookup('lookup_sectors', sectorInput) : null;

  const occ = first(body, 'occupationType').toLowerCase();
  const occupationType = ['private', 'government', 'other'].includes(occ) ? occ : null;

  if (Object.keys(errors).length) throw new RegistrationValidationError(errors);
  if (isPhoneOtpRequired()) await assertPhoneVerified(phone);

  const memberId = crypto.randomUUID();
  const memberDir = path.join(PRIVATE_UPLOAD_PATH, 'members', memberId);
  const docs: UploadedDoc[] = [{ file: idDocumentFile, kind: 'id', category: 'idDocument' }, ...extraDocs];

  const pool = await getPool();
  const client = await pool.connect();
  let started = false;
  try {
    const dup = await client.query(
      `SELECT id FROM members WHERE phone = $1 OR LOWER(email) = $2 OR id_number_hash = $3 LIMIT 1`,
      [phone, email, hashIdNumber(idType, idNumber)]
    );
    if (dup.rows.length > 0) throw new DuplicateRegistrationError();

    fs.mkdirSync(memberDir, { recursive: true });
    await client.query('BEGIN');
    started = true;

    const memberNo = await dbOperations.getNextMemberNumber();
    const yearEstablished = parseInt(text(body.yearEstablished), 10);

    await client.query(
      `INSERT INTO members (
        id, member_no, full_name, phone, email, gender, date_of_birth,
        membership_category, nationality, business_tin, skills, expertise_areas, interests,
        emergency_contact_name, emergency_contact_phone,
        employment_status, year_established, zone_sub_city, woreda, institution_name,
        graduation_level_id, occupation_type, sector_id, field_of_study_id,
        professional_category, organization_name, job_title, region_id, town,
        id_type, id_number_hash, id_number_last4, registration_status, membership_status,
        preferred_language, source, phone_verified_at, consent_at, created_at, updated_at, registration_details
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,'pending','pending',$33,'online',$34,NOW(),NOW(),NOW(),$35
      )`,
      [
        memberId,
        memberNo,
        text(body.fullName),
        phone,
        email,
        text(body.gender).toLowerCase() || 'unspecified',
        text(body.dateOfBirth) || null,
        text(body.membershipCategory) || null,
        text(body.nationality) || null,
        text(body.businessTin) || null,
        first(body, 'skills', 'coreSkills') || null,
        toList(body.expertiseAreas ?? body.areasOfExpertise),
        toList(body.interests ?? body.areasOfInterest),
        text(body.emergencyContactName) || null,
        text(body.emergencyContactPhone) || null,
        text(body.employmentStatus) || null,
        Number.isFinite(yearEstablished) ? yearEstablished : null,
        text(body.zoneSubCity) || null,
        text(body.woreda) || null,
        text(body.institutionName) || null,
        graduationLevelId,
        occupationType,
        sectorId,
        fieldOfStudyId,
        first(body, 'professionalCategory') || subSectors.join(', ') || null,
        first(body, 'organizationName', 'organization') || null,
        text(body.jobTitle) || null,
        regionId,
        first(body, 'town', 'cityTown') || null,
        idType,
        hashIdNumber(idType, idNumber),
        idNumber.slice(-4),
        ['en', 'om', 'am', 'ar', 'fr'].includes(text(body.preferredLanguage)) ? text(body.preferredLanguage) : 'en',
        isPhoneOtpRequired() ? new Date().toISOString() : null,
        JSON.stringify({
          submittedFields: body,
          ...(body.officialFormData && typeof body.officialFormData === 'object' ? body.officialFormData : {}),
          // Keep fields not represented by first-class member columns available to the admin.
          secondaryPhone: text(body.secondaryPhone) || null,
          emergencyRelationship: text(body.emergencyRelationship) || null,
          alternateEmergencyPhone: text(body.alternateEmergencyPhone) || null,
          workplaceLocation: text(body.workplaceLocation) || null,
          yearsInCurrentRole: text(body.yearsInCurrentRole) || null,
          yearEstablishedEmployees: text(body.yearEstablishedEmployees) || null,
          education: body.education ?? null,
          certifications: body.certifications ?? null,
          experience: body.experience ?? null,
          language: body.language ?? null,
          technicalSkills: text(body.technicalSkills) || null,
          totalExperienceYears: text(body.totalExperienceYears) || null,
          paymentMethod: body.paymentMethod ?? null,
          bankPlatformUsed: text(body.bankPlatformUsed) || null,
          transactionReference: text(body.transactionReference) || null,
          amountPaid: text(body.amountPaid) || null,
          declarationDate: text(body.declarationDate) || null,
          applicantFullName: text(body.applicantFullName) || null,
          applicantSignature: text(body.applicantSignature) || null,
        }),
      ]
    );

    for (const [index, doc] of docs.entries()) {
      const ext = path.extname(doc.file.originalname).toLowerCase() || '.bin';
      const storedName = `${doc.kind}-${index + 1}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      const dest = path.join(memberDir, storedName);
      fs.renameSync(doc.file.path, dest);
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
      await client.query(
        `INSERT INTO member_documents (id, member_id, kind, document_category, original_name, stored_name, mime, size, sha256, uploaded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [crypto.randomUUID(), memberId, doc.kind, doc.category || doc.kind, doc.file.originalname, storedName, doc.file.mimetype, doc.file.size, sha256]
      );
    }

    await client.query('COMMIT');
    started = false;
    return { memberId, memberNo };
  } catch (error) {
    if (started) await client.query('ROLLBACK');
    fs.rmSync(memberDir, { recursive: true, force: true });
    for (const d of docs) fs.rmSync(d.file.path, { force: true });
    throw error;
  } finally {
    client.release();
  }
}
