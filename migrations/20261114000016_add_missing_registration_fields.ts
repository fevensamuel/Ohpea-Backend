import type { Pool } from 'pg';

/**
 * Migration: add all missing registration form fields to members table
 */
export async function up(pool: Pool | any): Promise<void> {
  await pool.query(`
    ALTER TABLE members
      ADD COLUMN IF NOT EXISTS membership_category TEXT,
      ADD COLUMN IF NOT EXISTS nationality TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
      ADD COLUMN IF NOT EXISTS business_tin TEXT,
      ADD COLUMN IF NOT EXISTS year_established INT,
      ADD COLUMN IF NOT EXISTS institution_name TEXT,
      ADD COLUMN IF NOT EXISTS skills TEXT,
      ADD COLUMN IF NOT EXISTS expertise_areas JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS zone_sub_city TEXT,
      ADD COLUMN IF NOT EXISTS woreda TEXT,
      ADD COLUMN IF NOT EXISTS employment_status TEXT;
  `);
}

export async function down(pool: Pool | any): Promise<void> {
  await pool.query(`
    ALTER TABLE members
      DROP COLUMN IF EXISTS membership_category,
      DROP COLUMN IF EXISTS nationality,
      DROP COLUMN IF EXISTS emergency_contact_name,
      DROP COLUMN IF EXISTS emergency_contact_phone,
      DROP COLUMN IF EXISTS business_tin,
      DROP COLUMN IF EXISTS year_established,
      DROP COLUMN IF EXISTS institution_name,
      DROP COLUMN IF EXISTS skills,
      DROP COLUMN IF EXISTS expertise_areas,
      DROP COLUMN IF EXISTS interests,
      DROP COLUMN IF EXISTS zone_sub_city,
      DROP COLUMN IF EXISTS woreda,
      DROP COLUMN IF EXISTS employment_status;
  `);
}