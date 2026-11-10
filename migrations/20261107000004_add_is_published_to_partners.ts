import type { Pool } from 'pg';

export async function up(pool: Pool | any): Promise<void> {
  await pool.query(`
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;
  `);
  try {
    await pool.query(`
      ALTER TABLE partners ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;
    `);
  } catch {
    // Ignore
  }
}

export async function down(pool: Pool | any): Promise<void> {
  try {
    await pool.query(`ALTER TABLE partners DROP COLUMN IF EXISTS is_published;`);
  } catch {
    // Ignore
  }
}
