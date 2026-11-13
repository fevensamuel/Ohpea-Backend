import type { Pool } from 'pg';

import * as m1 from '../../migrations/20261107000001_add_slug_to_programs.js';
import * as m2 from '../../migrations/20261107000002_add_slug_to_announcements.js';
import * as m3 from '../../migrations/20261107000003_add_is_published_to_programs.js';
import * as m4 from '../../migrations/20261107000004_add_is_published_to_partners.js';
import * as m5 from '../../migrations/20261107000005_create_registrations.js';
import * as m6 from '../../migrations/20261107000006_create_otp_codes.js';
import * as m7 from '../../migrations/20261107000007_add_source_to_messages.js';
import * as m8 from '../../migrations/20261107000008_ensure_announcement_translations.js';
import * as m9 from '../../migrations/20261107000009_create_woredas.js';
import * as m10 from '../../migrations/20261107000010_unify_contact_messages.js';
import * as m11 from '../../migrations/20261107000011_public_enum_constraints.js';
import * as m12 from '../../migrations/20261107000012_add_otp_verified_at.js';
import * as m13 from '../../migrations/20261111000013_add_description_to_contribution_plans.js';
import * as m14 from '../../migrations/20261112000014_add_full_registration_fields.js';
import * as m15 from '../../migrations/20261113000015_add_demo_flags.js';
import * as m16 from '../../migrations/20261114000016_add_missing_registration_fields.js';

export const allMigrations = [
  { name: '20261107000001_add_slug_to_programs', up: m1.up, down: m1.down },
  { name: '20261107000002_add_slug_to_announcements', up: m2.up, down: m2.down },
  { name: '20261107000003_add_is_published_to_programs', up: m3.up, down: m3.down },
  { name: '20261107000004_add_is_published_to_partners', up: m4.up, down: m4.down },
  { name: '20261107000005_create_registrations', up: m5.up, down: m5.down },
  { name: '20261107000006_create_otp_codes', up: m6.up, down: m6.down },
  { name: '20261107000007_add_source_to_messages', up: m7.up, down: m7.down },
  { name: '20261107000008_ensure_announcement_translations', up: m8.up, down: m8.down },
  { name: '20261107000009_create_woredas', up: m9.up, down: m9.down },
  { name: '20261107000010_unify_contact_messages', up: m10.up, down: m10.down },
  { name: '20261107000011_public_enum_constraints', up: m11.up, down: m11.down },
  { name: '20261107000012_add_otp_verified_at', up: m12.up, down: m12.down },
  { name: '20261111000013_add_description_to_contribution_plans', up: m13.up, down: m13.down },
  { name: '20261112000014_add_full_registration_fields', up: m14.up, down: m14.down },
  { name: '20261113000015_add_demo_flags', up: m15.up, down: m15.down },
  { name: '20261114000016_add_missing_registration_fields', up: m16.up, down: m16.down },
];

/**
 * Runs all migrations in order. Each migration is applied once and recorded
 * in a _migrations tracking table (or equivalent) so it never runs twice.
 */
export async function runAllMigrations(pool: Pool | any): Promise<void> {
  console.log('[Migrations] Starting...');

  // Ensure a tracking table exists so we only run each migration once
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Get the list of migrations that already ran
  const appliedRes = await pool.query('SELECT name FROM _migrations');
  const applied = new Set<string>(appliedRes.rows.map((r: any) => r.name));

  for (const migration of allMigrations) {
    if (applied.has(migration.name)) {
      console.log(`[Migrations] Already applied: ${migration.name}`);
      continue;
    }

    try {
      console.log(`[Migrations] Applying: ${migration.name}`);
      await migration.up(pool);
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [migration.name]);
      console.log(`[Migrations] ✓ Applied: ${migration.name}`);
    } catch (err: any) {
      console.error(`[Migrations] ✗ Failed: ${migration.name}`, err.message);
      throw err;
    }
  }

  console.log('[Migrations] All migrations complete.');
}