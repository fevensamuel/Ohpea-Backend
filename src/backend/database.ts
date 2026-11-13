/**
 * PostgreSQL Database Module with SSL auto-detect, schema migrations, and seed data.
 * Mirrors Delta_API architecture with raw SQL and Pool.
 */

import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { newDb, DataType } from 'pg-mem';
import { SupportedLanguage } from '../types.js';
import { runAllMigrations } from './migrationRunner.js';

const { Pool } = pg;

// SSL auto-detect logic matching Delta_API
function shouldEnableSsl(): boolean {
  if (process.env.DATABASE_SSL === 'true') return true;
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('sslmode=require')) return true;
  if (
    dbUrl.includes('render.com') ||
    dbUrl.includes('neon.tech') ||
    dbUrl.includes('supabase.co') ||
    dbUrl.includes('aws')
  ) {
    return true;
  }
  return false;
}

let activePool: any = null;
let isInMemoryFallback = false;

function createPostgresPool() {
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ohpea';
  const ssl = shouldEnableSsl() ? { rejectUnauthorized: false } : false;
  return new Pool({
    connectionString,
    ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  });
}

function createInMemoryPool() {
  const mem = newDb();
  // Register postgres functions needed
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => crypto.randomUUID(),
  });
  mem.public.registerFunction({
    name: 'now',
    implementation: () => new Date(),
  });
  mem.public.registerFunction({
    name: 'date_trunc',
    args: [DataType.text, DataType.timestamptz],
    returns: DataType.timestamptz,
    implementation: (unit: string, date: any) => {
      const d = new Date(date);
      if (unit === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
      if (unit === 'year') return new Date(d.getFullYear(), 0, 1);
      return d;
    },
  });
  mem.public.registerFunction({
    name: 'to_char',
    args: [DataType.timestamptz, DataType.text],
    returns: DataType.text,
    implementation: (date: any, fmt: string) => {
      const d = new Date(date);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${d.getFullYear()}-${m}`;
    },
  });
  const MemPool = mem.adapters.createPg().Pool;
  return new MemPool();
}

export async function getPool() {
  if (activePool) return activePool;

  const candidatePool = createPostgresPool();
  try {
    const client = await candidatePool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[Database] Connected to external PostgreSQL database.');
    activePool = candidatePool;
    return activePool;
  } catch (err: any) {
    console.log('[Database] Active Engine: Embedded PostgreSQL (Dev/Preview)');
    isInMemoryFallback = true;
    activePool = createInMemoryPool();
    return activePool;
  }
}

export async function query(text: string, params?: any[]) {
  const pool = await getPool();
  return pool.query(text, params);
}

export async function testConnection(): Promise<{ connected: boolean; engine: string; error?: string }> {
  try {
    const pool = await getPool();
    const res = await pool.query('SELECT 1 as ok');
    return {
      connected: res.rows?.[0]?.ok === 1 || res.rows?.[0]?.ok === '1',
      engine: isInMemoryFallback ? 'Postgres In-Memory (Dev/Preview Engine)' : 'PostgreSQL Database',
    };
  } catch (err: any) {
    return {
      connected: false,
      engine: 'Unknown',
      error: err.message,
    };
  }
}

// Convert snake_case row to camelCase
export function mapRow(row: any): any {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(mapRow);

  const mapped: any = {};
  for (const [key, val] of Object.entries(row)) {
    const camel = key.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());

    // Coerce numeric types
    if (
      (key.endsWith('_etb') || key.endsWith('_count') || key === 'amount' || key === 'amount_etb' || key === 'sort_order' || key === 'size' || key === 'attempts') &&
      val !== null &&
      val !== undefined
    ) {
      mapped[camel] = Number(val);
    } else if (val instanceof Date) {
      mapped[camel] = val.toISOString();
    } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      mapped[camel] = val;
    } else {
      mapped[camel] = val;
    }
  }
  return mapped;
}

/**
 * Initialize Tables and Idempotent Migrations
 */
export async function initDatabase(): Promise<void> {
  const pool = await getPool();

  console.log('[Database] Running schema migrations...');

  const schemaSql = `
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions TEXT[] NOT NULL DEFAULT '{}',
      region_id TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      must_change_password BOOLEAN NOT NULL DEFAULT false,
      last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name JSONB NOT NULL,
      parent_id TEXT,
      type TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS lookup_sectors (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label JSONB NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS lookup_fields_of_study (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label JSONB NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS lookup_graduation_levels (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label JSONB NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS lookup_occupation_types (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label JSONB NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      member_no TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      gender TEXT NOT NULL DEFAULT 'unspecified',
      date_of_birth DATE,
      membership_category TEXT,
      nationality TEXT,
      business_tin TEXT,
      skills TEXT,
      expertise_areas TEXT[],
      interests TEXT[],
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      graduation_level_id TEXT NOT NULL,
      occupation_type TEXT NOT NULL,
      sector_id TEXT NOT NULL,
      field_of_study_id TEXT NOT NULL,
      professional_category TEXT,
      organization_name TEXT,
      job_title TEXT,
      region_id TEXT NOT NULL,
      town TEXT,
      id_type TEXT NOT NULL,
      id_number_hash TEXT NOT NULL,
      id_number_last4 TEXT NOT NULL,
      registration_status TEXT NOT NULL DEFAULT 'pending',
      membership_status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      preferred_language TEXT NOT NULL DEFAULT 'en',
      email_verified_at TIMESTAMPTZ,
      source TEXT NOT NULL DEFAULT 'online',
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS member_documents (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INT NOT NULL,
      sha256 TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contribution_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      period TEXT NOT NULL,
      amount_etb NUMERIC(12,2) NOT NULL,
      applies_to TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      plan_id TEXT,
      region_id TEXT NOT NULL,
      amount_etb NUMERIC(12,2) NOT NULL,
      period TEXT NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      method TEXT NOT NULL,
      reference TEXT,
      bank TEXT,
      received_by TEXT NOT NULL,
      receipt_no TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      note TEXT,
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      title JSONB NOT NULL,
      summary JSONB NOT NULL,
      body JSONB NOT NULL,
      attachment_url TEXT,
      external_link TEXT,
      organization_name TEXT,
      location TEXT,
      deadline DATE,
      event_start_at TIMESTAMPTZ,
      event_end_at TIMESTAMPTZ,
      registration_url TEXT,
      registration_open BOOLEAN NOT NULL DEFAULT false,
      published_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'published',
      cover_image_url TEXT,
      created_by TEXT NOT NULL,
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT NOT NULL,
      title JSONB NOT NULL,
      summary JSONB NOT NULL,
      body JSONB NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS objectives (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title JSONB NOT NULL,
      description JSONB NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      website_url TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      title JSONB NOT NULL,
      description JSONB NOT NULL,
      activity_date DATE NOT NULL,
      image_url TEXT,
      is_public BOOLEAN NOT NULL DEFAULT true,
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    );

    CREATE OR REPLACE VIEW settings AS SELECT * FROM site_settings;

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS registration_otps (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      verified_at TIMESTAMPTZ,
      ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      before JSONB,
      after JSONB,
      ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sms_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      audience_filter JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      totals JSONB NOT NULL DEFAULT '{"targetCount":0,"sentCount":0,"failedCount":0}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      member_id TEXT,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_message_id TEXT,
      error TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ui_translations (
      id TEXT PRIMARY KEY,
      lang TEXT NOT NULL,
      namespace TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Phase 4 growth tables
    CREATE TABLE IF NOT EXISTS member_accounts (
      member_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      last_login TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS job_posts (
      id TEXT PRIMARY KEY,
      title JSONB NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      type TEXT,
      deadline DATE,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS business_listings (
      id TEXT PRIMARY KEY,
      title JSONB NOT NULL,
      category TEXT NOT NULL,
      contact TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS investment_opportunities (
      id TEXT PRIMARY KEY,
      title JSONB NOT NULL,
      sector TEXT NOT NULL,
      description JSONB NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      title JSONB NOT NULL,
      category TEXT NOT NULL,
      file_url TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS international_relations (
      id TEXT PRIMARY KEY,
      organization TEXT NOT NULL,
      country TEXT NOT NULL,
      partnership_type TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS region_resources (
      id TEXT PRIMARY KEY,
      region_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INT NOT NULL,
      issued_date DATE NOT NULL,
      notes TEXT
    );
  `;

  // Execute schema
  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err: any) {
      console.warn(`[Database Migration Notice] ${err.message}`);
    }
  }

  // Execute versioned migrations
  await runAllMigrations(pool);

  // Seed default data
  await seedInitialData(pool);

  if (process.env.SEED_DEMO_DATA === 'true') {
    await seedDemoData(pool);
  }
}

/**
 * Seed initial administrative data, lookups, regions, plans, and content
 */
async function seedInitialData(pool: any): Promise<void> {
  // 1. Initial SuperAdmin from environment
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@ohpea.org';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Admin12345!ChangeMe';

  const existingAdmin = await pool.query('SELECT id FROM admin_users WHERE email = $1', [adminEmail]);
  if (existingAdmin.rows.length === 0) {
    const passwordHash = await bcrypt.hash(adminPass, 10);
    const superAdminPermissions = [
      'dashboard',
      'members',
      'members.approve',
      'members.edit',
      'members.export',
      'payments',
      'payments.record',
      'payments.void',
      'contributions.dashboard',
      'announcements',
      'programs',
      'partners',
      'activities',
      'sms',
      'subscribers',
      'messages',
      'regions',
      'lookups',
      'settings.site',
      'settings.contact',
      'translations',
      'audit',
      'jobs',
      'b2b',
      'investments',
      'resources',
      'international',
      'region-resources',
    ];

    await pool.query(
      `INSERT INTO admin_users (id, username, email, password_hash, full_name, role, permissions, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        crypto.randomUUID(),
        'superadmin',
        adminEmail,
        passwordHash,
        'OHPEA Central Administrator',
        'SuperAdmin',
        superAdminPermissions,
        true,
        true, // Must change password on first login
      ]
    );
    console.log(`[Database Seed] Created initial SuperAdmin: ${adminEmail}`);
  }

  // 2. Regions (Oromia Zones & City Administrations)
  const regionsCount = await pool.query('SELECT count(*) as count FROM regions');
  if (parseInt(regionsCount.rows[0].count, 10) === 0) {
    const zones = [
      { id: 'reg-arsi', name: { en: 'Arsi Zone', om: 'Godina Arsii', am: 'አርሲ ዞን' }, type: 'zone' },
      { id: 'reg-west-arsi', name: { en: 'West Arsi Zone', om: 'Godina Arsii Lixaa', am: 'ምዕራብ አርሲ ዞን' }, type: 'zone' },
      { id: 'reg-bale', name: { en: 'Bale Zone', om: 'Godina Baalee', am: 'ባሌ ዞን' }, type: 'zone' },
      { id: 'reg-east-bale', name: { en: 'East Bale Zone', om: 'Godina Baalee Bahaa', am: 'ምስራቅ ባሌ ዞን' }, type: 'zone' },
      { id: 'reg-borena', name: { en: 'Borena Zone', om: 'Godina Booranaa', am: 'ቦረና ዞን' }, type: 'zone' },
      { id: 'reg-guji', name: { en: 'Guji Zone', om: 'Godina Gujii', am: 'ጉጂ ዞን' }, type: 'zone' },
      { id: 'reg-west-guji', name: { en: 'West Guji Zone', om: 'Godina Gujii Lixaa', am: 'ምዕራብ ጉጂ ዞን' }, type: 'zone' },
      { id: 'reg-east-shewa', name: { en: 'East Shewa Zone', om: 'Godina Shawaa Bahaa', am: 'ምስራቅ ሸዋ ዞን' }, type: 'zone' },
      { id: 'reg-west-shewa', name: { en: 'West Shewa Zone', om: 'Godina Shawaa Lixaa', am: 'ምዕራብ ሸዋ ዞን' }, type: 'zone' },
      { id: 'reg-north-shewa', name: { en: 'North Shewa Zone', om: 'Godina Shawaa Kaabaa', am: 'ሰሜን ሸዋ ዞን' }, type: 'zone' },
      { id: 'reg-sw-shewa', name: { en: 'Southwest Shewa Zone', om: 'Godina Shawaa Kibba-Lixaa', am: 'ደቡብ ምዕራብ ሸዋ ዞን' }, type: 'zone' },
      { id: 'reg-jimma', name: { en: 'Jimma Zone', om: 'Godina Jimmaa', am: 'ጅማ ዞን' }, type: 'zone' },
      { id: 'reg-illubabor', name: { en: 'Illubabor Zone', om: 'Godina Iluu Abbaa Booraa', am: 'ኢሉባቦር ዞን' }, type: 'zone' },
      { id: 'reg-buno-bedele', name: { en: 'Buno Bedele Zone', om: 'Godina Bunnoo Baddallee', am: 'ቡኖ በደሌ ዞን' }, type: 'zone' },
      { id: 'reg-east-wollega', name: { en: 'East Wollega Zone', om: 'Godina Wallagga Bahaa', am: 'ምስራቅ ወለጋ ዞን' }, type: 'zone' },
      { id: 'reg-west-wollega', name: { en: 'West Wollega Zone', om: 'Godina Wallagga Lixaa', am: 'ምዕራብ ወለጋ ዞን' }, type: 'zone' },
      { id: 'reg-horo-guduru', name: { en: 'Horo Guduru Wollega Zone', om: 'Godina Horroo Guduruu Wallaggaa', am: 'ሆሮ ጉዱሩ ወለጋ ዞን' }, type: 'zone' },
      { id: 'reg-kellem-wollega', name: { en: 'Kellem Wollega Zone', om: 'Godina Qellam Wallaggaa', am: 'ቀለም ወለጋ ዞን' }, type: 'zone' },
      { id: 'reg-east-hararghe', name: { en: 'East Hararghe Zone', om: 'Godina Harargee Bahaa', am: 'ምስራቅ ሐረርጌ ዞን' }, type: 'zone' },
      { id: 'reg-west-hararghe', name: { en: 'West Hararghe Zone', om: 'Godina Harargee Lixaa', am: 'ምዕራብ ሐረርጌ ዞን' }, type: 'zone' },
      { id: 'reg-finfinne-special', name: { en: 'Finfinne Surrounding Special Zone', om: 'Godina Addaa Oromiyaa Naannawa Finfinnee', am: 'የፊንፊኔ ዙሪያ ልዩ ዞን' }, type: 'zone' },
      { id: 'reg-adama-city', name: { en: 'Adama City Administration', om: 'Bulchiinsa Magaalaa Adaamaa', am: 'አዳማ ከተማ አስተዳደር' }, type: 'city' },
      { id: 'reg-shashemene-city', name: { en: 'Shashemene City Administration', om: 'Bulchiinsa Magaalaa Shashamannee', am: 'ሻሸመኔ ከተማ አስተዳደር' }, type: 'city' },
      { id: 'reg-jimma-city', name: { en: 'Jimma City Administration', om: 'Bulchiinsa Magaalaa Jimmaa', am: 'ጅማ ከተማ አስተዳደር' }, type: 'city' },
      { id: 'reg-bishoftu-city', name: { en: 'Bishoftu City Administration', om: 'Bulchiinsa Magaalaa Bishooftuu', am: 'ቢሾፍቱ ከተማ አስተዳደር' }, type: 'city' },
      { id: 'reg-addis-ababa', name: { en: 'Addis Ababa', om: 'Finfinnee', am: 'አዲስ አበባ' }, type: 'region' },
      { id: 'reg-other', name: { en: 'Other Region', om: 'Naannoo Biraa', am: 'ሌላ ክልል' }, type: 'region' },
    ];

    let order = 1;
    for (const z of zones) {
      await pool.query(
        'INSERT INTO regions (id, name, type, sort_order, is_active) VALUES ($1, $2, $3, $4, true)',
        [z.id, JSON.stringify(z.name), z.type, order++]
      );
    }
  }

  // 3. Lookup: Sectors
  const sectorsCount = await pool.query('SELECT count(*) as count FROM lookup_sectors');
  if (parseInt(sectorsCount.rows[0].count, 10) === 0) {
    const sectors = [
      { code: 'hotel', label: { en: 'Hotel', om: 'Hoteela', am: 'ሆቴል' } },
      { code: 'restaurant', label: { en: 'Restaurant', om: 'Manneen Nyaataa', am: 'ሬስቶራንት' } },
      { code: 'lodge_resort', label: { en: 'Lodge / Resort', om: 'Loojii / Rizoortii', am: 'ሎጅ / ሪዞርት' } },
      { code: 'tour_operator', label: { en: 'Tour Operator', om: 'Dhaabbata Daawwanna', am: 'ቱር ኦፕሬተር' } },
      { code: 'travel_agency', label: { en: 'Travel Agency', om: 'Eejensii Imalaa', am: 'የትራቭል ኤጀንሲ' } },
      { code: 'cafe', label: { en: 'Cafe', om: 'Kaafee', am: 'ካፌ' } },
      { code: 'catering', label: { en: 'Catering', om: 'Keetiriingii', am: 'ኬተሪንግ' } },
      { code: 'training_institution', label: { en: 'Training Institution / College', om: 'Dhaabbata Leenjii / Koolleejjii', am: 'የስልጠና ተቋም / ኮሌጅ' } },
      { code: 'tourism_bureau', label: { en: 'Tourism Bureau / Government Office', om: 'Biiroo Turizimii / Waajjira Mootummaa', am: 'የቱሪዝም ቢሮ / የመንግስት መስሪያ ቤት' } },
      { code: 'other', label: { en: 'Other Sector', om: 'Damee Biraa', am: 'ሌላ ዘርፍ' } },
    ];
    let i = 1;
    for (const s of sectors) {
      await pool.query(
        'INSERT INTO lookup_sectors (id, code, label, sort_order, is_active) VALUES ($1, $2, $3, $4, true)',
        [`sec-${s.code}`, s.code, JSON.stringify(s.label), i++]
      );
    }
  }

  // 4. Lookup: Fields of study
  const fieldsCount = await pool.query('SELECT count(*) as count FROM lookup_fields_of_study');
  if (parseInt(fieldsCount.rows[0].count, 10) === 0) {
    const fields = [
      { code: 'tourism_mgmt', label: { en: 'Tourism Management', om: 'Bulchiinsa Turizimii', am: 'የቱሪዝም አስተዳደር' } },
      { code: 'hospitality_mgmt', label: { en: 'Hospitality Management', om: 'Bulchiinsa Simannaa', am: 'ሆስፒታሊቲ ማኔጅመንት' } },
      { code: 'hotel_mgmt', label: { en: 'Hotel Management', om: 'Bulchiinsa Hoteelaa', am: 'የሆቴል አስተዳደር' } },
      { code: 'culinary_arts', label: { en: 'Culinary Arts & Food Preparation', om: 'Aartii Qophii Nyaataa', am: 'የምግብ ዝግጅት እና ሙያ' } },
      { code: 'event_mgmt', label: { en: 'Event Management', om: 'Bulchiinsa Sagantaalee', am: 'የክስተት አስተዳደር' } },
      { code: 'anthropology', label: { en: 'Anthropology & Heritage', om: 'Antiroppooloojii fi Hambaa', am: 'አንትሮፖሎጂ እና ቅርስ' } },
      { code: 'geography', label: { en: 'Geography & Ecotourism', om: 'Ji\'oogiraafii fi Ikkooturizimii', am: 'ጂኦግራፊ እና ኢኮቱሪዝም' } },
      { code: 'other', label: { en: 'Other Field of Study', om: 'Muummee Biraa', am: 'ሌላ የትምህርት መስክ' } },
    ];
    let i = 1;
    for (const f of fields) {
      await pool.query(
        'INSERT INTO lookup_fields_of_study (id, code, label, sort_order, is_active) VALUES ($1, $2, $3, $4, true)',
        [`fos-${f.code}`, f.code, JSON.stringify(f.label), i++]
      );
    }
  }

  // 5. Lookup: Graduation levels
  const gradCount = await pool.query('SELECT count(*) as count FROM lookup_graduation_levels');
  if (parseInt(gradCount.rows[0].count, 10) === 0) {
    const levels = [
      { code: 'diploma', label: { en: 'Diploma', om: 'Dippiloomaa', am: 'ዲፕሎማ' } },
      { code: 'first_degree', label: { en: 'First Degree (BSc/BA)', om: 'Digrii Jalqabaa (BSc/BA)', am: 'የመጀመሪያ ዲግሪ' } },
      { code: 'second_degree', label: { en: 'Second Degree (MSc/MA)', om: 'Digrii Lammaffaa (MSc/MA)', am: 'ሁለተኛ ዲግሪ' } },
      { code: 'third_degree', label: { en: 'Third Degree (PhD)', om: 'Digrii Sadaffaa (PhD)', am: 'ሶስተኛ ዲግሪ (ዶክትሬት)' } },
    ];
    let i = 1;
    for (const l of levels) {
      await pool.query(
        'INSERT INTO lookup_graduation_levels (id, code, label, sort_order, is_active) VALUES ($1, $2, $3, $4, true)',
        [`grad-${l.code}`, l.code, JSON.stringify(l.label), i++]
      );
    }
  }

  // 6. Lookup: Occupation Types
  const occCount = await pool.query('SELECT count(*) as count FROM lookup_occupation_types');
  if (parseInt(occCount.rows[0].count, 10) === 0) {
    const occs = [
      { code: 'private', label: { en: 'Private Sector', om: 'Dhuunfaa', am: 'የግል ዘርፍ' } },
      { code: 'government', label: { en: 'Government Sector', om: 'Mootummaa', am: 'የመንግስት ዘርፍ' } },
      { code: 'other', label: { en: 'Other', om: 'Kan Biraa', am: 'ሌላ' } },
    ];
    let i = 1;
    for (const o of occs) {
      await pool.query(
        'INSERT INTO lookup_occupation_types (id, code, label, sort_order, is_active) VALUES ($1, $2, $3, $4, true)',
        [`occ-${o.code}`, o.code, JSON.stringify(o.label), i++]
      );
    }
  }

  // 7. Contribution Plans
  const plansCount = await pool.query('SELECT count(*) as count FROM contribution_plans');
  if (parseInt(plansCount.rows[0].count, 10) === 0) {
    await pool.query(
      `INSERT INTO contribution_plans (id, name, period, amount_etb, applies_to, is_active)
       VALUES 
       ('plan-monthly-100', 'Standard Monthly Contribution', 'monthly', 100.00, 'all', true),
       ('plan-yearly-1000', 'Standard Annual Contribution', 'yearly', 1000.00, 'all', true)`
    );
  }

  // 8. Objectives (General, Official, Main, Specific)
  const objCount = await pool.query('SELECT count(*) as count FROM objectives');
  if (parseInt(objCount.rows[0].count, 10) === 0) {
    // General objective
    await pool.query(
      `INSERT INTO objectives (id, kind, title, description, sort_order) VALUES ($1, $2, $3, $4, $5)`,
      [
        'obj-general',
        'general',
        JSON.stringify({
          en: 'General Objective of OHPEA',
          om: 'Kaayyoo Waliigalaa OHPEA',
          am: 'የOHPEA አጠቃላይ ዓላማ',
        }),
        JSON.stringify({
          en: 'To promote the development, professionalism, quality, and competitiveness of the hospitality and tourism industry in Oromia by strengthening cooperation among hospitality professionals, improving service standards, and supporting sustainable tourism development.',
          om: 'Misooma, ogeessummaa, qulqullina fi dorgomtummaa industirii simannaa fi turizimii Oromiyaa keessatti walta\'iinsa ogeeyyii cimsuun, sadarkaa tajaajilaa fooyyessuun fi misooma turizimii itti fufiinsa qabu deeggaruu.',
          am: 'በኦሮሚያ የእንግዳ ተቀባይነትና ቱሪዝም ዘርፍ ልማትን፣ ሙያዊ ብቃትን፣ ጥራትንና ተወዳዳሪነትን በባለሙያዎች መካከል ትብብርን በማጠናከር ማሳደግ።',
        }),
        1,
      ]
    );

    // 8 Official Objectives
    const officialObjs = [
      'Represent and protect the interests and rights of its members.',
      'Organize conferences, trade exhibitions, professional meetings, and other events to foster market linkages and expand business opportunities for members.',
      'Promote market access and expand business opportunities for members.',
      'Provide up-to-date information to members and the tourism industry through research, market intelligence, industry analysis, and the collection of innovative ideas.',
      'Promote community-based tourism initiatives, including ecotourism, the promotion of traditional cuisine, and the preservation and development of local hospitality traditions, ensuring that communities benefit from tourism.',
      'Establish partnerships with organizations that share similar objectives, both locally and internationally, to contribute to the growth and development of the country\'s hospitality and tourism industry.',
      'Improve the quality of hospitality and tourism services in the country by providing training programmes, facilitating experience-sharing opportunities, and establishing professional competency standards.',
      'Support members in accessing domestic and international training opportunities and participating in business forums and events to broaden their investment opportunities.',
    ];

    let i = 1;
    for (const item of officialObjs) {
      await pool.query(
        `INSERT INTO objectives (id, kind, title, description, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [
          `obj-official-${i}`,
          'official',
          JSON.stringify({ en: `Official Objective ${i}` }),
          JSON.stringify({ en: item }),
          i,
        ]
      );
      i++;
    }

    // 8 Main Objectives
    const mainObjs = [
      'Unite and represent tourism and hospitality professionals in Oromia',
      'Improve skills and service quality through continuous vocational education',
      'Promote sustainable tourism and hospitality investment in the region',
      'Protect members\' interests, ethics and professional welfare',
      'Create employment and business market linkages for practitioners',
      'Encourage ethical, sustainable, and responsible tourism development',
      'Strengthen collaboration between private sector and government entities',
      'Enhance regional competitiveness at national and international levels',
    ];
    let j = 1;
    for (const item of mainObjs) {
      await pool.query(
        `INSERT INTO objectives (id, kind, title, description, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [
          `obj-main-${j}`,
          'main',
          JSON.stringify({ en: `Main Objective ${j}` }),
          JSON.stringify({ en: item }),
          j,
        ]
      );
      j++;
    }
  }

  // 9. Programs (7 core areas)
  const progCount = await pool.query('SELECT count(*) as count FROM programs');
  if (parseInt(progCount.rows[0].count, 10) === 0) {
    const programsList = [
      {
        slug: 'research-and-study',
        icon: 'BookOpen',
        title: { en: 'Research and Study', om: 'Qorannoo fi Qo\'annoo', am: 'ምርምርና ጥናት' },
        summary: { en: 'Conducting in-depth industry research, market intelligence, and sustainable tourism policy studies.', om: 'Qorannoowwan industirii turizimii fi qorannoo gabaa geggeessuu.' },
      },
      {
        slug: 'advocacy',
        icon: 'ShieldCheck',
        title: { en: 'Advocacy & Member Rights', om: 'Falmii fi Mirga Miseensotaa', am: 'ተሟጋችነትና የአባላት መብት' },
        summary: { en: 'Advocating for professional standards, equitable industry regulations, and hospitality workforce welfare.', om: 'Sadarkaa ogummaa fi mirga ogeeyyii kabachiisuu.' },
      },
      {
        slug: 'training-and-awareness',
        icon: 'GraduationCap',
        title: { en: 'Training and Awareness Creation', om: 'Leenjii fi Hubannoo Uumuu', am: 'ስልጠናና ግንዛቤ ማስጨበጥ' },
        summary: { en: 'Accredited professional masterclasses, culinary workshops, customer care excellence, and safety standards.', om: 'Leenjiiwwan ogummaa fi dandeettii simannaa cimsuu.' },
      },
      {
        slug: 'b2b-bridge',
        icon: 'Network',
        title: { en: 'B2B Bridge', om: 'Riqicha Daldalaa B2B', am: 'የንግድ ለንግድ ትስስር (B2B)' },
        summary: { en: 'Connecting hoteliers, tour operators, eco-lodges, transport providers, and suppliers for strategic growth.', om: 'Walitti hidhamiinsa daldalaa uumuu.' },
      },
      {
        slug: 'investment-bridge',
        icon: 'TrendingUp',
        title: { en: 'Investment Bridge', om: 'Riqicha Invastimantii', am: 'የኢንቨስትመንት ድልድይ' },
        summary: { en: 'Facilitating domestic and international hospitality investments across prime Oromia tourist corridors.', om: 'Carraawwan invastimantii turizimii beeksisuu fi deeggaruu.' },
      },
      {
        slug: 'member-networking-jobs',
        icon: 'Briefcase',
        title: { en: 'Member Networking & Job Opportunities', om: 'Walitti Hidhamiinsa fi Hojii Uumuu', am: 'የአባላት ትስስር እና የስራ እድሎች' },
        summary: { en: 'Career matchmaking platform connecting certified professionals with top-tier hospitality employers.', om: 'Miseensotaaf carraa hojii fi walitti dhufeenya uumuu.' },
      },
      {
        slug: 'international-relations',
        icon: 'Globe',
        title: { en: 'International Relations', om: 'Hariiroo Idil-Addunyaa', am: 'ዓለም አቀፍ ግንኙነቶች' },
        summary: { en: 'Building bilateral pacts with global tourism bodies, UN Tourism, hotel syndicates, and cultural associations.', om: 'Dhaabbilee idil-addunyaa waliin michooma uumuu.' },
      },
    ];

    let order = 1;
    for (const p of programsList) {
      await pool.query(
        `INSERT INTO programs (id, slug, icon, title, summary, body, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [
          `prog-${p.slug}`,
          p.slug,
          p.icon,
          JSON.stringify(p.title),
          JSON.stringify(p.summary),
          JSON.stringify({ en: `${p.summary.en} Detailed initiatives and annual program goals managed by OHPEA directorates.` }),
          order++,
        ]
      );
    }
  }

  // 10. Partners
  const partCount = await pool.query('SELECT count(*) as count FROM partners');
  if (parseInt(partCount.rows[0].count, 10) === 0) {
    const partners = [
      { name: 'Ministry of Culture and Tourism', url: 'https://www.tourismethiopia.gov.et' },
      { name: 'Oromia Tourism Bureau', url: 'https://tourismoromia.gov.et' },
      { name: 'Ija Developer', url: 'https://ijadeveloper.com' },
      { name: 'Sinke Bank', url: 'https://sinkebank.com.et' },
    ];
    let i = 1;
    for (const pt of partners) {
      await pool.query(
        'INSERT INTO partners (id, name, logo_url, website_url, sort_order, is_active) VALUES ($1, $2, $3, $4, $5, true)',
        [`partner-${i}`, pt.name, null, pt.url, i]
      );
      i++;
    }
  }

  // 11. Site Settings
  const settingsCount = await pool.query('SELECT count(*) as count FROM site_settings');
  if (parseInt(settingsCount.rows[0].count, 10) === 0) {
    const defaultSettings = [
      {
        key: 'general',
        value: {
          orgName: 'Oromia Hospitality & Tourism Professionals Association',
          orgNameOm: 'Waldaa Ogeeyyii Hojii Simannaa fi Daawwanna Turizimii Oromiyaa',
          shortName: 'OHPEA',
          tagline: 'Advancing Professionalism & Sustainable Tourism in Oromia',
          foundedYear: 2024,
        },
      },
      {
        key: 'contact',
        value: {
          phones: ['+251911223344', '+251711223344'],
          emails: ['info@ohpea.org', 'support@ohpea.org'],
          address: 'Addis Ababa / Finfinne, Bole Sub-City, Oromia, Ethiopia',
          officeHours: 'Monday - Friday: 8:30 AM - 5:30 PM, Saturday: 9:00 AM - 1:00 PM',
          mapLink: 'https://maps.google.com/?q=Bole,Addis+Ababa',
        },
      },
      {
        key: 'socials',
        value: {
          facebook: 'https://facebook.com/ohpea.official',
          telegram: 'https://t.me/ohpea_oromia',
          linkedin: 'https://linkedin.com/company/ohpea',
          twitter: 'https://x.com/ohpea_official',
          youtube: 'https://youtube.com/@ohpea_oromia',
        },
      },
      {
        key: 'membership_rules',
        value: {
          inactiveAfterPeriods: 2, // 2 consecutive unpaid periods marks member at-risk
          currency: 'ETB',
          nationalIdType: 'fayda',
        },
      },
    ];

    for (const s of defaultSettings) {
      await pool.query('INSERT INTO site_settings (key, value) VALUES ($1, $2)', [s.key, JSON.stringify(s.value)]);
    }
  }
}

/**
 * Seed Realistic Demo Data (~150 members, ~600 payments, 8 announcements)
 */
export async function seedDemoData(pool: any): Promise<void> {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    return;
  }

  const existingDemo = await pool.query('SELECT count(*) as count FROM members WHERE is_demo = true');
  if (parseInt(existingDemo.rows[0].count, 10) > 0) {
    return;
  }

  console.log('[Database Seed] Seeding ~150 demo members and ~600 payments for Phase 1 showcase...');

  const firstNamesM = ['Tolasa', 'Girma', 'Bekele', 'Desta', 'Gemechu', 'Taye', 'Kenna', 'Chala', 'Abdisa', 'Mulugeta', 'Feyisa', 'Dawit'];
  const firstNamesF = ['Chaltu', 'Lensa', 'Birtukan', 'Hawani', 'Ayantu', 'Hawi', 'Obsi', 'Sifan', 'Meseret', 'Tigist', 'Meti', 'Bontu'];
  const lastNames = ['Gudeta', 'Benti', 'Dibaba', 'Tola', 'Megersa', 'Abate', 'Worku', 'Alemu', 'Negasa', 'Fufa', 'Bedane', 'Wayesa'];

  const regionsRes = await pool.query('SELECT id, name FROM regions');
  const regionIds = regionsRes.rows.map((r: any) => r.id);

  const sectorsRes = await pool.query('SELECT id FROM lookup_sectors');
  const sectorIds = sectorsRes.rows.map((r: any) => r.id);

  const fieldsRes = await pool.query('SELECT id FROM lookup_fields_of_study');
  const fieldIds = fieldsRes.rows.map((r: any) => r.id);

  const gradRes = await pool.query('SELECT id FROM lookup_graduation_levels');
  const gradIds = gradRes.rows.map((r: any) => r.id);

  const occTypes = ['private', 'government', 'other'];
  const pepper = process.env.SERVER_PEPPER || 'ohpea_pepper_2026';

  const memberIds: { id: string; regionId: string; status: string; memberNo: string; name: string }[] = [];

  for (let i = 1; i <= 150; i++) {
    const isFemale = i % 3 === 0;
    const firstList = isFemale ? firstNamesF : firstNamesM;
    const fName = firstList[i % firstList.length];
    const lName = lastNames[(i * 3) % lastNames.length];
    const fullName = `${fName} ${lName}`;
    const gender = isFemale ? 'female' : 'male';
    const memberNo = `OHPEA-2026-${String(i).padStart(5, '0')}`;
    const phone = `+2519${String(10000000 + i * 23).padStart(8, '0')}`;
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@example.com`;
    const regionId = regionIds[i % regionIds.length];
    const sectorId = sectorIds[i % sectorIds.length];
    const fieldId = fieldIds[i % fieldIds.length];
    const gradId = gradIds[i % gradIds.length];
    const occ = occTypes[i % occTypes.length];
    const idNum = `FAYDA-${100000000 + i}`;
    const idHash = crypto.createHash('sha256').update(`fayda:${idNum}:${pepper}`).digest('hex');
    const idLast4 = String(idNum).slice(-4);

    let regStatus = 'approved';
    let memStatus = 'active';

    if (i > 135) {
      regStatus = 'pending';
      memStatus = 'pending';
    } else if (i > 125) {
      regStatus = 'rejected';
      memStatus = 'inactive';
    } else if (i % 8 === 0) {
      memStatus = 'inactive';
    }

    const memberId = crypto.randomUUID();
    const createdAt = new Date(Date.now() - (150 - i) * 2 * 86400000).toISOString();

    await pool.query(
      `INSERT INTO members (
        id, member_no, full_name, phone, email, gender, graduation_level_id,
        occupation_type, sector_id, field_of_study_id, organization_name, job_title,
        region_id, town, id_type, id_number_hash, id_number_last4,
        registration_status, membership_status, rejection_reason,
        preferred_language, is_demo, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,true,$22,$22)`,
      [
        memberId,
        memberNo,
        fullName,
        phone,
        email,
        gender,
        gradId,
        occ,
        sectorId,
        fieldId,
        `${fName} Hospitality Enterprises`,
        'Department Lead / Manager',
        regionId,
        'Adama',
        'fayda',
        idHash,
        idLast4,
        regStatus,
        memStatus,
        regStatus === 'rejected' ? 'Incomplete educational credential documents.' : null,
        'en',
        createdAt,
      ]
    );

    if (regStatus === 'approved') {
      memberIds.push({ id: memberId, regionId, status: memStatus, memberNo, name: fullName });
    }
  }

  // Seed ~600 payments across last 12 months
  let receiptCounter = 1;
  const methods = ['mobile_money', 'bank_transfer', 'cash'];
  const banks = ['Sinke Bank', 'Commercial Bank of Ethiopia', 'Cooperative Bank of Oromia', 'Telebirr'];

  for (let m = 0; m < memberIds.length; m++) {
    const mem = memberIds[m];
    // Each active member has 4-5 payments over the last 12 months
    const count = mem.status === 'active' ? 5 : 2;
    for (let p = 0; p < count; p++) {
      const monthOffset = p * 2;
      const d = new Date();
      d.setMonth(d.getMonth() - monthOffset);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const periodEnd = `${year}-${String(month).padStart(2, '0')}-28`;
      const receiptNo = `RCT-2026-${String(receiptCounter++).padStart(6, '0')}`;
      const method = methods[(m + p) % methods.length];
      const bank = banks[(m * 2 + p) % banks.length];

      await pool.query(
        `INSERT INTO payments (
          id, member_id, region_id, amount_etb, period, period_start, period_end,
          method, reference, bank, received_by, receipt_no, status, paid_at, is_demo
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)`,
        [
          crypto.randomUUID(),
          mem.id,
          mem.regionId,
          100.0,
          'monthly',
          periodStart,
          periodEnd,
          method,
          `TXN-${Date.now().toString().slice(-6)}-${p}`,
          bank,
          'Finance Admin (Auto-Receipt)',
          receiptNo,
          'paid',
          d.toISOString(),
        ]
      );
    }
  }

  // Seed 8 announcements (vacancies, calls for proposals/research, events)
  const announcements = [
    {
      title: {
        en: 'Call for Tourism Research Papers: Oromia Heritage & Ecotourism Corridors 2026',
        om: 'Wamicha Qorannoo Turizimii: Hambaa fi Ikkooturizimii Oromiyaa 2026',
      },
      slug: 'call-for-research-papers-2026',
      type: 'call_for_research',
      summary: {
        en: 'OHPEA invites researchers and academics to submit papers on sustainable tourism and economic empowerment in Oromia.',
      },
      body: {
        en: 'The Oromia Hospitality & Tourism Professionals Association (OHPEA) announces a competitive grant opportunity for applied tourism research. Selected papers will be published in the inaugural OHPEA Tourism Review and presented at the Annual Tourism Summit.',
      },
      deadline: '2026-12-31',
    },
    {
      title: {
        en: 'Annual Oromia Hospitality & Tourism Convention 2026',
        om: 'Yaa\'ii Waggaa Simannaa fi Turizimii Oromiyaa 2026',
      },
      slug: 'annual-tourism-convention-2026',
      type: 'event',
      summary: {
        en: 'Join 500+ professionals, investors, and hotel leaders in Adama for networking, keynote panels, and B2B linkages.',
      },
      body: {
        en: 'The flagship event brings together industry experts, hospitality academics, tour operators, and public sector leaders.',
      },
      eventStartAt: '2026-11-20T09:00:00Z',
      eventEndAt: '2026-11-22T17:00:00Z',
      registrationOpen: true,
      registrationUrl: 'https://ohpea.org/register-event',
    },
    {
      title: {
        en: 'Vacancy: Regional Tourism Training Coordinator (Central Oromia)',
        om: 'Baniinsa Hojii: Qindeessaa Leenjii Turizimii Gidduugaleessa Oromiyaa',
      },
      slug: 'vacancy-training-coordinator',
      type: 'vacancy',
      summary: {
        en: 'OHPEA is seeking an experienced hospitality instructor to lead vocational training sessions across zone branches.',
      },
      body: {
        en: 'Applicants must possess at least a BA degree in Hospitality Management or Tourism Management with 3+ years experience.',
      },
      deadline: '2026-11-30',
    },
    {
      title: {
        en: 'Call for Proposals: Community-Based Tourism Master Plan for Bale & Guji',
        om: 'Wamicha Yaada Pirojekti: Karoora Turizimii Hawaasaa Baalee fi Gujii',
      },
      slug: 'call-for-proposals-community-tourism',
      type: 'call_for_proposal',
      summary: {
        en: 'Consultancy firm or team of specialists needed to draft a community tourism handbook and marketing plan.',
      },
      body: {
        en: 'In partnership with regional tourism bureaus, OHPEA seeks comprehensive proposals focusing on ecotourism lodges.',
      },
      deadline: '2026-12-15',
    },
    {
      title: {
        en: 'Executive Workshop on Modern Food Safety & HACCP Standards',
        om: 'Walgahii Hojii Qulqullina Nyaataa fi Eegumsa Fayyaa',
      },
      slug: 'workshop-food-safety-haccp',
      type: 'event',
      summary: {
        en: 'Three-day certified training for restaurant head chefs and kitchen supervisors in Bishoftu.',
      },
      body: {
        en: 'Practical kitchen hygiene, microbiological hazard controls, and global HACCP certification preparation.',
      },
      eventStartAt: '2026-12-05T08:30:00Z',
      eventEndAt: '2026-12-07T16:00:00Z',
      registrationOpen: true,
    },
    {
      title: {
        en: 'OHPEA Signs Strategic MoU with Sinke Bank for Member Credit Facility',
        om: 'Waliigaltee OHPEA fi Baankii Siinqee Gidduutti Mallatteeffame',
      },
      slug: 'mou-sinke-bank-credit-facility',
      type: 'news',
      summary: {
        en: 'Association members gain preferential business loan rates and digital micro-finance backing for hospitality startups.',
      },
      body: {
        en: 'A historic partnership was established today providing accessible financing for eco-lodges and youth hospitality ventures.',
      },
    },
    {
      title: {
        en: 'Vacancy: Senior Research & Policy Analyst',
        om: 'Baniinsa Hojii: Qorataa Olaanaa Imaammata Turizimii',
      },
      slug: 'vacancy-senior-research-analyst',
      type: 'vacancy',
      summary: {
        en: 'Opportunity for senior economists or tourism sociologists to spearhead OHPEA\'s policy think-tank.',
      },
      body: {
        en: 'Master’s degree in Tourism, Economics, or Development Studies required. Excellent writing skills in Afaan Oromo and English.',
      },
      deadline: '2026-11-28',
    },
    {
      title: {
        en: 'Upcoming B2B Trade Delegation to Dubai Tourism Expo 2027',
        om: 'Imala Daldalaa Expoo Turizimii Dubaay 2027',
      },
      slug: 'b2b-trade-delegation-dubai-2027',
      type: 'news',
      summary: {
        en: 'OHPEA will sponsor 20 licensed Oromia tour operators to showcase regional destinations at the international expo.',
      },
      body: {
        en: 'Registration details and selection criteria will be published in upcoming association newsletters.',
      },
    },
  ];

  for (const a of announcements) {
    await pool.query(
      `INSERT INTO announcements (
        id, slug, type, title, summary, body, deadline, event_start_at, event_end_at,
        registration_open, registration_url, status, published_at, created_by, is_demo, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published',NOW(),'SuperAdmin',true,NOW())`,
      [
        crypto.randomUUID(),
        a.slug,
        a.type,
        JSON.stringify(a.title),
        JSON.stringify(a.summary),
        JSON.stringify(a.body),
        a.deadline || null,
        a.eventStartAt || null,
        a.eventEndAt || null,
        a.registrationOpen || false,
        a.registrationUrl || null,
      ]
    );
  }

  console.log('[Database Seed] Demo data seeded successfully.');
}

/**
 * Remove Demo Data helper (npm run seed:clear-demo)
 */
export async function clearDemoData(): Promise<{
  membersDeleted: number;
  paymentsDeleted: number;
  announcementsDeleted: number;
  activitiesDeleted: number;
}> {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const paymentsRes = await client.query('DELETE FROM payments WHERE is_demo = true');
    const membersRes = await client.query('DELETE FROM members WHERE is_demo = true');
    const announcementsRes = await client.query('DELETE FROM announcements WHERE is_demo = true');
    const activitiesRes = await client.query('DELETE FROM activities WHERE is_demo = true');
    await client.query('COMMIT');

    return {
      paymentsDeleted: paymentsRes.rowCount || 0,
      membersDeleted: membersRes.rowCount || 0,
      announcementsDeleted: announcementsRes.rowCount || 0,
      activitiesDeleted: activitiesRes.rowCount || 0,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * High-level Database Operations object (dbOperations)
 */
export const dbOperations = {
  // Members
  async getMembers(params: {
    q?: string;
    registrationStatus?: string;
    membershipStatus?: string;
    gender?: string;
    sectorId?: string;
    fieldId?: string;
    regionId?: string;
    occupationType?: string;
    graduationLevelId?: string;
    paid?: boolean;
    period?: string;
    createdFrom?: string;
    createdTo?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.q) {
      conditions.push(`(m.full_name ILIKE $${idx} OR m.phone ILIKE $${idx} OR m.email ILIKE $${idx} OR m.member_no ILIKE $${idx})`);
      values.push(`%${params.q.trim()}%`);
      idx++;
    }
    if (params.registrationStatus) {
      conditions.push(`m.registration_status = $${idx}`);
      values.push(params.registrationStatus);
      idx++;
    }
    if (params.membershipStatus) {
      conditions.push(`m.membership_status = $${idx}`);
      values.push(params.membershipStatus);
      idx++;
    }
    if (params.gender) {
      conditions.push(`m.gender = $${idx}`);
      values.push(params.gender);
      idx++;
    }
    if (params.sectorId) {
      conditions.push(`m.sector_id = $${idx}`);
      values.push(params.sectorId);
      idx++;
    }
    if (params.fieldId) {
      conditions.push(`m.field_of_study_id = $${idx}`);
      values.push(params.fieldId);
      idx++;
    }
    if (params.regionId) {
      conditions.push(`m.region_id = $${idx}`);
      values.push(params.regionId);
      idx++;
    }
    if (params.occupationType) {
      conditions.push(`m.occupation_type = $${idx}`);
      values.push(params.occupationType);
      idx++;
    }
    if (params.graduationLevelId) {
      conditions.push(`m.graduation_level_id = $${idx}`);
      values.push(params.graduationLevelId);
      idx++;
    }
    if (params.createdFrom) {
      conditions.push(`m.created_at >= $${idx}`);
      values.push(params.createdFrom);
      idx++;
    }
    if (params.createdTo) {
      conditions.push(`m.created_at <= $${idx}`);
      values.push(params.createdTo);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Whitelist sort fields
    const validSortFields: Record<string, string> = {
      createdAt: 'm.created_at',
      fullName: 'm.full_name',
      memberNo: 'm.member_no',
      registrationStatus: 'm.registration_status',
      membershipStatus: 'm.membership_status',
    };

    let sortCol = 'm.created_at';
    let sortDir = 'DESC';

    if (params.sort) {
      const [f, d] = params.sort.split(':');
      if (validSortFields[f]) sortCol = validSortFields[f];
      if (d && d.toLowerCase() === 'asc') sortDir = 'ASC';
    }

    const countQuery = `SELECT count(*) as total FROM members m ${whereClause}`;
    const countRes = await query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    const listQuery = `
      SELECT m.*, r.name as region_name, s.label as sector_label, f.label as field_label, g.label as grad_label
      FROM members m
      LEFT JOIN regions r ON m.region_id = r.id
      LEFT JOIN lookup_sectors s ON m.sector_id = s.id
      LEFT JOIN lookup_fields_of_study f ON m.field_of_study_id = f.id
      LEFT JOIN lookup_graduation_levels g ON m.graduation_level_id = g.id
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const listRes = await query(listQuery, [...values, pageSize, offset]);

    return {
      items: listRes.rows.map(mapRow),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  },

  async getMemberById(id: string) {
    const res = await query(
      `SELECT m.*, r.name as region_name, s.label as sector_label, f.label as field_label, g.label as grad_label
       FROM members m
       LEFT JOIN regions r ON m.region_id = r.id
       LEFT JOIN lookup_sectors s ON m.sector_id = s.id
       LEFT JOIN lookup_fields_of_study f ON m.field_of_study_id = f.id
       LEFT JOIN lookup_graduation_levels g ON m.graduation_level_id = g.id
       WHERE m.id = $1`,
      [id]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async getMemberDocuments(memberId: string) {
    const res = await query('SELECT * FROM member_documents WHERE member_id = $1 ORDER BY uploaded_at ASC', [memberId]);
    return res.rows.map(mapRow);
  },

  async getMemberDocumentById(memberId: string, docId: string) {
    const res = await query('SELECT * FROM member_documents WHERE member_id = $1 AND id = $2', [memberId, docId]);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async checkDuplicateMember(phone: string, email: string, idType: string, idNumber: string) {
    const pepper = process.env.SERVER_PEPPER || 'ohpea_pepper_2026';
    const idHash = crypto.createHash('sha256').update(`${idType}:${idNumber.trim()}:${pepper}`).digest('hex');

    const res = await query(
      `SELECT id, member_no, full_name, phone, email FROM members 
       WHERE phone = $1 OR email = $2 OR id_number_hash = $3`,
      [phone.trim(), email.toLowerCase().trim(), idHash]
    );

    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async getNextMemberNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const res = await query(
      "SELECT count(*) as count FROM members WHERE member_no LIKE $1",
      [`OHPEA-${currentYear}-%`]
    );
    const nextSeq = parseInt(res.rows[0].count, 10) + 1;
    return `OHPEA-${currentYear}-${String(nextSeq).padStart(5, '0')}`;
  },

  async getNextReceiptNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const res = await query(
      "SELECT count(*) as count FROM payments WHERE receipt_no LIKE $1",
      [`RCT-${currentYear}-%`]
    );
    const nextSeq = parseInt(res.rows[0].count, 10) + 1;
    return `RCT-${currentYear}-${String(nextSeq).padStart(6, '0')}`;
  },

  async createMember(data: any) {
  const res = await query(
    `INSERT INTO members (
      id, member_no, full_name, phone, email, gender, date_of_birth,
      graduation_level_id, occupation_type, sector_id, field_of_study_id,
      professional_category, organization_name, job_title, region_id, town,
      id_type, id_number_hash, id_number_last4, registration_status, membership_status,
      preferred_language, source, consent_at, created_at, updated_at,
      membership_category, nationality,
      emergency_contact_name, emergency_contact_phone,
      business_tin, year_established, institution_name,
      skills, expertise_areas, interests,
      zone_sub_city, woreda
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, NOW(), NOW(), NOW(),
      $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
    ) RETURNING *`,
    [
      data.id || crypto.randomUUID(),
      data.memberNo,
      data.fullName,
      data.phone,
      data.email.toLowerCase(),
      data.gender,
      data.dateOfBirth || null,
      data.graduationLevelId || null,
      data.occupationType || null,
      data.sectorId || null,
      data.fieldOfStudyId || null,
      data.professionalCategory || null,
      data.organizationName || null,
      data.jobTitle || null,
      data.regionId || null,
      data.town || null,
      data.idType || 'fayda',
      data.idNumberHash || '',
      data.idNumberLast4 || '',
      data.registrationStatus || 'pending',
      data.membershipStatus || 'pending',
      data.preferredLanguage || 'en',
      data.source || 'online',
      // New fields:
      data.membershipCategory || null,
      data.nationality || null,
      data.emergencyContactName || null,
      data.emergencyContactPhone || null,
      data.businessTin || null,
      data.yearEstablished ?? null,
      data.institutionName || null,
      data.skills || null,
      Array.isArray(data.expertiseAreas) ? JSON.stringify(data.expertiseAreas) : null,
      Array.isArray(data.interests) ? JSON.stringify(data.interests) : null,
      data.zoneSubCity || null,
      data.woreda || null,
    ]
  );
  return mapRow(res.rows[0]);
},

  async updateMemberStatus(id: string, membershipStatus: string) {
    const res = await query(
      'UPDATE members SET membership_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [membershipStatus, id]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async approveMember(id: string, approvedBy: string) {
    const res = await query(
      `UPDATE members 
       SET registration_status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [approvedBy, id]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async rejectMember(id: string, rejectionReason: string) {
    const res = await query(
      `UPDATE members 
       SET registration_status = 'rejected', membership_status = 'inactive', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [rejectionReason, id]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async addMemberDocument(doc: {
    id?: string;
    memberId: string;
    kind: string;
    originalName: string;
    storedName: string;
    mime: string;
    size: number;
    sha256: string;
  }) {
    const res = await query(
      `INSERT INTO member_documents (id, member_id, kind, original_name, stored_name, mime, size, sha256, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
      [
        doc.id || crypto.randomUUID(),
        doc.memberId,
        doc.kind,
        doc.originalName,
        doc.storedName,
        doc.mime,
        doc.size,
        doc.sha256,
      ]
    );
    return mapRow(res.rows[0]);
  },

  // Payments
  async createPayment(payment: any) {
    const res = await query(
      `INSERT INTO payments (
        id, member_id, plan_id, region_id, amount_etb, period, period_start, period_end,
        method, reference, bank, received_by, receipt_no, status, paid_at, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15)
      RETURNING *`,
      [
        crypto.randomUUID(),
        payment.memberId,
        payment.planId || null,
        payment.regionId,
        payment.amountEtb,
        payment.period,
        payment.periodStart,
        payment.periodEnd,
        payment.method,
        payment.reference || null,
        payment.bank || null,
        payment.receivedBy,
        payment.receiptNo,
        'paid',
        payment.note || null,
      ]
    );

    // If member was pending, promote to active
    await query(
      `UPDATE members SET membership_status = 'active', updated_at = NOW()
       WHERE id = $1 AND membership_status = 'pending'`,
      [payment.memberId]
    );

    return mapRow(res.rows[0]);
  },

  async getPayments(params: {
    memberId?: string;
    regionId?: string;
    status?: string;
    period?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.memberId) {
      conditions.push(`p.member_id = $${idx}`);
      values.push(params.memberId);
      idx++;
    }
    if (params.regionId) {
      conditions.push(`p.region_id = $${idx}`);
      values.push(params.regionId);
      idx++;
    }
    if (params.status) {
      conditions.push(`p.status = $${idx}`);
      values.push(params.status);
      idx++;
    }
    if (params.period) {
      conditions.push(`p.period = $${idx}`);
      values.push(params.period);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT count(*) as total FROM payments p ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].total, 10);

    const listRes = await query(
      `SELECT p.*, m.full_name as member_name, m.member_no, m.phone as member_phone
       FROM payments p
       LEFT JOIN members m ON p.member_id = m.id
       ${whereClause}
       ORDER BY p.paid_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, pageSize, offset]
    );

    return {
      items: listRes.rows.map(mapRow),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  },

  async getPaymentById(id: string) {
    const res = await query(
      `SELECT p.*, m.full_name as member_name, m.member_no, m.phone as member_phone, r.name as region_name
       FROM payments p
       LEFT JOIN members m ON p.member_id = m.id
       LEFT JOIN regions r ON p.region_id = r.id
       WHERE p.id = $1`,
      [id]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async voidPayment(id: string, note?: string) {
    const res = await query(
      `UPDATE payments SET status = 'void', note = COALESCE(note || ' | Voided', 'Voided') WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  // Admin users
  async getAdminByUsernameOrEmail(identifier: string) {
    const clean = identifier.trim().toLowerCase();
    const res = await query(
      `SELECT * FROM admin_users WHERE LOWER(username) = $1 OR LOWER(email) = $1`,
      [clean]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async getAdminById(id: string) {
    const res = await query(`SELECT * FROM admin_users WHERE id = $1`, [id]);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async updateAdminLastLogin(id: string) {
    await query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [id]);
  },

  async changeAdminPassword(id: string, passwordHash: string) {
    await query(
      'UPDATE admin_users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [passwordHash, id]
    );
  },

  // Audit Logs
  async createAuditLog(log: {
    adminId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    before?: any;
    after?: any;
    ip?: string;
  }) {
    try {
      await query(
        `INSERT INTO audit_logs (id, admin_id, action, entity, entity_id, before, after, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          crypto.randomUUID(),
          log.adminId || null,
          log.action,
          log.entity,
          log.entityId || null,
          log.before ? JSON.stringify(log.before) : null,
          log.after ? JSON.stringify(log.after) : null,
          log.ip || null,
        ]
      );
    } catch (err) {
      console.warn('[AuditLog] Failed to record audit log:', err);
    }
  },

  // SMS Campaigns
  async getMembersForCampaign(filter: { regionId?: string; sectorId?: string; membershipStatus?: string; gender?: string }) {
    const conditions: string[] = ["registration_status = 'approved'"];
    const values: any[] = [];
    let idx = 1;

    if (filter.regionId) {
      conditions.push(`region_id = $${idx}`);
      values.push(filter.regionId);
      idx++;
    }
    if (filter.sectorId) {
      conditions.push(`sector_id = $${idx}`);
      values.push(filter.sectorId);
      idx++;
    }
    if (filter.membershipStatus) {
      conditions.push(`membership_status = $${idx}`);
      values.push(filter.membershipStatus);
      idx++;
    }
    if (filter.gender) {
      conditions.push(`gender = $${idx}`);
      values.push(filter.gender);
      idx++;
    }

    const res = await query(`SELECT id, full_name, phone, member_no FROM members WHERE ${conditions.join(' AND ')}`, values);
    return res.rows.map(mapRow);
  },

  async createSmsCampaign(data: any) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO sms_campaigns (id, name, message, audience_filter, status, scheduled_at, created_by, totals)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        data.name,
        data.message,
        JSON.stringify(data.audienceFilter || {}),
        data.scheduledAt ? 'scheduled' : 'draft',
        data.scheduledAt || null,
        data.createdBy,
        JSON.stringify(data.totals || {}),
      ]
    );
    return id;
  },

  async getSmsCampaignById(id: string) {
    const res = await query('SELECT * FROM sms_campaigns WHERE id = $1', [id]);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },

  async updateSmsCampaignStatus(id: string, status: string, totals?: any) {
    if (totals) {
      await query('UPDATE sms_campaigns SET status = $1, totals = $2 WHERE id = $3', [status, JSON.stringify(totals), id]);
    } else {
      await query('UPDATE sms_campaigns SET status = $1 WHERE id = $2', [status, id]);
    }
  },

  async createSmsLog(log: any) {
    await query(
      `INSERT INTO sms_logs (id, campaign_id, member_id, phone, message, status, provider_message_id, error, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        crypto.randomUUID(),
        log.campaignId || null,
        log.memberId || null,
        log.phone,
        log.message,
        log.status,
        log.providerMessageId || null,
        log.error || null,
      ]
    );
  },

  async getDueScheduledSmsCampaigns() {
    const res = await query(
      "SELECT * FROM sms_campaigns WHERE status = 'scheduled' AND scheduled_at <= NOW()"
    );
    return res.rows.map(mapRow);
  },
};
