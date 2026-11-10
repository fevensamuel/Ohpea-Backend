import type { Pool } from 'pg';

/**
 * Migration: unify_contact_messages
 * Reconciles contact messages table into canonical `contact_messages` table.
 * If separate `messages` table exists, copies rows over and drops `messages` (or creates a view).
 */
export async function up(pool: Pool | any): Promise<void> {
  // Ensure canonical contact_messages has all necessary columns
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      full_name TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      source TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Ensure full_name and source columns exist
  try {
    await pool.query(`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS full_name TEXT;`);
  } catch {
    // Ignore
  }
  try {
    await pool.query(`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin';`);
  } catch {
    // Ignore
  }

  // Check if messages table exists and is not a view
  try {
    const tableCheck = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_name = 'messages'
    `);

    if (tableCheck.rows.length > 0 && tableCheck.rows[0].table_type !== 'VIEW') {
      // Copy rows from loser messages table into canonical contact_messages
      await pool.query(`
        INSERT INTO contact_messages (id, name, full_name, email, phone, subject, message, status, source, created_at)
        SELECT id, COALESCE(name, full_name, ''), full_name, email, phone, subject, message, COALESCE(status, 'new'), COALESCE(source, 'public_website'), COALESCE(created_at, NOW())
        FROM messages
        ON CONFLICT (id) DO NOTHING;
      `);

      // Drop the loser table
      await pool.query(`DROP TABLE IF EXISTS messages;`);
    }
  } catch (err: any) {
    console.warn('[Migration Notice: unify_contact_messages]', err.message);
  }

  // Create or replace view messages so any legacy SQL querying `messages` transparently works
  try {
    await pool.query(`CREATE OR REPLACE VIEW messages AS SELECT * FROM contact_messages;`);
  } catch {
    // If views aren't supported in mock DB, ignore
  }
}

export async function down(pool: Pool | any): Promise<void> {
  try {
    await pool.query(`DROP VIEW IF EXISTS messages;`);
  } catch {
    // Ignore
  }
}
