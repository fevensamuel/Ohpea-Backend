import type { Pool } from 'pg';

const memberColumns = [
  'membership_category TEXT',
  'nationality TEXT',
  'business_tin TEXT',
  'skills TEXT',
  'expertise_areas TEXT[]',
  'interests TEXT[]',
  'emergency_contact_name TEXT',
  'emergency_contact_phone TEXT',
];

export async function up(pool: Pool | any): Promise<void> {
  for (const column of memberColumns) {
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS ${column};`);
  }

  await pool.query(`ALTER TABLE members DROP CONSTRAINT IF EXISTS members_gender_check;`);
  await pool.query(`ALTER TABLE members DROP CONSTRAINT IF EXISTS chk_members_gender;`);
  await pool.query(`
    UPDATE members
    SET gender = 'unspecified'
    WHERE gender IS NULL OR gender NOT IN ('male', 'female', 'unspecified');
  `);
  await pool.query(`
    ALTER TABLE members
    ADD CONSTRAINT chk_members_gender
    CHECK (gender IN ('male', 'female', 'unspecified'));
  `);
}

export async function down(pool: Pool | any): Promise<void> {
  await pool.query(`ALTER TABLE members DROP CONSTRAINT IF EXISTS chk_members_gender;`);
  for (const column of [
    'membership_category',
    'nationality',
    'business_tin',
    'skills',
    'expertise_areas',
    'interests',
    'emergency_contact_name',
    'emergency_contact_phone',
  ]) {
    await pool.query(`ALTER TABLE members DROP COLUMN IF EXISTS ${column};`);
  }
}
