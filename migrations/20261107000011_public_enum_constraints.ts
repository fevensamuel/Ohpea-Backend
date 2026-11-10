import type { Pool } from 'pg';

/**
 * Migration: public_enum_constraints
 * Adds DB CHECK constraints for registrations.id_type, registrations.status,
 * and newsletter_subscribers.language after cleaning up existing rows.
 */
export async function up(pool: Pool | any): Promise<void> {
  // 1. Clean up registrations.id_type and add constraint
  try {
    await pool.query(`
      UPDATE registrations
      SET id_type = 'fayda'
      WHERE id_type NOT IN ('fayda', 'passport', 'kebele', 'driver') OR id_type IS NULL;
    `);

    // Drop previous constraint if exists
    await pool.query(`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_registrations_id_type;`);

    await pool.query(`
      ALTER TABLE registrations
      ADD CONSTRAINT chk_registrations_id_type
      CHECK (id_type IN ('fayda', 'passport', 'kebele', 'driver'));
    `);
  } catch (err: any) {
    console.warn('[Migration Notice: chk_registrations_id_type]', err.message);
  }

  // 2. Clean up registrations.status and add constraint
  try {
    await pool.query(`
      UPDATE registrations
      SET status = 'pending_otp'
      WHERE status NOT IN ('pending_otp', 'pending_review', 'approved', 'rejected') OR status IS NULL;
    `);

    await pool.query(`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_registrations_status;`);

    await pool.query(`
      ALTER TABLE registrations
      ADD CONSTRAINT chk_registrations_status
      CHECK (status IN ('pending_otp', 'pending_review', 'approved', 'rejected'));
    `);
  } catch (err: any) {
    console.warn('[Migration Notice: chk_registrations_status]', err.message);
  }

  // 3. Ensure language column on newsletter_subscribers and add constraint
  try {
    await pool.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS language TEXT;`);

    await pool.query(`
      UPDATE newsletter_subscribers
      SET language = NULL
      WHERE language IS NOT NULL AND language NOT IN ('en', 'om', 'am');
    `);

    await pool.query(`ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS chk_subscribers_language;`);

    await pool.query(`
      ALTER TABLE newsletter_subscribers
      ADD CONSTRAINT chk_subscribers_language
      CHECK (language IS NULL OR language IN ('en', 'om', 'am'));
    `);
  } catch (err: any) {
    console.warn('[Migration Notice: chk_subscribers_language]', err.message);
  }
}

export async function down(pool: Pool | any): Promise<void> {
  try {
    await pool.query(`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_registrations_id_type;`);
  } catch {
    // Ignore
  }
  try {
    await pool.query(`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_registrations_status;`);
  } catch {
    // Ignore
  }
  try {
    await pool.query(`ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS chk_subscribers_language;`);
  } catch {
    // Ignore
  }
}
