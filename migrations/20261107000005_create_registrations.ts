import type { Pool } from 'pg';

export async function up(pool: Pool | any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      qualification TEXT,
      field_of_study TEXT,
      organization TEXT,
      zone TEXT,
      id_type TEXT NOT NULL,
      id_number TEXT NOT NULL,
      id_document_path TEXT NOT NULL,
      credential_doc_paths JSONB NOT NULL DEFAULT '[]',
      otp_verified BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'pending_otp',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_registrations_phone ON registrations(phone);
    CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
  `);

  // Add alias camelCase columns for direct compatibility with all queries
  const cols = [
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "fullName" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "fieldOfStudy" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "idType" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "idNumber" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "idDocumentPath" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "credentialDocPaths" JSONB DEFAULT '[]'`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "otpVerified" BOOLEAN DEFAULT false`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`
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
    await pool.query(`DROP TABLE IF EXISTS registrations;`);
  } catch {
    // Ignore
  }
}
