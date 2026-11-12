import crypto from 'crypto';
import { query } from '../../backend/database.js';
import { afroSmsService } from '../afroSmsService.js';

// Phone send rate tracker (in-memory sliding window: 3 sends / 10 minutes per phone)
const phoneSendTimestamps = new Map<string, number[]>();

export function checkPhoneRateLimit(phone: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const timestamps = (phoneSendTimestamps.get(phone) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= 3) {
    return false; // Rate limit exceeded
  }

  timestamps.push(now);
  phoneSendTimestamps.set(phone, timestamps);
  return true;
}

export async function sendRegistrationOtp(
  phone: string
): Promise<{ success: boolean; error?: string; code?: string }> {
  const ethiopianPhoneRegex = /^\+251(9|7)\d{8}$/;
  if (!phone || !ethiopianPhoneRegex.test(phone)) {
    return { success: false, error: 'Phone must be a valid Ethiopian number (+2519... or +2517...)' };
  }

  if (!checkPhoneRateLimit(phone)) {
    return { success: false, error: 'Too many OTP requests for this phone number. Please wait 10 minutes.' };
  }

  // 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Upsert into otp_codes
  const existing = await query('SELECT phone FROM otp_codes WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) {
    await query(
      `UPDATE otp_codes SET
        code_hash = $1, "codeHash" = $1,
        expires_at = $2, "expiresAt" = $2,
        attempts = 0,
        consumed = false,
        created_at = NOW(), "createdAt" = NOW()
       WHERE phone = $3`,
      [codeHash, expiresAt, phone]
    );
  } else {
    await query(
      `INSERT INTO otp_codes (
        phone, code_hash, "codeHash", expires_at, "expiresAt", attempts, consumed, created_at, "createdAt"
      ) VALUES ($1, $2, $2, $3, $3, 0, false, NOW(), NOW())`,
      [phone, codeHash, expiresAt]
    );
  }

  // Send SMS via existing AfroMessage service
  const msg = `OHPEA: Your public registration verification code is ${code}. It expires in 5 minutes.`;
  await afroSmsService.sendSms(phone, msg);

  return {
    success: true,
    code: process.env.NODE_ENV === 'production' ? undefined : code,
  };
}

export async function verifyRegistrationOtp(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!phone || !code) {
    return { success: false, error: 'Phone and verification code are required' };
  }

  const res = await query(
    `SELECT phone, code_hash, "codeHash", expires_at, "expiresAt", attempts, consumed FROM otp_codes WHERE phone = $1`,
    [phone]
  );

  if (res.rows.length === 0) {
    return { success: false, error: 'Invalid or expired code' };
  }

  const row = res.rows[0];
  const storedHash = row.code_hash || row.codeHash;
  const expiresAt = new Date(row.expires_at || row.expiresAt);
  const attempts = Number(row.attempts || 0);
  const consumed = Boolean(row.consumed);

  if (consumed || expiresAt.getTime() < Date.now() || attempts >= 5) {
    return { success: false, error: 'Invalid or expired code' };
  }

  const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');

  if (inputHash !== storedHash) {
    await query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1`, [phone]);
    return { success: false, error: 'Invalid or expired code' };
  }

  // Code matches -> mark consumed and record verified_for_phone_at timestamp
  await query(
    `UPDATE otp_codes SET
      consumed = true,
      verified_for_phone_at = NOW(),
      "verifiedForPhoneAt" = NOW()
     WHERE phone = $1`,
    [phone]
  );

  return { success: true };
}
