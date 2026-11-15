import type { Pool } from 'pg';

export async function up(pool: Pool | any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      phone TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      consumed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Also ensure quoted camelCase columns for direct queries
  const cols = [
    `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS "codeHash" TEXT`,
    `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ`,
    `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`
  ];
  for (const col of cols) {
    try {
      await pool.query(col);
    } catch {
      // Ignore
    }
  }
}

export async function down(pool: Pool | any): Promise<void> {
  try {
    await pool.query(`DROP TABLE IF EXISTS otp_codes;`);
  } catch {
    // Ignore
  }
}
