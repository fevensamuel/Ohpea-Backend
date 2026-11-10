import type { Pool } from 'pg';

/**
 * Migration: add_otp_verified_at
 * Adds verified_for_phone_at TIMESTAMPTZ column to otp_codes to support
 * out-of-order registration self-promotion when OTP verification precedes file upload.
 */
export async function up(pool: Pool | any): Promise<void> {
  await pool.query(`
    ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS verified_for_phone_at TIMESTAMPTZ NULL;
  `);

  try {
    await pool.query(`
      ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS "verifiedForPhoneAt" TIMESTAMPTZ NULL;
    `);
  } catch {
    // Ignore
  }
}

export async function down(pool: Pool | any): Promise<void> {
  try {
    await pool.query(`ALTER TABLE otp_codes DROP COLUMN IF EXISTS verified_for_phone_at;`);
    await pool.query(`ALTER TABLE otp_codes DROP COLUMN IF EXISTS "verifiedForPhoneAt";`);
  } catch {
    // Ignore
  }
}
