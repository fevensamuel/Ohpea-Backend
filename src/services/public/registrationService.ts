import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from '../../backend/database.js';

export interface RegistrationInput {
  fullName?: string;
  email?: string;
  phone?: string;
  qualification?: string;
  fieldOfStudy?: string;
  organization?: string;
  zone?: string;
  idType?: string;
  idNumber?: string;
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
): Promise<string> {
  const registrationId = crypto.randomUUID();
  const destDir = path.resolve('uploads/registrations', registrationId);

  fs.mkdirSync(destDir, { recursive: true });

  // Move ID document
  const idDocExt = path.extname(idDocumentFile.originalname) || '.bin';
  const idDocDestName = `id_document${idDocExt}`;
  const idDocDestPath = path.join(destDir, idDocDestName);
  fs.renameSync(idDocumentFile.path, idDocDestPath);

  // Move credentials
  const credentialPaths: string[] = [];
  let index = 1;
  for (const credFile of credentialFiles) {
    const credExt = path.extname(credFile.originalname) || '.bin';
    const credDestName = `credential_${index}${credExt}`;
    const credDestPath = path.join(destDir, credDestName);
    fs.renameSync(credFile.path, credDestPath);
    credentialPaths.push(credDestPath);
    index++;
  }

  // Insert into registrations table (both snake_case and quoted camelCase)
  await query(
    `INSERT INTO registrations (
      id, full_name, email, phone, qualification, field_of_study, organization, zone,
      id_type, id_number, id_document_path, credential_doc_paths, otp_verified, status,
      "fullName", "fieldOfStudy", "idType", "idNumber", "idDocumentPath", "credentialDocPaths", "otpVerified",
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, false, 'pending_otp',
      $2, $6, $9, $10, $11, $12, false,
      NOW(), NOW()
    )`,
    [
      registrationId,
      body.fullName?.trim() || '',
      body.email?.trim() || null,
      body.phone?.trim() || '',
      body.qualification?.trim() || null,
      body.fieldOfStudy?.trim() || null,
      body.organization?.trim() || null,
      body.zone?.trim() || null,
      body.idType?.trim().toLowerCase() || 'fayda',
      body.idNumber?.trim() || '',
      idDocDestPath,
      JSON.stringify(credentialPaths),
    ]
  );

  // Self-promote if OTP was already verified for this phone within the last 15 minutes
  const cleanPhone = body.phone?.trim() || '';
  if (cleanPhone) {
    const otpCheck = await query(
      `SELECT phone, verified_for_phone_at, "verifiedForPhoneAt", consumed
       FROM otp_codes
       WHERE phone = $1 AND consumed = true`,
      [cleanPhone]
    );

    if (otpCheck.rows.length > 0) {
      const vAt = otpCheck.rows[0].verified_for_phone_at || otpCheck.rows[0].verifiedForPhoneAt;
      if (vAt) {
        const verifiedTime = new Date(vAt).getTime();
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
        if (verifiedTime >= fifteenMinutesAgo) {
          await query(
            `UPDATE registrations
             SET otp_verified = true, "otpVerified" = true, status = 'pending_review', updated_at = NOW()
             WHERE id = $1`,
            [registrationId]
          );
        }
      }
    }
  }

  return registrationId;
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
