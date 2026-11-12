import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPool, query } from '../../backend/database.js';
import { PRIVATE_UPLOAD_PATH } from '../../config/multer.js';

export interface RegistrationInput {
  fullName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  membershipCategory?: string;
  nationality?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  businessTin?: string;
  skills?: string;
  expertiseAreas?: string[] | string;
  interests?: string[] | string;
  qualification?: string;
  fieldOfStudy?: string;
  organization?: string;
  zone?: string;
  idType?: string;
  idNumber?: string;
}

export class DuplicateRegistrationError extends Error {
  constructor() {
    super('A member with this phone number, email address, or ID number already exists.');
    this.name = 'DuplicateRegistrationError';
  }
}

function isStringArrayInput(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.every((item) => typeof item === 'string');
  if (typeof value !== 'string') return false;

  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.every((item) => typeof item === 'string');
  } catch {
    // Multipart clients may submit these fields as comma-separated strings.
  }
  return true;
}

function toStringArray(value: string[] | string | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);

  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed.map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Treat ordinary multipart text as a comma-separated list.
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function validateRegistrationInput(
  body: RegistrationInput,
  idDocumentFile?: Express.Multer.File
): { isValid: boolean; fields: Record<string, string> } {
  const fields: Record<string, string> = {};

  const fullName = (body.fullName || '').trim();
  if (!fullName || fullName.length < 2 || fullName.length > 120) {
    fields.fullName = 'Full name is required and must be between 2 and 120 characters';
  }

  const phone = (body.phone || '').trim();
  const ethiopianPhoneRegex = /^\+251(9|7)\d{8}$/;
  if (!phone || !ethiopianPhoneRegex.test(phone)) {
    fields.phone = 'must be a valid Ethiopian number (+2519... or +2517...)';
  }

  if (body.email && body.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      fields.email = 'Invalid email address';
    }
  }

  const allowedGenders = ['male', 'female', 'unspecified'];
  if (body.gender && !allowedGenders.includes(body.gender.trim().toLowerCase())) {
    fields.gender = 'gender must be one of: male, female, unspecified';
  }

  const allowedMembershipCategories = ['Professional', 'Entrepreneur', 'Corporate', 'Associate'];
  if (body.membershipCategory && !allowedMembershipCategories.includes(body.membershipCategory.trim())) {
    fields.membershipCategory = 'membershipCategory must be one of: Professional, Entrepreneur, Corporate, Associate';
  }

  if (body.dateOfBirth) {
    const dateOfBirth = body.dateOfBirth.trim();
    const parsedDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dateOfBirth) {
      fields.dateOfBirth = 'dateOfBirth must be a valid date in YYYY-MM-DD format';
    }
  }

  if (!isStringArrayInput(body.expertiseAreas)) {
    fields.expertiseAreas = 'expertiseAreas must be an array of strings';
  }
  if (!isStringArrayInput(body.interests)) {
    fields.interests = 'interests must be an array of strings';
  }

  const allowedIdTypes = ['fayda', 'passport', 'kebele', 'driver'];
  const idType = (body.idType || '').trim().toLowerCase();
  if (!idType || !allowedIdTypes.includes(idType)) {
    fields.idType = 'idType must be one of: fayda, passport, kebele, driver';
  }

  const idNumber = (body.idNumber || '').trim();
  if (!idNumber) {
    fields.idNumber = 'idNumber is required';
  }

  if (!idDocumentFile) {
    fields.idDocument = 'ID document file is required (PDF, JPG, or PNG under 5MB)';
  } else {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimes.includes(idDocumentFile.mimetype)) {
      fields.idDocument = 'Only PDF, JPG, and PNG files are accepted';
    }
  }

  return {
    isValid: Object.keys(fields).length === 0,
    fields,
  };
}

export async function processRegistrationFilesAndSave(
  body: RegistrationInput,
  idDocumentFile: Express.Multer.File,
  credentialFiles: Express.Multer.File[] = []
): Promise<{ memberId: string; memberNo: string }> {
  const pool = await getPool();
  const client = await pool.connect();
  const memberId = crypto.randomUUID();
  const year = new Date().getFullYear();
  let memberDir: string | undefined;
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const idType = body.idType?.trim().toLowerCase() || 'fayda';
    const idNumber = body.idNumber?.trim() || '';
    const pepper = process.env.SERVER_PEPPER || 'ohpea_pepper_2026';
    const idHash = crypto.createHash('sha256').update(`${idType}:${idNumber}:${pepper}`).digest('hex');
    const email = body.email?.trim().toLowerCase() || null;
    const duplicate = await client.query(
      `SELECT id FROM members
       WHERE phone = $1 OR ($2::text IS NOT NULL AND email = $2) OR id_number_hash = $3
       LIMIT 1`,
      [body.phone?.trim() || '', email, idHash]
    );
    if (duplicate.rows.length > 0) {
      throw new DuplicateRegistrationError();
    }

    const memberCount = await client.query(
      `SELECT COUNT(*)::int AS count FROM members WHERE member_no LIKE $1`,
      [`OHPEA-${year}-%`]
    );
    const memberNo = `OHPEA-${year}-${String(Number(memberCount.rows[0].count) + 1).padStart(5, '0')}`;
    const memberEmail = email || `${memberNo.toLowerCase()}@ohpea.org`;

    memberDir = path.join(PRIVATE_UPLOAD_PATH, 'members', memberId);
    fs.mkdirSync(memberDir, { recursive: true });

    const documentFiles = [
      { file: idDocumentFile, kind: 'id' },
      ...credentialFiles.map((file) => ({ file, kind: 'credential' })),
    ];

    await client.query(
      `INSERT INTO members (
        id, member_no, full_name, phone, email, gender, date_of_birth,
        membership_category, nationality, business_tin, skills, expertise_areas, interests,
        emergency_contact_name, emergency_contact_phone,
        graduation_level_id, occupation_type, sector_id, field_of_study_id,
        professional_category, organization_name, region_id, town,
        id_type, id_number_hash, id_number_last4, registration_status, membership_status, source,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15,
        'grad-first_degree', 'private', 'sec-other', 'fos-other',
        $16, $17, 'reg-east-shewa', $18,
        $19, $20, $21, 'pending', 'pending', 'online',
        NOW(), NOW()
      )`,
      [
        memberId,
        memberNo,
        body.fullName?.trim() || '',
        body.phone?.trim() || '',
        memberEmail,
        body.gender?.trim().toLowerCase() || 'unspecified',
        body.dateOfBirth?.trim() || null,
        body.membershipCategory?.trim() || null,
        body.nationality?.trim() || null,
        body.businessTin?.trim() || null,
        body.skills?.trim() || null,
        toStringArray(body.expertiseAreas),
        toStringArray(body.interests),
        body.emergencyContactName?.trim() || null,
        body.emergencyContactPhone?.trim() || null,
        body.qualification?.trim() || null,
        body.organization?.trim() || null,
        body.zone?.trim() || 'Adama',
        idType,
        idHash,
        idNumber.slice(-4) || '0000',
      ]
    );

    for (const [index, document] of documentFiles.entries()) {
      const extension = path.extname(document.file.originalname).toLowerCase() || '.bin';
      const storedName = `${document.kind}-${index + 1}-${crypto.randomBytes(6).toString('hex')}${extension}`;
      const destinationPath = path.join(memberDir, storedName);
      fs.renameSync(document.file.path, destinationPath);
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(destinationPath)).digest('hex');

      await client.query(
        `INSERT INTO member_documents (
          id, member_id, kind, original_name, stored_name, mime, size, sha256, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          crypto.randomUUID(),
          memberId,
          document.kind,
          document.file.originalname,
          storedName,
          document.file.mimetype,
          document.file.size,
          sha256,
        ]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    return { memberId, memberNo };
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    if (memberDir) {
      fs.rmSync(memberDir, { recursive: true, force: true });
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Internal helper to promote a verified registration into a member record.
 * Called by admin approval, NOT called automatically from registration routes.
 */
export async function promoteRegistrationToMember(registrationId: string): Promise<string> {
  const regRes = await query(`SELECT * FROM registrations WHERE id = $1`, [registrationId]);
  if (regRes.rows.length === 0) {
    throw new Error('Registration not found');
  }

  const reg = regRes.rows[0];
  const memberId = crypto.randomUUID();
  const year = new Date().getFullYear();
  const randNum = Math.floor(Math.random() * 89999) + 10000;
  const memberNo = `OHPEA-${year}-${randNum}`;

  const pepper = process.env.SERVER_PEPPER || 'ohpea_default_pepper';
  const idHash = crypto.createHash('sha256').update(`${reg.id_type}:${reg.id_number}:${pepper}`).digest('hex');
  const idLast4 = reg.id_number.slice(-4) || '0000';

  await query(
    `INSERT INTO members (
      id, member_no, full_name, phone, email, gender,
      graduation_level_id, occupation_type, sector_id, field_of_study_id,
      region_id, town, id_type, id_number_hash, id_number_last4,
      registration_status, membership_status, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, 'unspecified',
      'grad-first_degree', 'private', 'sec-other', 'fos-other',
      'reg-east-shewa', $6, $7, $8, $9,
      'approved', 'pending', NOW(), NOW()
    )`,
    [
      memberId,
      memberNo,
      reg.full_name,
      reg.phone,
      reg.email || `${memberNo.toLowerCase()}@ohpea.org`,
      reg.zone || 'Adama',
      reg.id_type,
      idHash,
      idLast4,
    ]
  );

  await query(`UPDATE registrations SET status = 'approved', updated_at = NOW() WHERE id = $1`, [registrationId]);

  return memberId;
}
