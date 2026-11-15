import type { Pool } from 'pg';

export async function up(pool: Pool | any): Promise<void> {
  // Ensure source column on contact_messages
  await pool.query(`
    ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin';
  `);

  // Ensure 'full_name' or 'fullName' column exists or can be written
  try {
    await pool.query(`
      ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS full_name TEXT;
    `);
  } catch {
    // Ignore
  }

  // Create messages table or view if not exists
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        name TEXT,
        full_name TEXT,
        email TEXT NOT NULL,
        phone TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        source TEXT NOT NULL DEFAULT 'public_website',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch {
    // Ignore
  }
}

export async function down(pool: Pool | any): Promise<void> {
  try {
    await pool.query(`ALTER TABLE contact_messages DROP COLUMN IF EXISTS source;`);
  } catch {
    // Ignore
  }
}
