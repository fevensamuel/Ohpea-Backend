import type { Pool } from 'pg';

/**
 * Preserve the complete official OHPEA membership application in a structured JSONB
 * payload while keeping the existing first-class member columns and document model.
 */
export async function up(pool: Pool | any): Promise<void> {
  await pool.query(`
    ALTER TABLE members
      ADD COLUMN IF NOT EXISTS registration_details JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);
  await pool.query(`
    ALTER TABLE member_documents
      ADD COLUMN IF NOT EXISTS document_category TEXT NOT NULL DEFAULT 'credential';
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_members_registration_details_gin
    ON members USING GIN (registration_details);
  `);
}

export async function down(pool: Pool | any): Promise<void> {
  await pool.query(`DROP INDEX IF EXISTS idx_members_registration_details_gin;`);
  await pool.query(`
    ALTER TABLE member_documents DROP COLUMN IF EXISTS document_category;
    ALTER TABLE members DROP COLUMN IF EXISTS registration_details;
  `);
}
