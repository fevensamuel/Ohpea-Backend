import type { Pool } from 'pg';

const demoAnnouncementSlugs = [
  'call-for-research-papers-2026',
  'annual-tourism-convention-2026',
  'vacancy-training-coordinator',
  'call-for-proposals-community-tourism',
  'workshop-food-safety-haccp',
  'mou-sinke-bank-credit-facility',
  'vacancy-senior-research-analyst',
  'b2b-trade-delegation-dubai-2027',
];

export async function up(pool: Pool | any): Promise<void> {
  await pool.query(
    'ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;'
  );
  await pool.query(
    'ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;'
  );
  await pool.query(
    'UPDATE announcements SET is_demo = true WHERE slug = ANY($1::text[])',
    [demoAnnouncementSlugs]
  );
}

export async function down(pool: Pool | any): Promise<void> {
  await pool.query('ALTER TABLE announcements DROP COLUMN IF EXISTS is_demo;');
  await pool.query('ALTER TABLE activities DROP COLUMN IF EXISTS is_demo;');
}
