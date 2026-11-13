import type { Pool } from 'pg';

export async function up(pool: Pool | any): Promise<void> {
  await pool.query(`
    ALTER TABLE contribution_plans
      ADD COLUMN IF NOT EXISTS description TEXT;
  `);
}

export async function down(pool: Pool | any): Promise<void> {
  await pool.query(`
    ALTER TABLE contribution_plans
      DROP COLUMN IF EXISTS description;
  `);
}