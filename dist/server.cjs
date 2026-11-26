var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_config = require("dotenv/config");
var import_express5 = __toESM(require("express"), 1);
var import_helmet = __toESM(require("helmet"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path5 = __toESM(require("path"), 1);
var import_swagger_ui_express = __toESM(require("swagger-ui-express"), 1);

// src/backend/database.ts
var import_pg = __toESM(require("pg"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_pg_mem = require("pg-mem");

// migrations/20261107000001_add_slug_to_programs.ts
async function up(pool) {
  await pool.query(`
    ALTER TABLE programs ADD COLUMN IF NOT EXISTS slug TEXT;
  `);
  const res = await pool.query(`SELECT id, title, slug FROM programs`);
  for (const row of res.rows) {
    if (!row.slug) {
      let rawTitle = "";
      if (typeof row.title === "object" && row.title !== null) {
        rawTitle = row.title.en || row.title.om || Object.values(row.title)[0] || "program";
      } else {
        rawTitle = String(row.title || "program");
      }
      let baseSlug = rawTitle.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "") || "program";
      let candidate = baseSlug;
      let counter = 2;
      while (true) {
        const check = await pool.query("SELECT id FROM programs WHERE slug = $1 AND id != $2", [candidate, row.id]);
        if (check.rows.length === 0) break;
        candidate = `${baseSlug}-${counter}`;
        counter++;
      }
      await pool.query("UPDATE programs SET slug = $1 WHERE id = $2", [candidate, row.id]);
    }
  }
  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug);`);
  } catch {
  }
}
async function down(pool) {
  try {
    await pool.query(`ALTER TABLE programs DROP COLUMN IF EXISTS slug;`);
  } catch {
  }
}

// migrations/20261107000002_add_slug_to_announcements.ts
async function up2(pool) {
  await pool.query(`
    ALTER TABLE announcements ADD COLUMN IF NOT EXISTS slug TEXT;
  `);
  const res = await pool.query(`SELECT id, title, slug FROM announcements`);
  for (const row of res.rows) {
    if (!row.slug) {
      let rawTitle = "";
      if (typeof row.title === "object" && row.title !== null) {
        rawTitle = row.title.en || row.title.om || Object.values(row.title)[0] || "announcement";
      } else {
        rawTitle = String(row.title || "announcement");
      }
      let baseSlug = rawTitle.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "") || "announcement";
      let candidate = baseSlug;
      let counter = 2;
      while (true) {
        const check = await pool.query("SELECT id FROM announcements WHERE slug = $1 AND id != $2", [candidate, row.id]);
        if (check.rows.length === 0) break;
        candidate = `${baseSlug}-${counter}`;
        counter++;
      }
      await pool.query("UPDATE announcements SET slug = $1 WHERE id = $2", [candidate, row.id]);
    }
  }
  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_slug ON announcements(slug);`);
  } catch {
  }
}
async function down2(pool) {
  try {
    await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS slug;`);
  } catch {
  }
}

// migrations/20261107000003_add_is_published_to_programs.ts
async function up3(pool) {
  await pool.query(`
    ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;
  `);
  try {
    await pool.query(`
      ALTER TABLE programs ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;
    `);
  } catch {
  }
}
async function down3(pool) {
  try {
    await pool.query(`ALTER TABLE programs DROP COLUMN IF EXISTS is_published;`);
  } catch {
  }
}

// migrations/20261107000004_add_is_published_to_partners.ts
async function up4(pool) {
  await pool.query(`
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;
  `);
  try {
    await pool.query(`
      ALTER TABLE partners ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;
    `);
  } catch {
  }
}
async function down4(pool) {
  try {
    await pool.query(`ALTER TABLE partners DROP COLUMN IF EXISTS is_published;`);
  } catch {
  }
}

// migrations/20261107000005_create_registrations.ts
async function up5(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      qualification TEXT,
      field_of_study TEXT,
      organization TEXT,
      zone TEXT,
      id_type TEXT NOT NULL,
      id_number TEXT NOT NULL,
      id_document_path TEXT NOT NULL,
      credential_doc_paths JSONB NOT NULL DEFAULT '[]',
      otp_verified BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'pending_otp',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_registrations_phone ON registrations(phone);
    CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
  `);
  const cols = [
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "fullName" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "fieldOfStudy" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "idType" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "idNumber" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "idDocumentPath" TEXT`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "credentialDocPaths" JSONB DEFAULT '[]'`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "otpVerified" BOOLEAN DEFAULT false`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`
  ];
  for (const col of cols) {
    try {
      await pool.query(col);
    } catch {
    }
  }
}
async function down5(pool) {
  try {
    await pool.query(`DROP TABLE IF EXISTS registrations;`);
  } catch {
  }
}

// migrations/20261107000006_create_otp_codes.ts
async function up6(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      phone TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      consumed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const cols = [
    `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS "codeHash" TEXT`,
    `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ`,
    `ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`
  ];
  for (const col of cols) {
    try {
      await pool.query(col);
    } catch {
    }
  }
}
async function down6(pool) {
  try {
    await pool.query(`DROP TABLE IF EXISTS otp_codes;`);
  } catch {
  }
}

// migrations/20261107000007_add_source_to_messages.ts
async function up7(pool) {
  await pool.query(`
    ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin';
  `);
  try {
    await pool.query(`
      ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS full_name TEXT;
    `);
  } catch {
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        name TEXT,
        full_name TEXT,
        email TEXT NOT NULL,
        phone TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        source TEXT NOT NULL DEFAULT 'public_website',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch {
  }
}
async function down7(pool) {
  try {
    await pool.query(`ALTER TABLE contact_messages DROP COLUMN IF EXISTS source;`);
  } catch {
  }
}

// migrations/20261107000008_ensure_announcement_translations.ts
async function up8(pool) {
  const columns = [
    "title_en TEXT",
    "title_om TEXT",
    "title_am TEXT",
    "summary_en TEXT",
    "summary_om TEXT",
    "summary_am TEXT",
    "body_en TEXT",
    "body_om TEXT",
    "body_am TEXT"
  ];
  for (const col of columns) {
    try {
      await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS ${col};`);
    } catch {
    }
  }
  const res = await pool.query(`SELECT id, title, summary, body FROM announcements`);
  for (const row of res.rows) {
    const t2 = typeof row.title === "object" && row.title !== null ? row.title : {};
    const s = typeof row.summary === "object" && row.summary !== null ? row.summary : {};
    const b = typeof row.body === "object" && row.body !== null ? row.body : {};
    const tEn = t2.en || (typeof row.title === "string" ? row.title : "");
    const tOm = t2.om || tEn;
    const tAm = t2.am || tEn;
    const sEn = s.en || (typeof row.summary === "string" ? row.summary : "");
    const sOm = s.om || sEn;
    const sAm = s.am || sEn;
    const bEn = b.en || (typeof row.body === "string" ? row.body : "");
    const bOm = b.om || bEn;
    const bAm = b.am || bEn;
    await pool.query(
      `UPDATE announcements SET
        title_en = COALESCE(title_en, $1),
        title_om = COALESCE(title_om, $2),
        title_am = COALESCE(title_am, $3),
        summary_en = COALESCE(summary_en, $4),
        summary_om = COALESCE(summary_om, $5),
        summary_am = COALESCE(summary_am, $6),
        body_en = COALESCE(body_en, $7),
        body_om = COALESCE(body_om, $8),
        body_am = COALESCE(body_am, $9)
       WHERE id = $10`,
      [tEn, tOm, tAm, sEn, sOm, sAm, bEn, bOm, bAm, row.id]
    );
  }
}
async function down8(pool) {
  const cols = [
    "title_en",
    "title_om",
    "title_am",
    "summary_en",
    "summary_om",
    "summary_am",
    "body_en",
    "body_om",
    "body_am"
  ];
  for (const c of cols) {
    try {
      await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS ${c};`);
    } catch {
    }
  }
}

// migrations/20261107000009_create_woredas.ts
async function up9(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS woredas (
      id TEXT PRIMARY KEY,
      region_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_woredas_region ON woredas(region_id);
  `);
  const countRes = await pool.query(`SELECT COUNT(*) as count FROM woredas`);
  if (parseInt(countRes.rows[0].count, 10) === 0) {
    const sampleWoredas = [
      { id: "wor-adama", regionId: "reg-east-shewa", name: "Adama" },
      { id: "wor-bishoftu", regionId: "reg-east-shewa", name: "Bishoftu" },
      { id: "wor-shashemene", regionId: "reg-west-arsi", name: "Shashemene" },
      { id: "wor-arssi-negele", regionId: "reg-west-arsi", name: "Arsi Negele" },
      { id: "wor-jimma-town", regionId: "reg-jimma-zone", name: "Jimma Town" },
      { id: "wor-agaro", regionId: "reg-jimma-zone", name: "Agaro" },
      { id: "wor-ambo", regionId: "reg-west-shewa", name: "Ambo" },
      { id: "wor-waliso", regionId: "reg-sw-shewa", name: "Waliso" },
      { id: "wor-asella", regionId: "reg-arsi-zone", name: "Asella" },
      { id: "wor-bale-robe", regionId: "reg-bale-zone", name: "Robe" },
      { id: "wor-faydha", regionId: "reg-finfinne-special", name: "Burayu" },
      { id: "wor-dukem", regionId: "reg-finfinne-special", name: "Dukem" }
    ];
    for (const w of sampleWoredas) {
      await pool.query(
        `INSERT INTO woredas (id, region_id, name) VALUES ($1, $2, $3)`,
        [w.id, w.regionId, w.name]
      );
    }
  }
}
async function down9(pool) {
  try {
    await pool.query(`DROP TABLE IF EXISTS woredas;`);
  } catch {
  }
}

// migrations/20261107000010_unify_contact_messages.ts
async function up10(pool) {
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
  try {
    await pool.query(`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS full_name TEXT;`);
  } catch {
  }
  try {
    await pool.query(`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin';`);
  } catch {
  }
  try {
    const tableCheck = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_name = 'messages'
    `);
    if (tableCheck.rows.length > 0 && tableCheck.rows[0].table_type !== "VIEW") {
      await pool.query(`
        INSERT INTO contact_messages (id, name, full_name, email, phone, subject, message, status, source, created_at)
        SELECT id, COALESCE(name, full_name, ''), full_name, email, phone, subject, message, COALESCE(status, 'new'), COALESCE(source, 'public_website'), COALESCE(created_at, NOW())
        FROM messages
        ON CONFLICT (id) DO NOTHING;
      `);
      await pool.query(`DROP TABLE IF EXISTS messages;`);
    }
  } catch (err) {
    console.warn("[Migration Notice: unify_contact_messages]", err.message);
  }
  try {
    await pool.query(`CREATE OR REPLACE VIEW messages AS SELECT * FROM contact_messages;`);
  } catch {
  }
}
async function down10(pool) {
  try {
    await pool.query(`DROP VIEW IF EXISTS messages;`);
  } catch {
  }
}

// migrations/20261107000011_public_enum_constraints.ts
async function up11(pool) {
  try {
    await pool.query(`
      UPDATE registrations
      SET id_type = 'fayda'
      WHERE id_type NOT IN ('fayda', 'passport', 'kebele', 'driver') OR id_type IS NULL;
    `);
    await pool.query(`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_registrations_id_type;`);
    await pool.query(`
      ALTER TABLE registrations
      ADD CONSTRAINT chk_registrations_id_type
      CHECK (id_type IN ('fayda', 'passport', 'kebele', 'driver'));
    `);
  } catch (err) {
    console.warn("[Migration Notice: chk_registrations_id_type]", err.message);
  }
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
  } catch (err) {
    console.warn("[Migration Notice: chk_registrations_status]", err.message);
  }
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
  } catch (err) {
    console.warn("[Migration Notice: chk_subscribers_language]", err.message);
  }
}
async function down11(pool) {
  try {
    await pool.query(`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_registrations_id_type;`);
  } catch {
  }
  try {
    await pool.query(`ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_registrations_status;`);
  } catch {
  }
  try {
    await pool.query(`ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS chk_subscribers_language;`);
  } catch {
  }
}

// migrations/20261107000012_add_otp_verified_at.ts
async function up12(pool) {
  await pool.query(`
    ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS verified_for_phone_at TIMESTAMPTZ NULL;
  `);
  try {
    await pool.query(`
      ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS "verifiedForPhoneAt" TIMESTAMPTZ NULL;
    `);
  } catch {
  }
}
async function down12(pool) {
  try {
    await pool.query(`ALTER TABLE otp_codes DROP COLUMN IF EXISTS verified_for_phone_at;`);
    await pool.query(`ALTER TABLE otp_codes DROP COLUMN IF EXISTS "verifiedForPhoneAt";`);
  } catch {
  }
}

// migrations/20261111000013_add_description_to_contribution_plans.ts
async function up13(pool) {
  await pool.query(`
    ALTER TABLE contribution_plans
      ADD COLUMN IF NOT EXISTS description TEXT;
  `);
}
async function down13(pool) {
  await pool.query(`
    ALTER TABLE contribution_plans
      DROP COLUMN IF EXISTS description;
  `);
}

// migrations/20261112000014_add_full_registration_fields.ts
var memberColumns = [
  "membership_category TEXT",
  "nationality TEXT",
  "business_tin TEXT",
  "skills TEXT",
  "expertise_areas TEXT[]",
  "interests TEXT[]",
  "emergency_contact_name TEXT",
  "emergency_contact_phone TEXT"
];
async function up14(pool) {
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
async function down14(pool) {
  await pool.query(`ALTER TABLE members DROP CONSTRAINT IF EXISTS chk_members_gender;`);
  for (const column of [
    "membership_category",
    "nationality",
    "business_tin",
    "skills",
    "expertise_areas",
    "interests",
    "emergency_contact_name",
    "emergency_contact_phone"
  ]) {
    await pool.query(`ALTER TABLE members DROP COLUMN IF EXISTS ${column};`);
  }
}

// migrations/20261113000015_add_demo_flags.ts
var demoAnnouncementSlugs = [
  "call-for-research-papers-2026",
  "annual-tourism-convention-2026",
  "vacancy-training-coordinator",
  "call-for-proposals-community-tourism",
  "workshop-food-safety-haccp",
  "mou-sinke-bank-credit-facility",
  "vacancy-senior-research-analyst",
  "b2b-trade-delegation-dubai-2027"
];
async function up15(pool) {
  await pool.query(
    "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;"
  );
  await pool.query(
    "ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;"
  );
  await pool.query(
    "UPDATE announcements SET is_demo = true WHERE slug = ANY($1::text[])",
    [demoAnnouncementSlugs]
  );
}
async function down15(pool) {
  await pool.query("ALTER TABLE announcements DROP COLUMN IF EXISTS is_demo;");
  await pool.query("ALTER TABLE activities DROP COLUMN IF EXISTS is_demo;");
}

// migrations/20261114000016_add_missing_registration_fields.ts
async function up16(pool) {
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
async function down16(pool) {
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

// src/backend/migrationRunner.ts
var allMigrations = [
  { name: "20261107000001_add_slug_to_programs", up, down },
  { name: "20261107000002_add_slug_to_announcements", up: up2, down: down2 },
  { name: "20261107000003_add_is_published_to_programs", up: up3, down: down3 },
  { name: "20261107000004_add_is_published_to_partners", up: up4, down: down4 },
  { name: "20261107000005_create_registrations", up: up5, down: down5 },
  { name: "20261107000006_create_otp_codes", up: up6, down: down6 },
  { name: "20261107000007_add_source_to_messages", up: up7, down: down7 },
  { name: "20261107000008_ensure_announcement_translations", up: up8, down: down8 },
  { name: "20261107000009_create_woredas", up: up9, down: down9 },
  { name: "20261107000010_unify_contact_messages", up: up10, down: down10 },
  { name: "20261107000011_public_enum_constraints", up: up11, down: down11 },
  { name: "20261107000012_add_otp_verified_at", up: up12, down: down12 },
  { name: "20261111000013_add_description_to_contribution_plans", up: up13, down: down13 },
  { name: "20261112000014_add_full_registration_fields", up: up14, down: down14 },
  { name: "20261113000015_add_demo_flags", up: up15, down: down15 },
  { name: "20261114000016_add_missing_registration_fields", up: up16, down: down16 }
];
async function runAllMigrations(pool) {
  console.log("[Migrations] Starting...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const appliedRes = await pool.query("SELECT name FROM _migrations");
  const applied = new Set(appliedRes.rows.map((r) => r.name));
  for (const migration of allMigrations) {
    if (applied.has(migration.name)) {
      console.log(`[Migrations] Already applied: ${migration.name}`);
      continue;
    }
    try {
      console.log(`[Migrations] Applying: ${migration.name}`);
      await migration.up(pool);
      await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [migration.name]);
      console.log(`[Migrations] \u2713 Applied: ${migration.name}`);
    } catch (err) {
      console.warn(`[Migrations] Notice on ${migration.name}:`, err.message);
    }
  }
  console.log("[Migrations] All migrations complete.");
}

// src/backend/database.ts
var { Pool } = import_pg.default;
function shouldEnableSsl() {
  if (process.env.DATABASE_SSL === "true") return true;
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("sslmode=require")) return true;
  if (dbUrl.includes("render.com") || dbUrl.includes("neon.tech") || dbUrl.includes("supabase.co") || dbUrl.includes("aws")) {
    return true;
  }
  return false;
}
var activePool = null;
var isInMemoryFallback = false;
function createPostgresPool() {
  const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/ophea";
  const ssl = shouldEnableSsl() ? { rejectUnauthorized: false } : false;
  return new Pool({
    connectionString,
    ssl,
    max: 20,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 3e3
  });
}
function createInMemoryPool() {
  const mem = (0, import_pg_mem.newDb)();
  mem.public.registerFunction({
    name: "gen_random_uuid",
    implementation: () => import_crypto.default.randomUUID()
  });
  mem.public.registerFunction({
    name: "now",
    implementation: () => /* @__PURE__ */ new Date()
  });
  mem.public.registerFunction({
    name: "date_trunc",
    args: [import_pg_mem.DataType.text, import_pg_mem.DataType.timestamptz],
    returns: import_pg_mem.DataType.timestamptz,
    implementation: (unit, date) => {
      const d = new Date(date);
      if (unit === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
      if (unit === "year") return new Date(d.getFullYear(), 0, 1);
      return d;
    }
  });
  mem.public.registerFunction({
    name: "to_char",
    args: [import_pg_mem.DataType.timestamptz, import_pg_mem.DataType.text],
    returns: import_pg_mem.DataType.text,
    implementation: (date, fmt) => {
      const d = new Date(date);
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${d.getFullYear()}-${m}`;
    }
  });
  const MemPool = mem.adapters.createPg().Pool;
  return new MemPool();
}
async function getPool() {
  if (activePool) return activePool;
  const candidatePool = createPostgresPool();
  try {
    const client = await candidatePool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("[Database] Connected to external PostgreSQL database.");
    activePool = candidatePool;
    return activePool;
  } catch (err) {
    console.log("[Database] Active Engine: Embedded PostgreSQL (Dev/Preview)");
    isInMemoryFallback = true;
    activePool = createInMemoryPool();
    return activePool;
  }
}
async function query(text2, params) {
  const pool = await getPool();
  return pool.query(text2, params);
}
function mapRow(row) {
  if (!row || typeof row !== "object") return row;
  if (Array.isArray(row)) return row.map(mapRow);
  const mapped = {};
  for (const [key, val] of Object.entries(row)) {
    const camel = key.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
    if ((key.endsWith("_etb") || key.endsWith("_count") || key === "amount" || key === "amount_etb" || key === "sort_order" || key === "size" || key === "attempts") && val !== null && val !== void 0) {
      mapped[camel] = Number(val);
    } else if (val instanceof Date) {
      mapped[camel] = val.toISOString();
    } else if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      mapped[camel] = val;
    } else {
      mapped[camel] = val;
    }
  }
  return mapped;
}
async function initDatabase() {
  const pool = await getPool();
  console.log("[Database] Running schema migrations...");
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
      employment_status TEXT,
      year_established INT,
      zone_sub_city TEXT,
      woreda TEXT,
      institution_name TEXT,
      graduation_level_id TEXT,
      occupation_type TEXT,
      sector_id TEXT,
      field_of_study_id TEXT,
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
      phone_verified_at TIMESTAMPTZ,
      source TEXT NOT NULL DEFAULT 'online',
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
      description TEXT,
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
      void_reason TEXT,
      voided_at TIMESTAMPTZ,
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
      partner_type TEXT NOT NULL DEFAULT 'partner',
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
      location TEXT,
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
      language TEXT NOT NULL DEFAULT 'en',
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

    -- upgrades for databases created by earlier versions
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS void_reason TEXT;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
    ALTER TABLE contribution_plans ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_type TEXT NOT NULL DEFAULT 'partner';
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS location TEXT;
    ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
    ALTER TABLE members ADD COLUMN IF NOT EXISTS employment_status TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS year_established INT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS zone_sub_city TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS woreda TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS institution_name TEXT;
    ALTER TABLE members ALTER COLUMN graduation_level_id DROP NOT NULL;
    ALTER TABLE members ALTER COLUMN occupation_type DROP NOT NULL;
    ALTER TABLE members ALTER COLUMN sector_id DROP NOT NULL;
    ALTER TABLE members ALTER COLUMN field_of_study_id DROP NOT NULL;
    DELETE FROM woredas WHERE id IN ('wor-adama','wor-bishoftu','wor-shashemene','wor-arssi-negele','wor-jimma-town','wor-agaro','wor-ambo','wor-waliso','wor-asella','wor-bale-robe','wor-faydha','wor-dukem')
  `;
  const statements = schemaSql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err) {
      console.warn(`[Database Migration Notice] ${err.message}`);
    }
  }
  await runAllMigrations(pool);
  await seedInitialData(pool);
}
async function seedInitialData(pool) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@ophea.org";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "Admin12345!ChangeMe";
  const existingAdmin = await pool.query("SELECT id FROM admin_users WHERE email = $1 OR username = 'superadmin'", [adminEmail]);
  if (existingAdmin.rows.length === 0) {
    const passwordHash = await import_bcryptjs.default.hash(adminPass, 10);
    const superAdminPermissions = [
      "dashboard",
      "members",
      "members.approve",
      "members.edit",
      "members.export",
      "payments",
      "payments.record",
      "payments.void",
      "contributions.dashboard",
      "announcements",
      "programs",
      "partners",
      "activities",
      "sms",
      "subscribers",
      "messages",
      "regions",
      "lookups",
      "settings.site",
      "audit"
    ];
    await pool.query(
      `INSERT INTO admin_users (id, username, email, password_hash, full_name, role, permissions, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        import_crypto.default.randomUUID(),
        "superadmin",
        adminEmail,
        passwordHash,
        "OPHEA Central Administrator",
        "SuperAdmin",
        superAdminPermissions,
        true,
        true
        // Must change password on first login
      ]
    );
    console.log(`[Database Seed] Created initial SuperAdmin: ${adminEmail}`);
  }
  const regionsCount = await pool.query("SELECT count(*) as count FROM regions");
  if (parseInt(regionsCount.rows[0].count, 10) === 0) {
    const zones = [
      { id: "reg-arsi", name: { en: "Arsi Zone", om: "Godina Arsii", am: "\u12A0\u122D\u1232 \u12DE\u1295" }, type: "zone" },
      { id: "reg-west-arsi", name: { en: "West Arsi Zone", om: "Godina Arsii Lixaa", am: "\u121D\u12D5\u122B\u1265 \u12A0\u122D\u1232 \u12DE\u1295" }, type: "zone" },
      { id: "reg-bale", name: { en: "Bale Zone", om: "Godina Baalee", am: "\u1263\u120C \u12DE\u1295" }, type: "zone" },
      { id: "reg-east-bale", name: { en: "East Bale Zone", om: "Godina Baalee Bahaa", am: "\u121D\u1235\u122B\u1245 \u1263\u120C \u12DE\u1295" }, type: "zone" },
      { id: "reg-borena", name: { en: "Borena Zone", om: "Godina Booranaa", am: "\u1266\u1228\u1293 \u12DE\u1295" }, type: "zone" },
      { id: "reg-guji", name: { en: "Guji Zone", om: "Godina Gujii", am: "\u1309\u1302 \u12DE\u1295" }, type: "zone" },
      { id: "reg-west-guji", name: { en: "West Guji Zone", om: "Godina Gujii Lixaa", am: "\u121D\u12D5\u122B\u1265 \u1309\u1302 \u12DE\u1295" }, type: "zone" },
      { id: "reg-east-shewa", name: { en: "East Shewa Zone", om: "Godina Shawaa Bahaa", am: "\u121D\u1235\u122B\u1245 \u1238\u12CB \u12DE\u1295" }, type: "zone" },
      { id: "reg-west-shewa", name: { en: "West Shewa Zone", om: "Godina Shawaa Lixaa", am: "\u121D\u12D5\u122B\u1265 \u1238\u12CB \u12DE\u1295" }, type: "zone" },
      { id: "reg-north-shewa", name: { en: "North Shewa Zone", om: "Godina Shawaa Kaabaa", am: "\u1230\u121C\u1295 \u1238\u12CB \u12DE\u1295" }, type: "zone" },
      { id: "reg-sw-shewa", name: { en: "Southwest Shewa Zone", om: "Godina Shawaa Kibba-Lixaa", am: "\u12F0\u1261\u1265 \u121D\u12D5\u122B\u1265 \u1238\u12CB \u12DE\u1295" }, type: "zone" },
      { id: "reg-jimma", name: { en: "Jimma Zone", om: "Godina Jimmaa", am: "\u1305\u121B \u12DE\u1295" }, type: "zone" },
      { id: "reg-illubabor", name: { en: "Illubabor Zone", om: "Godina Iluu Abbaa Booraa", am: "\u12A2\u1209\u1263\u1266\u122D \u12DE\u1295" }, type: "zone" },
      { id: "reg-buno-bedele", name: { en: "Buno Bedele Zone", om: "Godina Bunnoo Baddallee", am: "\u1261\u1296 \u1260\u12F0\u120C \u12DE\u1295" }, type: "zone" },
      { id: "reg-east-wollega", name: { en: "East Wollega Zone", om: "Godina Wallagga Bahaa", am: "\u121D\u1235\u122B\u1245 \u12C8\u1208\u130B \u12DE\u1295" }, type: "zone" },
      { id: "reg-west-wollega", name: { en: "West Wollega Zone", om: "Godina Wallagga Lixaa", am: "\u121D\u12D5\u122B\u1265 \u12C8\u1208\u130B \u12DE\u1295" }, type: "zone" },
      { id: "reg-horo-guduru", name: { en: "Horo Guduru Wollega Zone", om: "Godina Horroo Guduruu Wallaggaa", am: "\u1206\u122E \u1309\u12F1\u1229 \u12C8\u1208\u130B \u12DE\u1295" }, type: "zone" },
      { id: "reg-kellem-wollega", name: { en: "Kellem Wollega Zone", om: "Godina Qellam Wallaggaa", am: "\u1240\u1208\u121D \u12C8\u1208\u130B \u12DE\u1295" }, type: "zone" },
      { id: "reg-east-hararghe", name: { en: "East Hararghe Zone", om: "Godina Harargee Bahaa", am: "\u121D\u1235\u122B\u1245 \u1210\u1228\u122D\u130C \u12DE\u1295" }, type: "zone" },
      { id: "reg-west-hararghe", name: { en: "West Hararghe Zone", om: "Godina Harargee Lixaa", am: "\u121D\u12D5\u122B\u1265 \u1210\u1228\u122D\u130C \u12DE\u1295" }, type: "zone" },
      { id: "reg-finfinne-special", name: { en: "Finfinne Surrounding Special Zone", om: "Godina Addaa Oromiyaa Naannawa Finfinnee", am: "\u12E8\u134A\u1295\u134A\u1294 \u12D9\u122A\u12EB \u120D\u12E9 \u12DE\u1295" }, type: "zone" },
      { id: "reg-adama-city", name: { en: "Adama City Administration", om: "Bulchiinsa Magaalaa Adaamaa", am: "\u12A0\u12F3\u121B \u12A8\u1270\u121B \u12A0\u1235\u1270\u12F3\u12F0\u122D" }, type: "city" },
      { id: "reg-shashemene-city", name: { en: "Shashemene City Administration", om: "Bulchiinsa Magaalaa Shashamannee", am: "\u123B\u1238\u1218\u1294 \u12A8\u1270\u121B \u12A0\u1235\u1270\u12F3\u12F0\u122D" }, type: "city" },
      { id: "reg-jimma-city", name: { en: "Jimma City Administration", om: "Bulchiinsa Magaalaa Jimmaa", am: "\u1305\u121B \u12A8\u1270\u121B \u12A0\u1235\u1270\u12F3\u12F0\u122D" }, type: "city" },
      { id: "reg-bishoftu-city", name: { en: "Bishoftu City Administration", om: "Bulchiinsa Magaalaa Bishooftuu", am: "\u1262\u123E\u134D\u1271 \u12A8\u1270\u121B \u12A0\u1235\u1270\u12F3\u12F0\u122D" }, type: "city" },
      { id: "reg-addis-ababa", name: { en: "Addis Ababa", om: "Finfinnee", am: "\u12A0\u12F2\u1235 \u12A0\u1260\u1263" }, type: "region" },
      { id: "reg-other", name: { en: "Other Region", om: "Naannoo Biraa", am: "\u120C\u120B \u12AD\u120D\u120D" }, type: "region" }
    ];
    let order = 1;
    for (const z3 of zones) {
      await pool.query(
        "INSERT INTO regions (id, name, type, sort_order, is_active) VALUES ($1, $2, $3, $4, true)",
        [z3.id, JSON.stringify(z3.name), z3.type, order++]
      );
    }
  }
  const sectorsCount = await pool.query("SELECT count(*) as count FROM lookup_sectors");
  if (parseInt(sectorsCount.rows[0].count, 10) === 0) {
    const sectors = [
      { code: "hotel", label: { en: "Hotel", om: "Hoteela", am: "\u1206\u1274\u120D" } },
      { code: "restaurant", label: { en: "Restaurant", om: "Manneen Nyaataa", am: "\u122C\u1235\u1276\u122B\u1295\u1275" } },
      { code: "lodge_resort", label: { en: "Lodge / Resort", om: "Loojii / Rizoortii", am: "\u120E\u1305 / \u122A\u12DE\u122D\u1275" } },
      { code: "tour_operator", label: { en: "Tour Operator", om: "Dhaabbata Daawwanna", am: "\u1271\u122D \u12A6\u1355\u122C\u1270\u122D" } },
      { code: "travel_agency", label: { en: "Travel Agency", om: "Eejensii Imalaa", am: "\u12E8\u1275\u122B\u126D\u120D \u12A4\u1300\u1295\u1232" } },
      { code: "cafe", label: { en: "Cafe", om: "Kaafee", am: "\u12AB\u134C" } },
      { code: "catering", label: { en: "Catering", om: "Keetiriingii", am: "\u12AC\u1270\u122A\u1295\u130D" } },
      { code: "training_institution", label: { en: "Training Institution / College", om: "Dhaabbata Leenjii / Koolleejjii", am: "\u12E8\u1235\u120D\u1320\u1293 \u1270\u124B\u121D / \u12AE\u120C\u1305" } },
      { code: "tourism_bureau", label: { en: "Tourism Bureau / Government Office", om: "Biiroo Turizimii / Waajjira Mootummaa", am: "\u12E8\u1271\u122A\u12DD\u121D \u1262\u122E / \u12E8\u1218\u1295\u130D\u1235\u1275 \u1218\u1235\u122A\u12EB \u1264\u1275" } },
      { code: "other", label: { en: "Other Sector", om: "Damee Biraa", am: "\u120C\u120B \u12D8\u122D\u134D" } }
    ];
    let i = 1;
    for (const s of sectors) {
      await pool.query(
        "INSERT INTO lookup_sectors (id, code, label, sort_order, is_active) VALUES ($1, $2, $3, $4, true)",
        [`sec-${s.code}`, s.code, JSON.stringify(s.label), i++]
      );
    }
  }
  const fieldsCount = await pool.query("SELECT count(*) as count FROM lookup_fields_of_study");
  if (parseInt(fieldsCount.rows[0].count, 10) === 0) {
    const fields = [
      { code: "tourism_mgmt", label: { en: "Tourism Management", om: "Bulchiinsa Turizimii", am: "\u12E8\u1271\u122A\u12DD\u121D \u12A0\u1235\u1270\u12F3\u12F0\u122D" } },
      { code: "hospitality_mgmt", label: { en: "Hospitality Management", om: "Bulchiinsa Simannaa", am: "\u1206\u1235\u1352\u1273\u120A\u1272 \u121B\u1294\u1305\u1218\u1295\u1275" } },
      { code: "hotel_mgmt", label: { en: "Hotel Management", om: "Bulchiinsa Hoteelaa", am: "\u12E8\u1206\u1274\u120D \u12A0\u1235\u1270\u12F3\u12F0\u122D" } },
      { code: "culinary_arts", label: { en: "Culinary Arts & Food Preparation", om: "Aartii Qophii Nyaataa", am: "\u12E8\u121D\u130D\u1265 \u12DD\u130D\u1305\u1275 \u12A5\u1293 \u1219\u12EB" } },
      { code: "event_mgmt", label: { en: "Event Management", om: "Bulchiinsa Sagantaalee", am: "\u12E8\u12AD\u1235\u1270\u1275 \u12A0\u1235\u1270\u12F3\u12F0\u122D" } },
      { code: "anthropology", label: { en: "Anthropology & Heritage", om: "Antiroppooloojii fi Hambaa", am: "\u12A0\u1295\u1275\u122E\u1356\u120E\u1302 \u12A5\u1293 \u1245\u122D\u1235" } },
      { code: "geography", label: { en: "Geography & Ecotourism", om: "Ji'oogiraafii fi Ikkooturizimii", am: "\u1302\u12A6\u130D\u122B\u134A \u12A5\u1293 \u12A2\u12AE\u1271\u122A\u12DD\u121D" } },
      { code: "other", label: { en: "Other Field of Study", om: "Muummee Biraa", am: "\u120C\u120B \u12E8\u1275\u121D\u1205\u122D\u1275 \u1218\u1235\u12AD" } }
    ];
    let i = 1;
    for (const f of fields) {
      await pool.query(
        "INSERT INTO lookup_fields_of_study (id, code, label, sort_order, is_active) VALUES ($1, $2, $3, $4, true)",
        [`fos-${f.code}`, f.code, JSON.stringify(f.label), i++]
      );
    }
  }
  const gradCount = await pool.query("SELECT count(*) as count FROM lookup_graduation_levels");
  if (parseInt(gradCount.rows[0].count, 10) === 0) {
    const levels = [
      { code: "diploma", label: { en: "Diploma", om: "Dippiloomaa", am: "\u12F2\u1355\u120E\u121B" } },
      { code: "first_degree", label: { en: "First Degree (BSc/BA)", om: "Digrii Jalqabaa (BSc/BA)", am: "\u12E8\u1218\u1300\u1218\u122A\u12EB \u12F2\u130D\u122A" } },
      { code: "second_degree", label: { en: "Second Degree (MSc/MA)", om: "Digrii Lammaffaa (MSc/MA)", am: "\u1201\u1208\u1270\u129B \u12F2\u130D\u122A" } },
      { code: "third_degree", label: { en: "Third Degree (PhD)", om: "Digrii Sadaffaa (PhD)", am: "\u1236\u1235\u1270\u129B \u12F2\u130D\u122A (\u12F6\u12AD\u1275\u122C\u1275)" } }
    ];
    let i = 1;
    for (const l of levels) {
      await pool.query(
        "INSERT INTO lookup_graduation_levels (id, code, label, sort_order, is_active) VALUES ($1, $2, $3, $4, true)",
        [`grad-${l.code}`, l.code, JSON.stringify(l.label), i++]
      );
    }
  }
  const occCount = await pool.query("SELECT count(*) as count FROM lookup_occupation_types");
  if (parseInt(occCount.rows[0].count, 10) === 0) {
    const occs = [
      { code: "private", label: { en: "Private Sector", om: "Dhuunfaa", am: "\u12E8\u130D\u120D \u12D8\u122D\u134D" } },
      { code: "government", label: { en: "Government Sector", om: "Mootummaa", am: "\u12E8\u1218\u1295\u130D\u1235\u1275 \u12D8\u122D\u134D" } },
      { code: "other", label: { en: "Other", om: "Kan Biraa", am: "\u120C\u120B" } }
    ];
    let i = 1;
    for (const o of occs) {
      await pool.query(
        "INSERT INTO lookup_occupation_types (id, code, label, sort_order, is_active) VALUES ($1, $2, $3, $4, true)",
        [`occ-${o.code}`, o.code, JSON.stringify(o.label), i++]
      );
    }
  }
  const objCount = await pool.query("SELECT count(*) as count FROM objectives");
  if (parseInt(objCount.rows[0].count, 10) === 0) {
    await pool.query(
      `INSERT INTO objectives (id, kind, title, description, sort_order) VALUES ($1, $2, $3, $4, $5)`,
      [
        "obj-general",
        "general",
        JSON.stringify({
          en: "General Objective of OPHEA",
          om: "Kaayyoo Waliigalaa OPHEA",
          am: "\u12E8OPHEA \u12A0\u1320\u1243\u120B\u12ED \u12D3\u120B\u121B"
        }),
        JSON.stringify({
          en: "To promote the development, professionalism, quality, and competitiveness of the hospitality and tourism industry in Oromia by strengthening cooperation among hospitality professionals, improving service standards, and supporting sustainable tourism development.",
          om: "Misooma, ogeessummaa, qulqullina fi dorgomtummaa industirii simannaa fi turizimii Oromiyaa keessatti walta'iinsa ogeeyyii cimsuun, sadarkaa tajaajilaa fooyyessuun fi misooma turizimii itti fufiinsa qabu deeggaruu.",
          am: "\u1260\u12A6\u122E\u121A\u12EB \u12E8\u12A5\u1295\u130D\u12F3 \u1270\u1240\u1263\u12ED\u1290\u1275\u1293 \u1271\u122A\u12DD\u121D \u12D8\u122D\u134D \u120D\u121B\u1275\u1295\u1363 \u1219\u12EB\u12CA \u1265\u1243\u1275\u1295\u1363 \u1325\u122B\u1275\u1295\u1293 \u1270\u12C8\u12F3\u12F3\u122A\u1290\u1275\u1295 \u1260\u1263\u1208\u1219\u12EB\u12CE\u127D \u1218\u12AB\u12A8\u120D \u1275\u1265\u1265\u122D\u1295 \u1260\u121B\u1320\u1293\u12A8\u122D \u121B\u1233\u12F0\u130D\u1362"
        }),
        1
      ]
    );
    const officialObjs = [
      "Represent and protect the interests and rights of its members.",
      "Organize conferences, trade exhibitions, professional meetings, and other events to foster market linkages and expand business opportunities for members.",
      "Promote market access and expand business opportunities for members.",
      "Provide up-to-date information to members and the tourism industry through research, market intelligence, industry analysis, and the collection of innovative ideas.",
      "Promote community-based tourism initiatives, including ecotourism, the promotion of traditional cuisine, and the preservation and development of local hospitality traditions, ensuring that communities benefit from tourism.",
      "Establish partnerships with organizations that share similar objectives, both locally and internationally, to contribute to the growth and development of the country's hospitality and tourism industry.",
      "Improve the quality of hospitality and tourism services in the country by providing training programmes, facilitating experience-sharing opportunities, and establishing professional competency standards.",
      "Support members in accessing domestic and international training opportunities and participating in business forums and events to broaden their investment opportunities."
    ];
    let i = 1;
    for (const item of officialObjs) {
      await pool.query(
        `INSERT INTO objectives (id, kind, title, description, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [
          `obj-official-${i}`,
          "official",
          JSON.stringify({ en: `Official Objective ${i}` }),
          JSON.stringify({ en: item }),
          i
        ]
      );
      i++;
    }
    const mainObjs = [
      "Unite and represent tourism and hospitality professionals in Oromia",
      "Improve skills and service quality through continuous vocational education",
      "Promote sustainable tourism and hospitality investment in the region",
      "Protect members' interests, ethics and professional welfare",
      "Create employment and business market linkages for practitioners",
      "Encourage ethical, sustainable, and responsible tourism development",
      "Strengthen collaboration between private sector and government entities",
      "Enhance regional competitiveness at national and international levels"
    ];
    let j = 1;
    for (const item of mainObjs) {
      await pool.query(
        `INSERT INTO objectives (id, kind, title, description, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [
          `obj-main-${j}`,
          "main",
          JSON.stringify({ en: `Main Objective ${j}` }),
          JSON.stringify({ en: item }),
          j
        ]
      );
      j++;
    }
  }
  const progCount = await pool.query("SELECT count(*) as count FROM programs");
  if (parseInt(progCount.rows[0].count, 10) === 0) {
    const programsList = [
      {
        slug: "research-and-study",
        icon: "BookOpen",
        title: { en: "Research and Study", om: "Qorannoo fi Qo'annoo", am: "\u121D\u122D\u121D\u122D\u1293 \u1325\u1293\u1275" },
        summary: { en: "Conducting in-depth industry research, market intelligence, and sustainable tourism policy studies.", om: "Qorannoowwan industirii turizimii fi qorannoo gabaa geggeessuu." }
      },
      {
        slug: "advocacy",
        icon: "ShieldCheck",
        title: { en: "Advocacy & Member Rights", om: "Falmii fi Mirga Miseensotaa", am: "\u1270\u121F\u130B\u127D\u1290\u1275\u1293 \u12E8\u12A0\u1263\u120B\u1275 \u1218\u1265\u1275" },
        summary: { en: "Advocating for professional standards, equitable industry regulations, and hospitality workforce welfare.", om: "Sadarkaa ogummaa fi mirga ogeeyyii kabachiisuu." }
      },
      {
        slug: "training-and-awareness",
        icon: "GraduationCap",
        title: { en: "Training and Awareness Creation", om: "Leenjii fi Hubannoo Uumuu", am: "\u1235\u120D\u1320\u1293\u1293 \u130D\u1295\u12DB\u1264 \u121B\u1235\u1328\u1260\u1325" },
        summary: { en: "Accredited professional masterclasses, culinary workshops, customer care excellence, and safety standards.", om: "Leenjiiwwan ogummaa fi dandeettii simannaa cimsuu." }
      },
      {
        slug: "b2b-bridge",
        icon: "Network",
        title: { en: "B2B Bridge", om: "Riqicha Daldalaa B2B", am: "\u12E8\u1295\u130D\u12F5 \u1208\u1295\u130D\u12F5 \u1275\u1235\u1235\u122D (B2B)" },
        summary: { en: "Connecting hoteliers, tour operators, eco-lodges, transport providers, and suppliers for strategic growth.", om: "Walitti hidhamiinsa daldalaa uumuu." }
      },
      {
        slug: "investment-bridge",
        icon: "TrendingUp",
        title: { en: "Investment Bridge", om: "Riqicha Invastimantii", am: "\u12E8\u12A2\u1295\u1268\u1235\u1275\u1218\u1295\u1275 \u12F5\u120D\u12F5\u12ED" },
        summary: { en: "Facilitating domestic and international hospitality investments across prime Oromia tourist corridors.", om: "Carraawwan invastimantii turizimii beeksisuu fi deeggaruu." }
      },
      {
        slug: "member-networking-jobs",
        icon: "Briefcase",
        title: { en: "Member Networking & Job Opportunities", om: "Walitti Hidhamiinsa fi Hojii Uumuu", am: "\u12E8\u12A0\u1263\u120B\u1275 \u1275\u1235\u1235\u122D \u12A5\u1293 \u12E8\u1235\u122B \u12A5\u12F5\u120E\u127D" },
        summary: { en: "Career matchmaking platform connecting certified professionals with top-tier hospitality employers.", om: "Miseensotaaf carraa hojii fi walitti dhufeenya uumuu." }
      },
      {
        slug: "international-relations",
        icon: "Globe",
        title: { en: "International Relations", om: "Hariiroo Idil-Addunyaa", am: "\u12D3\u1208\u121D \u12A0\u1240\u134D \u130D\u1295\u1299\u1290\u1276\u127D" },
        summary: { en: "Building bilateral pacts with global tourism bodies, UN Tourism, hotel syndicates, and cultural associations.", om: "Dhaabbilee idil-addunyaa waliin michooma uumuu." }
      }
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
          JSON.stringify(p.summary),
          order++
        ]
      );
    }
  }
}
function hashIdNumber(idType, idNumber) {
  const pepper = process.env.SERVER_PEPPER || "ophea_pepper_2026";
  return import_crypto.default.createHash("sha256").update(`${idType}:${String(idNumber).trim()}:${pepper}`).digest("hex");
}
var dbOperations = {
  // Members
  async getMembers(params) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const values = [];
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
    if (params.paid !== void 0) {
      const now = /* @__PURE__ */ new Date();
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      conditions.push(
        `${params.paid ? "" : "NOT "}EXISTS (SELECT 1 FROM payments p WHERE p.member_id = m.id AND p.status = 'paid' AND p.period_end >= $${idx})`
      );
      values.push(firstOfMonth);
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
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const validSortFields = {
      createdAt: "m.created_at",
      fullName: "m.full_name",
      memberNo: "m.member_no",
      registrationStatus: "m.registration_status",
      membershipStatus: "m.membership_status"
    };
    let sortCol = "m.created_at";
    let sortDir = "DESC";
    if (params.sort) {
      const [f, d] = params.sort.split(":");
      if (validSortFields[f]) sortCol = validSortFields[f];
      if (d && d.toLowerCase() === "asc") sortDir = "ASC";
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
        totalPages: Math.ceil(total / pageSize) || 1
      }
    };
  },
  async getMemberById(id) {
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
  async getMemberDocuments(memberId) {
    const res = await query("SELECT * FROM member_documents WHERE member_id = $1 ORDER BY uploaded_at ASC", [memberId]);
    return res.rows.map(mapRow);
  },
  async getMemberDocumentById(memberId, docId) {
    const res = await query("SELECT * FROM member_documents WHERE member_id = $1 AND id = $2", [memberId, docId]);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },
  async checkDuplicateMember(phone, email, idType, idNumber) {
    const idHash = hashIdNumber(idType, idNumber);
    const res = await query(
      `SELECT id, member_no, full_name, phone, email FROM members 
       WHERE phone = $1 OR email = $2 OR id_number_hash = $3`,
      [phone.trim(), email.toLowerCase().trim(), idHash]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },
  async getNextMemberNumber() {
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const res = await query(
      "SELECT count(*) as count FROM members WHERE member_no LIKE $1",
      [`OPHEA-${currentYear}-%`]
    );
    const nextSeq = parseInt(res.rows[0].count, 10) + 1;
    return `OPHEA-${currentYear}-${String(nextSeq).padStart(5, "0")}`;
  },
  async getNextReceiptNumber() {
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const res = await query(
      "SELECT count(*) as count FROM payments WHERE receipt_no LIKE $1",
      [`RCT-${currentYear}-%`]
    );
    const nextSeq = parseInt(res.rows[0].count, 10) + 1;
    return `RCT-${currentYear}-${String(nextSeq).padStart(6, "0")}`;
  },
  async createMember(data) {
    const res = await query(
      `INSERT INTO members (
        id, member_no, full_name, phone, email, gender, date_of_birth,
        membership_category, nationality, business_tin, skills, expertise_areas, interests,
        emergency_contact_name, emergency_contact_phone,
        employment_status, year_established, zone_sub_city, woreda, institution_name,
        graduation_level_id, occupation_type, sector_id, field_of_study_id,
        professional_category, organization_name, job_title, region_id, town,
        id_type, id_number_hash, id_number_last4, registration_status, membership_status,
        preferred_language, source, phone_verified_at, consent_at, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,
        $14,$15,
        $16,$17,$18,$19,$20,
        $21,$22,$23,$24,
        $25,$26,$27,$28,$29,
        $30,$31,$32,$33,$34,
        $35,$36,$37, NOW(), NOW(), NOW()
      ) RETURNING *`,
      [
        data.id || import_crypto.default.randomUUID(),
        data.memberNo,
        data.fullName,
        data.phone,
        String(data.email).toLowerCase(),
        data.gender || "unspecified",
        data.dateOfBirth || null,
        data.membershipCategory || null,
        data.nationality || null,
        data.businessTin || null,
        data.skills || null,
        data.expertiseAreas || [],
        data.interests || [],
        data.emergencyContactName || null,
        data.emergencyContactPhone || null,
        data.employmentStatus || null,
        data.yearEstablished ?? null,
        data.zoneSubCity || null,
        data.woreda || null,
        data.institutionName || null,
        data.graduationLevelId || null,
        data.occupationType || null,
        data.sectorId || null,
        data.fieldOfStudyId || null,
        data.professionalCategory || null,
        data.organizationName || null,
        data.jobTitle || null,
        data.regionId,
        data.town || null,
        data.idType,
        data.idNumberHash,
        data.idNumberLast4,
        data.registrationStatus || "pending",
        data.membershipStatus || "pending",
        data.preferredLanguage || "en",
        data.source || "online",
        data.phoneVerifiedAt || null
      ]
    );
    return mapRow(res.rows[0]);
  },
  async updateMemberStatus(id, membershipStatus) {
    const res = await query(
      "UPDATE members SET membership_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [membershipStatus, id]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },
  async approveMember(id, approvedBy) {
    const res = await query(
      `UPDATE members 
       SET registration_status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [approvedBy, id]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },
  async rejectMember(id, rejectionReason) {
    const res = await query(
      `UPDATE members 
       SET registration_status = 'rejected', membership_status = 'inactive', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [rejectionReason, id]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },
  async addMemberDocument(doc) {
    const res = await query(
      `INSERT INTO member_documents (id, member_id, kind, original_name, stored_name, mime, size, sha256, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
      [
        doc.id || import_crypto.default.randomUUID(),
        doc.memberId,
        doc.kind,
        doc.originalName,
        doc.storedName,
        doc.mime,
        doc.size,
        doc.sha256
      ]
    );
    return mapRow(res.rows[0]);
  },
  // Payments
  async createPayment(payment) {
    const res = await query(
      `INSERT INTO payments (
        id, member_id, plan_id, region_id, amount_etb, period, period_start, period_end,
        method, reference, bank, received_by, receipt_no, status, paid_at, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15)
      RETURNING *`,
      [
        import_crypto.default.randomUUID(),
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
        "paid",
        payment.note || null
      ]
    );
    await query(
      `UPDATE members SET membership_status = 'active', updated_at = NOW()
       WHERE id = $1 AND membership_status = 'pending'`,
      [payment.memberId]
    );
    return mapRow(res.rows[0]);
  },
  async getPayments(params) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const values = [];
    let idx = 1;
    const add = (sql, v) => {
      conditions.push(sql.replace("?", `$${idx}`));
      values.push(v);
      idx++;
    };
    if (params.memberId) add("p.member_id = ?", params.memberId);
    if (params.regionId) add("p.region_id = ?", params.regionId);
    if (params.status) add("p.status = ?", params.status);
    if (params.period) add("p.period = ?", params.period);
    if (params.method) add("p.method = ?", params.method);
    if (params.from) add("p.paid_at >= ?", params.from);
    if (params.to) add("p.paid_at < ?", `${params.to} 23:59:59.999`);
    if (params.q) {
      const like = `%${params.q.trim()}%`;
      conditions.push(`(p.receipt_no ILIKE $${idx} OR m.full_name ILIKE $${idx} OR m.member_no ILIKE $${idx})`);
      values.push(like);
      idx++;
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const from = "FROM payments p LEFT JOIN members m ON p.member_id = m.id LEFT JOIN regions r ON p.region_id = r.id";
    const countRes = await query(`SELECT count(*) as total ${from} ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].total, 10) || 0;
    const listRes = await query(
      `SELECT p.*, m.full_name as member_name, m.member_no, m.phone as member_phone, r.name as region_name
       ${from}
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
        totalPages: Math.ceil(total / pageSize) || 1
      }
    };
  },
  async getPaymentById(id) {
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
  async voidPayment(id, note) {
    const res = await query(
      `UPDATE payments SET status = 'void', void_reason = $2, voided_at = NOW() WHERE id = $1 RETURNING *`,
      [id, note || null]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },
  // Admin users
  async getAdminByUsernameOrEmail(identifier) {
    const clean = identifier.trim().toLowerCase();
    const res = await query(
      `SELECT * FROM admin_users WHERE LOWER(username) = $1 OR LOWER(email) = $1`,
      [clean]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },
  async getAdminById(id) {
    const res = await query(`SELECT * FROM admin_users WHERE id = $1`, [id]);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },
  async updateAdminLastLogin(id) {
    await query("UPDATE admin_users SET last_login = NOW() WHERE id = $1", [id]);
  },
  async changeAdminPassword(id, passwordHash) {
    await query(
      "UPDATE admin_users SET password_hash = $1, must_change_password = false WHERE id = $2",
      [passwordHash, id]
    );
  },
  // Audit Logs
  async createAuditLog(log) {
    try {
      await query(
        `INSERT INTO audit_logs (id, admin_id, action, entity, entity_id, before, after, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          import_crypto.default.randomUUID(),
          log.adminId || null,
          log.action,
          log.entity,
          log.entityId || null,
          log.before ? JSON.stringify(log.before) : null,
          log.after ? JSON.stringify(log.after) : null,
          log.ip || null
        ]
      );
    } catch (err) {
      console.warn("[AuditLog] Failed to record audit log:", err);
    }
  },
  // SMS Campaigns
  async getMembersForCampaign(filter) {
    const conditions = ["registration_status = 'approved'"];
    const values = [];
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
    const res = await query(`SELECT id, full_name, phone, member_no FROM members WHERE ${conditions.join(" AND ")}`, values);
    return res.rows.map(mapRow);
  },
  async createSmsCampaign(data) {
    const id = import_crypto.default.randomUUID();
    await query(
      `INSERT INTO sms_campaigns (id, name, message, audience_filter, status, scheduled_at, created_by, totals)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        data.name,
        data.message,
        JSON.stringify(data.audienceFilter || {}),
        data.scheduledAt ? "scheduled" : "draft",
        data.scheduledAt || null,
        data.createdBy,
        JSON.stringify(data.totals || {})
      ]
    );
    return id;
  },
  async getSmsCampaignById(id) {
    const res = await query("SELECT * FROM sms_campaigns WHERE id = $1", [id]);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  },
  async updateSmsCampaignStatus(id, status, totals) {
    if (totals) {
      await query("UPDATE sms_campaigns SET status = $1, totals = $2 WHERE id = $3", [status, JSON.stringify(totals), id]);
    } else {
      await query("UPDATE sms_campaigns SET status = $1 WHERE id = $2", [status, id]);
    }
  },
  async createSmsLog(log) {
    await query(
      `INSERT INTO sms_logs (id, campaign_id, member_id, phone, message, status, provider_message_id, error, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        import_crypto.default.randomUUID(),
        log.campaignId || null,
        log.memberId || null,
        log.phone,
        log.message,
        log.status,
        log.providerMessageId || null,
        log.error || null
      ]
    );
  },
  async getDueScheduledSmsCampaigns() {
    const res = await query(
      "SELECT * FROM sms_campaigns WHERE status = 'scheduled' AND scheduled_at <= NOW()"
    );
    return res.rows.map(mapRow);
  }
};

// src/backend/asyncRouter.ts
var import_express = __toESM(require("express"), 1);
var ROUTE_METHODS = ["get", "post", "put", "patch", "delete"];
function wrapHandler(fn) {
  if (Array.isArray(fn)) return fn.map(wrapHandler);
  if (typeof fn !== "function") return fn;
  if (fn.length === 4) return fn;
  const handler = fn;
  return function asyncSafeHandler(req, res, next) {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.catch === "function") {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}
function createAsyncRouter() {
  const router = import_express.default.Router();
  for (const method of ROUTE_METHODS) {
    const original = router[method].bind(router);
    router[method] = (path6, ...handlers) => original(path6, ...handlers.map(wrapHandler));
  }
  return router;
}

// src/backend/adminContentRoutes.ts
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
var import_crypto2 = __toESM(require("crypto"), 1);
var import_zod = require("zod");

// src/backend/middleware.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Fatal Security Error: JWT_SECRET must be configured and be at least 32 characters long.");
  }
  return secret;
}
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Missing or malformed authorization token"
    });
  }
  const token = authHeader.substring(7).trim();
  try {
    const decoded = import_jsonwebtoken.default.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or expired token"
    });
  }
}
async function loadAdminContext(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, error: "Unauthorized: User context missing" });
  }
  try {
    const admin = await dbOperations.getAdminById(req.user.id);
    if (!admin) {
      return res.status(401).json({ success: false, error: "User record no longer exists" });
    }
    if (!admin.isActive) {
      return res.status(403).json({ success: false, error: "Account has been deactivated. Please contact SuperAdmin." });
    }
    req.admin = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      permissions: admin.permissions || [],
      regionId: admin.regionId,
      mustChangePassword: admin.mustChangePassword
    };
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to verify admin context" });
  }
}
function requireSuperAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (req.admin.role !== "SuperAdmin") {
    return res.status(403).json({
      success: false,
      error: "Forbidden: SuperAdmin privileges required"
    });
  }
  next();
}
function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (req.admin.role === "SuperAdmin") {
      return next();
    }
    if (!req.admin.permissions.includes(permissionKey)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Missing required permission '${permissionKey}'`
      });
    }
    next();
  };
}
function requireRegionScope(req, res, next) {
  if (req.admin?.role === "RegionalAdmin") {
    if (!req.admin.regionId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: RegionalAdmin has no region assigned"
      });
    }
    req.query.regionId = req.admin.regionId;
    if (req.body && typeof req.body === "object") {
      req.body.regionId = req.admin.regionId;
    }
  }
  next();
}
var rateLimitBuckets = /* @__PURE__ */ new Map();
function customRateLimiter(options) {
  const { windowMs, max, message = "Too many requests. Please try again later." } = options;
  return (req, res, next) => {
    const effectiveMax = process.env.NODE_ENV === "production" ? max : Math.max(max, 100);
    const key = options.keyGenerator ? options.keyGenerator(req) : `${req.ip || "127.0.0.1"}:${req.baseUrl || req.path}`;
    const now = Date.now();
    const existing = rateLimitBuckets.get(key);
    if (!existing || now > existing.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    existing.count += 1;
    if (existing.count > effectiveMax) {
      res.setHeader("Retry-After", Math.ceil((existing.resetAt - now) / 1e3));
      return res.status(429).json({
        success: false,
        error: message
      });
    }
    next();
  };
}
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formattedFields = {};
      const err = result.error;
      for (const issue of err.issues) {
        const fieldName = issue.path.join(".") || "body";
        formattedFields[fieldName] = issue.message;
      }
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        fields: formattedFields
      });
    }
    req.body = result.data;
    next();
  };
}

// src/backend/adminDto.ts
function getLang(req) {
  const l = String(req.query.lang || "").toLowerCase();
  return l === "om" || l === "am" ? l : "en";
}
function parseJson(value, fallback) {
  if (value === null || value === void 0) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}
function toI18n(value) {
  const v = parseJson(value, null);
  if (v === null || v === void 0) return { en: "", om: "", am: "" };
  if (typeof v === "string") return { en: v, om: "", am: "" };
  if (typeof v === "object") {
    return {
      en: String(v.en ?? ""),
      om: String(v.om ?? ""),
      am: String(v.am ?? "")
    };
  }
  return { en: String(v), om: "", am: "" };
}
function pick(value, lang = "en") {
  const t2 = toI18n(value);
  return t2[lang] || t2.en || t2.om || t2.am || "";
}
function ymd(value) {
  if (value === null || value === void 0 || value === "") return void 0;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) {
    const utcMidnight = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0;
    if (utcMidnight) return value.toISOString().slice(0, 10);
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${m}-${d}`;
  }
  return void 0;
}
function iso(value) {
  if (value === null || value === void 0 || value === "") return void 0;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
function slugify(input, fallback = "item") {
  const s = String(input || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || fallback;
}
function str(v) {
  if (v === null || v === void 0) return void 0;
  const s = String(v).trim();
  return s === "" ? void 0 : s;
}
function bool(v, fallback) {
  if (v === void 0 || v === null) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return Boolean(v);
}
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function pageParams(req, defaultSize = 20) {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || String(defaultSize)), 10) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
function makeMeta(page, pageSize, total) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
function toAdminUserDto(row, lang = "en") {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    username: row.username,
    role: row.role,
    regionId: row.regionId || void 0,
    regionName: row.regionName ? pick(row.regionName, lang) : void 0,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    active: row.isActive !== false,
    mustChangePassword: Boolean(row.mustChangePassword),
    lastLoginAt: iso(row.lastLogin),
    createdAt: iso(row.createdAt) || (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function loadPaymentInfo(memberIds) {
  const out = {};
  if (memberIds.length === 0) return out;
  const placeholders = memberIds.map((_, i) => `$${i + 1}`).join(",");
  const res = await query(
    `SELECT member_id, amount_etb, paid_at, period_end FROM payments
     WHERE status = 'paid' AND member_id IN (${placeholders})
     ORDER BY paid_at DESC`,
    memberIds
  );
  const now = /* @__PURE__ */ new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  for (const r of res.rows) {
    const id = r.member_id;
    const periodEnd = ymd(r.period_end) || "";
    const paidCurrent = periodEnd >= firstOfMonth;
    if (!out[id]) {
      out[id] = {
        hasPaidRecentPeriod: paidCurrent,
        lastPaymentDate: ymd(r.paid_at),
        lastPaymentAmount: Number(r.amount_etb)
      };
    } else if (paidCurrent) {
      out[id].hasPaidRecentPeriod = true;
    }
  }
  return out;
}
function toMemberSummaryDto(row, lang, info) {
  return {
    id: row.id,
    memberNo: row.memberNo,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    gender: row.gender,
    regionId: row.regionId,
    regionName: pick(row.regionName, lang),
    sectorId: row.sectorId,
    sectorName: pick(row.sectorLabel, lang),
    fieldId: row.fieldOfStudyId,
    fieldName: pick(row.fieldLabel, lang),
    occupationType: row.occupationType || "other",
    graduationLevel: pick(row.gradLabel, lang),
    institution: row.organizationName || void 0,
    registrationStatus: row.registrationStatus,
    membershipStatus: row.membershipStatus,
    hasPaidRecentPeriod: info?.hasPaidRecentPeriod ?? false,
    lastPaymentDate: info?.lastPaymentDate,
    lastPaymentAmount: info?.lastPaymentAmount,
    registeredAt: iso(row.createdAt) || ""
  };
}
function toMemberDocumentDto(doc, memberId) {
  return {
    id: doc.id,
    name: doc.originalName,
    type: doc.kind,
    size: Number(doc.size) || 0,
    uploadedAt: iso(doc.uploadedAt) || "",
    url: `/admin/members/${memberId}/documents/${doc.id}`
  };
}
function toMemberDetailDto(row, docs, lang, info) {
  const last4 = row.idNumberLast4 ? String(row.idNumberLast4) : "";
  return {
    ...toMemberSummaryDto(row, lang, info),
    birthDate: ymd(row.dateOfBirth),
    idType: row.idType,
    idNumber: last4 ? `\u2022\u2022\u2022\u2022${last4}` : "",
    address: row.town || void 0,
    employer: row.organizationName || void 0,
    jobTitle: row.jobTitle || void 0,
    documents: docs.map((d) => toMemberDocumentDto(d, row.id)),
    rejectionReason: row.rejectionReason || void 0,
    approvedAt: iso(row.approvedAt),
    approvedBy: row.approvedBy || void 0,
    // additive fields (needed by the edit form)
    graduationLevelId: row.graduationLevelId,
    fieldOfStudyId: row.fieldOfStudyId,
    professionalCategory: row.professionalCategory || void 0,
    town: row.town || void 0,
    preferredLanguage: row.preferredLanguage || "en",
    source: row.source || "online",
    phoneVerifiedAt: iso(row.phoneVerifiedAt),
    membershipCategory: row.membershipCategory || void 0,
    dateOfBirth: ymd(row.dateOfBirth),
    nationality: row.nationality || void 0,
    emergencyContactName: row.emergencyContactName || void 0,
    emergencyContactPhone: row.emergencyContactPhone || void 0,
    businessTin: row.businessTin || void 0,
    skills: splitList(row.skills),
    expertiseAreas: Array.isArray(row.expertiseAreas) ? row.expertiseAreas : [],
    interests: Array.isArray(row.interests) ? row.interests : [],
    employmentStatus: row.employmentStatus || void 0,
    yearEstablished: row.yearEstablished ?? void 0,
    zoneSubCity: row.zoneSubCity || void 0,
    woreda: row.woreda || void 0,
    institutionName: row.institutionName || void 0
  };
}
function splitList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v !== "string") return [];
  return v.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
}
function normalizeMemberBody(b) {
  const pickFirst = (...keys) => {
    for (const k of keys) {
      if (b[k] !== void 0 && b[k] !== null && b[k] !== "") return b[k];
    }
    return void 0;
  };
  return {
    fullName: str(pickFirst("fullName", "name")),
    phone: str(pickFirst("phone")),
    email: str(pickFirst("email")),
    gender: str(pickFirst("gender")),
    dateOfBirth: str(pickFirst("dateOfBirth", "birthDate")),
    graduationLevelId: str(pickFirst("graduationLevelId", "graduationLevel")),
    occupationType: str(pickFirst("occupationType")),
    sectorId: str(pickFirst("sectorId")),
    fieldOfStudyId: str(pickFirst("fieldOfStudyId", "fieldId")),
    professionalCategory: str(pickFirst("professionalCategory")),
    organizationName: str(pickFirst("organizationName", "employer", "institution")),
    jobTitle: str(pickFirst("jobTitle")),
    regionId: str(pickFirst("regionId")),
    town: str(pickFirst("town", "address")),
    idType: str(pickFirst("idType")),
    idNumber: str(pickFirst("idNumber")),
    preferredLanguage: str(pickFirst("preferredLanguage")),
    membershipCategory: str(pickFirst("membershipCategory")),
    nationality: str(pickFirst("nationality")),
    emergencyContactName: str(pickFirst("emergencyContactName")),
    emergencyContactPhone: str(pickFirst("emergencyContactPhone")),
    businessTin: str(pickFirst("businessTin")),
    employmentStatus: str(pickFirst("employmentStatus")),
    yearEstablished: (() => {
      const v = pickFirst("yearEstablished");
      if (v === void 0) return void 0;
      const n = Number(v);
      return Number.isInteger(n) && n >= 1900 && n <= (/* @__PURE__ */ new Date()).getFullYear() ? n : void 0;
    })(),
    zoneSubCity: str(pickFirst("zoneSubCity", "subCityZone")),
    woreda: str(pickFirst("woreda")),
    institutionName: str(pickFirst("institutionName")),
    skills: b.skills === void 0 ? void 0 : Array.isArray(b.skills) ? b.skills.map(String).join(", ") : str(b.skills) ?? "",
    expertiseAreas: b.expertiseAreas === void 0 ? void 0 : Array.isArray(b.expertiseAreas) ? b.expertiseAreas.map(String) : [],
    interests: b.interests === void 0 ? void 0 : Array.isArray(b.interests) ? b.interests.map(String) : []
  };
}
function toPaymentDto(row, lang = "en") {
  return {
    id: row.id,
    receiptNo: row.receiptNo,
    memberId: row.memberId,
    memberNo: row.memberNo || "",
    memberName: row.memberName || "",
    memberPhone: row.memberPhone || void 0,
    regionId: row.regionId,
    regionName: pick(row.regionName, lang),
    amountEtb: Number(row.amountEtb),
    period: row.period,
    paidForDate: ymd(row.periodStart) || "",
    method: row.method,
    bank: row.bank || void 0,
    reference: row.reference || void 0,
    note: row.note || void 0,
    status: row.status,
    voidReason: row.voidReason || void 0,
    voidedAt: iso(row.voidedAt),
    recordedBy: row.receivedBy,
    createdAt: iso(row.paidAt || row.createdAt) || ""
  };
}
function toPlanDto(row) {
  return {
    id: row.id,
    name: row.name,
    period: row.period,
    amountEtb: Number(row.amountEtb),
    active: row.isActive !== false,
    description: row.description || void 0,
    createdAt: iso(row.createdAt)
  };
}
function toAnnouncementDto(row) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    status: row.status,
    title: toI18n(row.title),
    summary: toI18n(row.summary),
    body: toI18n(row.body),
    organization: row.organizationName || void 0,
    location: row.location || void 0,
    deadline: ymd(row.deadline),
    attachmentUrl: row.attachmentUrl || void 0,
    externalLink: row.externalLink || void 0,
    coverImageUrl: row.coverImageUrl || void 0,
    eventStartAt: iso(row.eventStartAt),
    eventEndAt: iso(row.eventEndAt),
    registrationOpen: Boolean(row.registrationOpen),
    registrationUrl: row.registrationUrl || void 0,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt) || ""
  };
}
function toProgramDto(row) {
  return {
    id: row.id,
    code: row.slug,
    icon: row.icon,
    order: Number(row.sortOrder ?? 0),
    title: toI18n(row.title),
    description: toI18n(row.summary),
    body: toI18n(row.body),
    active: row.isActive !== false
  };
}
var OBJECTIVE_KIND_TO_CATEGORY = {
  general: "General",
  official: "Official",
  main: "Main",
  specific: "Specific"
};
function objectiveCategoryToKind(category) {
  const k = String(category || "general").toLowerCase();
  return ["general", "official", "main", "specific"].includes(k) ? k : "general";
}
function toObjectiveDto(row) {
  return {
    id: row.id,
    category: OBJECTIVE_KIND_TO_CATEGORY[row.kind] || "General",
    order: Number(row.sortOrder ?? 0),
    title: toI18n(row.title),
    description: toI18n(row.description)
  };
}
function toPartnerDto(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.partnerType || "partner",
    logoUrl: row.logoUrl || void 0,
    website: row.websiteUrl || void 0,
    order: Number(row.sortOrder ?? 0),
    active: row.isActive !== false
  };
}
function toActivityDto(row) {
  return {
    id: row.id,
    title: pick(row.title, "en"),
    description: pick(row.description, "en") || void 0,
    date: ymd(row.activityDate) || "",
    imageUrl: row.imageUrl || void 0,
    isPublic: row.isPublic !== false,
    location: row.location || void 0
  };
}
function toRegionDto(row, memberCount = 0) {
  const name = toI18n(row.name);
  return {
    id: row.id,
    code: String(row.id).replace(/^reg-/, ""),
    name: name.en || name.om || name.am,
    nameOm: name.om || void 0,
    nameAm: name.am || void 0,
    active: row.isActive !== false,
    memberCount
  };
}
function toLookupDto(row) {
  const label = toI18n(row.label);
  return {
    id: row.id,
    code: row.code,
    name: label.en || label.om || label.am,
    nameOm: label.om || void 0,
    nameAm: label.am || void 0
  };
}
function toMessageDto(row) {
  return {
    id: row.id,
    fullName: row.fullName || row.name || "",
    email: row.email,
    phone: row.phone || void 0,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: iso(row.createdAt) || ""
  };
}
function toSubscriberDto(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || void 0,
    language: row.language || void 0,
    active: row.isActive !== false,
    subscribedAt: iso(row.createdAt) || ""
  };
}
function toSmsCampaignDto(row) {
  const totals = parseJson(row.totals, {});
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    audienceFilter: parseJson(row.audienceFilter, {}),
    recipientCount: Number(totals.targetCount ?? 0),
    sentCount: Number(totals.sentCount ?? 0),
    failedCount: Number(totals.failedCount ?? 0),
    status: row.status,
    createdAt: iso(row.createdAt) || ""
  };
}
function toSmsLogDto(row) {
  const status = row.status === "delivered" || row.status === "failed" ? row.status : "sent";
  return {
    id: row.id,
    recipientPhone: row.phone,
    recipientName: row.memberName || void 0,
    message: row.message,
    status,
    errorMessage: row.error || void 0,
    sentAt: iso(row.sentAt) || ""
  };
}
function summariseAuditDetails(row) {
  const after = parseJson(row.after, null);
  const before = parseJson(row.before, null);
  const src = after || before;
  if (!src || typeof src !== "object") return void 0;
  const parts = [];
  for (const [k, v] of Object.entries(src)) {
    if (v === null || v === void 0 || typeof v === "object") continue;
    const s = String(v);
    if (/hash|password|token/i.test(k)) continue;
    parts.push(`${k}: ${s.length > 60 ? `${s.slice(0, 57)}...` : s}`);
    if (parts.length >= 4) break;
  }
  return parts.length ? parts.join(" \xB7 ") : void 0;
}
function toAuditLogDto(row) {
  return {
    id: row.id,
    adminId: row.adminId || "",
    adminName: row.adminName || row.adminUsername || "System",
    action: row.action,
    entity: row.entity,
    entityId: row.entityId || void 0,
    details: summariseAuditDetails(row),
    ipAddress: row.ip || void 0,
    createdAt: iso(row.createdAt) || ""
  };
}
function toRecentActivityDto(row) {
  let type = "registration";
  if (row.action.startsWith("payment")) type = "payment";
  else if (row.action.startsWith("announcement")) type = "announcement";
  else if (row.action === "member.approve" || row.action === "member.reject") type = "approval";
  const label = row.action.replace(/[._]/g, " ");
  return {
    id: row.id,
    type,
    title: label.charAt(0).toUpperCase() + label.slice(1),
    description: summariseAuditDetails(row) || `${row.entity}${row.entityId ? ` #${String(row.entityId).slice(0, 8)}` : ""}`,
    timestamp: iso(row.createdAt) || "",
    actor: row.adminName || row.adminUsername || "System"
  };
}

// src/backend/adminContentRoutes.ts
var adminContentRouter = createAsyncRouter();
var auth = [authenticateJWT, loadAdminContext];
function fail(res, status, error, fields) {
  return res.status(status).json({ success: false, error, ...fields ? { fields } : {} });
}
async function updateById(table, id, cols) {
  const keys = Object.keys(cols).filter((k) => cols[k] !== void 0);
  if (keys.length === 0) {
    const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return cur.rows[0] ? mapRow(cur.rows[0]) : null;
  }
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => cols[k]);
  const res = await query(`UPDATE ${table} SET ${sets} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id]);
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}
async function uniqueSlug(table, base, excludeId) {
  let candidate = base;
  let n = 2;
  while (true) {
    const res = await query(`SELECT id FROM ${table} WHERE slug = $1`, [candidate]);
    if (res.rows.length === 0 || excludeId && res.rows.every((r) => r.id === excludeId)) return candidate;
    candidate = `${base}-${n++}`;
  }
}
function audit(req, action, entity, entityId, after) {
  return dbOperations.createAuditLog({
    adminId: req.admin?.id,
    action,
    entity,
    entityId,
    after,
    ip: req.ip
  });
}
var ANNOUNCEMENT_TYPES = ["news", "event", "vacancy", "proposal", "research"];
var ANNOUNCEMENT_STATUSES = ["draft", "published", "archived"];
function normalizeAnnouncementType(t2) {
  const v = String(t2 || "news");
  if (v === "call_for_proposal") return "proposal";
  if (v === "call_for_research") return "research";
  return ANNOUNCEMENT_TYPES.includes(v) ? v : "news";
}
adminContentRouter.get("/admin/announcements", auth, requirePermission("announcements"), async (req, res) => {
  const conds = [];
  const values = [];
  if (req.query.type) {
    values.push(normalizeAnnouncementType(req.query.type));
    conds.push(`type = $${values.length}`);
  }
  if (req.query.status) {
    values.push(String(req.query.status));
    conds.push(`status = $${values.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM announcements ${where} ORDER BY created_at DESC`, values);
  let items = result.rows.map(mapRow).map(toAnnouncementDto);
  const q = str(req.query.q)?.toLowerCase();
  if (q) {
    items = items.filter((a) => JSON.stringify([a.title, a.summary, a.organization]).toLowerCase().includes(q));
  }
  return res.json({ success: true, data: items });
});
adminContentRouter.get("/admin/announcements/:id", auth, requirePermission("announcements"), async (req, res) => {
  const result = await query("SELECT * FROM announcements WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) return fail(res, 404, "Announcement not found");
  return res.json({ success: true, data: toAnnouncementDto(mapRow(result.rows[0])) });
});
function announcementColumns(b) {
  const status = ANNOUNCEMENT_STATUSES.includes(b.status) ? b.status : void 0;
  return {
    type: b.type !== void 0 ? normalizeAnnouncementType(b.type) : void 0,
    title: b.title !== void 0 ? JSON.stringify(toI18n(b.title)) : void 0,
    summary: b.summary !== void 0 ? JSON.stringify(toI18n(b.summary)) : void 0,
    body: b.body !== void 0 ? JSON.stringify(toI18n(b.body)) : void 0,
    organization_name: b.organization !== void 0 || b.organizationName !== void 0 ? str(b.organization ?? b.organizationName) ?? null : void 0,
    location: b.location !== void 0 ? str(b.location) ?? null : void 0,
    deadline: b.deadline !== void 0 ? str(b.deadline) ?? null : void 0,
    attachment_url: b.attachmentUrl !== void 0 ? str(b.attachmentUrl) ?? null : void 0,
    external_link: b.externalLink !== void 0 ? str(b.externalLink) ?? null : void 0,
    cover_image_url: b.coverImageUrl !== void 0 ? str(b.coverImageUrl) ?? null : void 0,
    event_start_at: b.eventStartAt !== void 0 ? str(b.eventStartAt) ?? null : void 0,
    event_end_at: b.eventEndAt !== void 0 ? str(b.eventEndAt) ?? null : void 0,
    registration_open: b.registrationOpen !== void 0 ? bool(b.registrationOpen, false) : void 0,
    registration_url: b.registrationUrl !== void 0 ? str(b.registrationUrl) ?? null : void 0,
    status
  };
}
adminContentRouter.post("/admin/announcements", auth, requirePermission("announcements"), async (req, res) => {
  const b = req.body || {};
  const title = toI18n(b.title);
  if (!title.en && !title.om && !title.am) return fail(res, 400, "A title is required", { title: "Title is required" });
  const cols = announcementColumns(b);
  const status = cols.status || "draft";
  const id = import_crypto2.default.randomUUID();
  const slug = await uniqueSlug("announcements", slugify(str(b.slug) || title.en || title.om || title.am, "post"));
  const res2 = await query(
    `INSERT INTO announcements (
      id, slug, type, title, summary, body, attachment_url, external_link, organization_name, location,
      deadline, event_start_at, event_end_at, registration_url, registration_open, published_at, status,
      cover_image_url, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [
      id,
      slug,
      cols.type || "news",
      cols.title,
      cols.summary ?? JSON.stringify(toI18n(null)),
      cols.body ?? JSON.stringify(toI18n(null)),
      cols.attachment_url ?? null,
      cols.external_link ?? null,
      cols.organization_name ?? null,
      cols.location ?? null,
      cols.deadline ?? null,
      cols.event_start_at ?? null,
      cols.event_end_at ?? null,
      cols.registration_url ?? null,
      cols.registration_open ?? false,
      status === "published" ? (/* @__PURE__ */ new Date()).toISOString() : null,
      status,
      cols.cover_image_url ?? null,
      req.admin?.fullName || "Admin"
    ]
  );
  await audit(req, "announcement.create", "announcements", id, { title: title.en, status });
  return res.status(201).json({ success: true, data: toAnnouncementDto(mapRow(res2.rows[0])) });
});
adminContentRouter.put("/admin/announcements/:id", auth, requirePermission("announcements"), async (req, res) => {
  const b = req.body || {};
  const cols = { ...announcementColumns(b), updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (cols.status === "published") {
    const cur = await query("SELECT published_at FROM announcements WHERE id = $1", [req.params.id]);
    if (cur.rows[0] && !cur.rows[0].published_at) cols.published_at = (/* @__PURE__ */ new Date()).toISOString();
  }
  const updated = await updateById("announcements", req.params.id, cols);
  if (!updated) return fail(res, 404, "Announcement not found");
  await audit(req, "announcement.update", "announcements", req.params.id);
  return res.json({ success: true, data: toAnnouncementDto(updated) });
});
adminContentRouter.patch("/admin/announcements/:id/publish", auth, requirePermission("announcements"), async (req, res) => {
  const updated = await updateById("announcements", req.params.id, {
    status: "published",
    published_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (!updated) return fail(res, 404, "Announcement not found");
  await audit(req, "announcement.publish", "announcements", req.params.id);
  return res.json({ success: true, data: toAnnouncementDto(updated) });
});
adminContentRouter.patch("/admin/announcements/:id/archive", auth, requirePermission("announcements"), async (req, res) => {
  const updated = await updateById("announcements", req.params.id, { status: "archived", updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  if (!updated) return fail(res, 404, "Announcement not found");
  await audit(req, "announcement.archive", "announcements", req.params.id);
  return res.json({ success: true, data: toAnnouncementDto(updated) });
});
adminContentRouter.delete("/admin/announcements/:id", auth, requirePermission("announcements"), async (req, res) => {
  const del = await query("DELETE FROM announcements WHERE id = $1 RETURNING id", [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, "Announcement not found");
  await audit(req, "announcement.delete", "announcements", req.params.id);
  return res.json({ success: true, data: { success: true } });
});
adminContentRouter.get("/admin/programs", auth, requirePermission("programs"), async (_req, res) => {
  const result = await query("SELECT * FROM programs ORDER BY sort_order ASC");
  return res.json({ success: true, data: result.rows.map(mapRow).map(toProgramDto) });
});
adminContentRouter.post("/admin/programs", auth, requirePermission("programs"), async (req, res) => {
  const b = req.body || {};
  const title = toI18n(b.title);
  if (!title.en && !title.om && !title.am) return fail(res, 400, "A title is required", { title: "Title is required" });
  const description = toI18n(b.description ?? b.summary);
  const body = b.body !== void 0 ? toI18n(b.body) : description;
  const id = import_crypto2.default.randomUUID();
  const slug = await uniqueSlug("programs", slugify(str(b.code) || title.en || title.om, "program"));
  const ins = await query(
    `INSERT INTO programs (id, slug, icon, title, summary, body, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, slug, str(b.icon) || "Layers", JSON.stringify(title), JSON.stringify(description), JSON.stringify(body), num(b.order, 0), bool(b.active, true)]
  );
  await audit(req, "program.create", "programs", id, { title: title.en });
  return res.status(201).json({ success: true, data: toProgramDto(mapRow(ins.rows[0])) });
});
adminContentRouter.put("/admin/programs/:id", auth, requirePermission("programs"), async (req, res) => {
  const b = req.body || {};
  const cols = {
    icon: b.icon !== void 0 ? str(b.icon) || "Layers" : void 0,
    title: b.title !== void 0 ? JSON.stringify(toI18n(b.title)) : void 0,
    summary: b.description !== void 0 || b.summary !== void 0 ? JSON.stringify(toI18n(b.description ?? b.summary)) : void 0,
    body: b.body !== void 0 ? JSON.stringify(toI18n(b.body)) : void 0,
    sort_order: b.order !== void 0 ? num(b.order, 0) : void 0,
    is_active: b.active !== void 0 ? bool(b.active, true) : void 0
  };
  if (b.code !== void 0 && str(b.code)) cols.slug = await uniqueSlug("programs", slugify(String(b.code)), req.params.id);
  const updated = await updateById("programs", req.params.id, cols);
  if (!updated) return fail(res, 404, "Program not found");
  await audit(req, "program.update", "programs", req.params.id);
  return res.json({ success: true, data: toProgramDto(updated) });
});
adminContentRouter.delete("/admin/programs/:id", auth, requirePermission("programs"), async (req, res) => {
  const del = await query("DELETE FROM programs WHERE id = $1 RETURNING id", [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, "Program not found");
  await audit(req, "program.delete", "programs", req.params.id);
  return res.json({ success: true, data: { success: true } });
});
adminContentRouter.get("/admin/objectives", auth, requirePermission("programs"), async (_req, res) => {
  const result = await query("SELECT * FROM objectives ORDER BY kind ASC, sort_order ASC");
  return res.json({ success: true, data: result.rows.map(mapRow).map(toObjectiveDto) });
});
adminContentRouter.post("/admin/objectives", auth, requirePermission("programs"), async (req, res) => {
  const b = req.body || {};
  const title = toI18n(b.title);
  if (!title.en && !title.om && !title.am) return fail(res, 400, "A title is required", { title: "Title is required" });
  const id = import_crypto2.default.randomUUID();
  const ins = await query(
    `INSERT INTO objectives (id, kind, title, description, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, objectiveCategoryToKind(b.category ?? b.kind), JSON.stringify(title), JSON.stringify(toI18n(b.description)), num(b.order, 0)]
  );
  await audit(req, "objective.create", "objectives", id);
  return res.status(201).json({ success: true, data: toObjectiveDto(mapRow(ins.rows[0])) });
});
adminContentRouter.put("/admin/objectives/:id", auth, requirePermission("programs"), async (req, res) => {
  const b = req.body || {};
  const updated = await updateById("objectives", req.params.id, {
    kind: b.category !== void 0 || b.kind !== void 0 ? objectiveCategoryToKind(b.category ?? b.kind) : void 0,
    title: b.title !== void 0 ? JSON.stringify(toI18n(b.title)) : void 0,
    description: b.description !== void 0 ? JSON.stringify(toI18n(b.description)) : void 0,
    sort_order: b.order !== void 0 ? num(b.order, 0) : void 0
  });
  if (!updated) return fail(res, 404, "Objective not found");
  await audit(req, "objective.update", "objectives", req.params.id);
  return res.json({ success: true, data: toObjectiveDto(updated) });
});
adminContentRouter.delete("/admin/objectives/:id", auth, requirePermission("programs"), async (req, res) => {
  const del = await query("DELETE FROM objectives WHERE id = $1 RETURNING id", [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, "Objective not found");
  await audit(req, "objective.delete", "objectives", req.params.id);
  return res.json({ success: true, data: { success: true } });
});
adminContentRouter.get("/admin/partners", auth, requirePermission("partners"), async (_req, res) => {
  const result = await query("SELECT * FROM partners ORDER BY sort_order ASC, name ASC");
  return res.json({ success: true, data: result.rows.map(mapRow).map(toPartnerDto) });
});
adminContentRouter.post("/admin/partners", auth, requirePermission("partners"), async (req, res) => {
  const b = req.body || {};
  const name = str(b.name);
  if (!name) return fail(res, 400, "Partner name is required", { name: "Name is required" });
  const id = import_crypto2.default.randomUUID();
  const ins = await query(
    `INSERT INTO partners (id, name, partner_type, logo_url, website_url, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, name, str(b.type) || "partner", str(b.logoUrl) ?? null, str(b.website ?? b.websiteUrl) ?? null, num(b.order, 0), bool(b.active, true)]
  );
  await audit(req, "partner.create", "partners", id, { name });
  return res.status(201).json({ success: true, data: toPartnerDto(mapRow(ins.rows[0])) });
});
adminContentRouter.put("/admin/partners/:id", auth, requirePermission("partners"), async (req, res) => {
  const b = req.body || {};
  const updated = await updateById("partners", req.params.id, {
    name: b.name !== void 0 ? str(b.name) : void 0,
    partner_type: b.type !== void 0 ? str(b.type) || "partner" : void 0,
    logo_url: b.logoUrl !== void 0 ? str(b.logoUrl) ?? null : void 0,
    website_url: b.website !== void 0 || b.websiteUrl !== void 0 ? str(b.website ?? b.websiteUrl) ?? null : void 0,
    sort_order: b.order !== void 0 ? num(b.order, 0) : void 0,
    is_active: b.active !== void 0 ? bool(b.active, true) : void 0
  });
  if (!updated) return fail(res, 404, "Partner not found");
  await audit(req, "partner.update", "partners", req.params.id);
  return res.json({ success: true, data: toPartnerDto(updated) });
});
adminContentRouter.delete("/admin/partners/:id", auth, requirePermission("partners"), async (req, res) => {
  const del = await query("DELETE FROM partners WHERE id = $1 RETURNING id", [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, "Partner not found");
  await audit(req, "partner.delete", "partners", req.params.id);
  return res.json({ success: true, data: { success: true } });
});
adminContentRouter.get("/admin/activities", auth, requirePermission("activities"), async (_req, res) => {
  const result = await query("SELECT * FROM activities ORDER BY activity_date DESC");
  return res.json({ success: true, data: result.rows.map(mapRow).map(toActivityDto) });
});
adminContentRouter.post("/admin/activities", auth, requirePermission("activities"), async (req, res) => {
  const b = req.body || {};
  const title = str(typeof b.title === "object" ? b.title?.en : b.title);
  const date = str(b.date ?? b.activityDate);
  const errors = {};
  if (!title) errors.title = "Title is required";
  if (!date) errors.date = "Date is required";
  if (Object.keys(errors).length) return fail(res, 400, "Please fix the highlighted fields", errors);
  const id = import_crypto2.default.randomUUID();
  const description = typeof b.description === "object" ? b.description : { en: str(b.description) || "" };
  const ins = await query(
    `INSERT INTO activities (id, title, description, activity_date, image_url, is_public, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, JSON.stringify({ en: title }), JSON.stringify(toI18n(description)), date, str(b.imageUrl) ?? null, bool(b.isPublic, true), str(b.location) ?? null]
  );
  await audit(req, "activity.create", "activities", id, { title });
  return res.status(201).json({ success: true, data: toActivityDto(mapRow(ins.rows[0])) });
});
adminContentRouter.put("/admin/activities/:id", auth, requirePermission("activities"), async (req, res) => {
  const b = req.body || {};
  const title = b.title !== void 0 ? str(typeof b.title === "object" ? b.title?.en : b.title) : void 0;
  const updated = await updateById("activities", req.params.id, {
    title: title !== void 0 ? JSON.stringify({ en: title }) : void 0,
    description: b.description !== void 0 ? JSON.stringify(toI18n(typeof b.description === "object" ? b.description : { en: str(b.description) || "" })) : void 0,
    activity_date: b.date !== void 0 || b.activityDate !== void 0 ? str(b.date ?? b.activityDate) : void 0,
    image_url: b.imageUrl !== void 0 ? str(b.imageUrl) ?? null : void 0,
    is_public: b.isPublic !== void 0 ? bool(b.isPublic, true) : void 0,
    location: b.location !== void 0 ? str(b.location) ?? null : void 0
  });
  if (!updated) return fail(res, 404, "Activity not found");
  await audit(req, "activity.update", "activities", req.params.id);
  return res.json({ success: true, data: toActivityDto(updated) });
});
adminContentRouter.delete("/admin/activities/:id", auth, requirePermission("activities"), async (req, res) => {
  const del = await query("DELETE FROM activities WHERE id = $1 RETURNING id", [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, "Activity not found");
  await audit(req, "activity.delete", "activities", req.params.id);
  return res.json({ success: true, data: { success: true } });
});
var SETTING_DEFAULTS = {
  branding: {
    orgName: "Oromia Hospitality & Tourism Professionals Association",
    orgNameOm: "Waldaa Ogeeyyii Keessummeessuu fi Tuuriizimii Oromiyaa",
    tagline: "",
    mission: "",
    vision: "",
    supportEmail: "",
    supportPhone: ""
  },
  contact: {
    phonePrimary: "",
    phoneSecondary: "",
    emailGeneral: "",
    emailSupport: "",
    address: "",
    workingHours: "",
    mapCoordinates: ""
  },
  socials: { facebook: "", telegram: "", linkedin: "", twitter: "", youtube: "" },
  stats: { accreditedHotels: 0, certifiedGuides: 0, trainingGraduates: 0 }
};
var flatStrings = (keys, v, defaults) => Object.fromEntries(keys.map((k) => [k, v[k] === void 0 || v[k] === null ? defaults[k] ?? "" : String(v[k]).trim()]));
function cleanSetting(key, value) {
  const v = value && typeof value === "object" ? value : {};
  switch (key) {
    case "branding":
      return flatStrings(Object.keys(SETTING_DEFAULTS.branding), v, SETTING_DEFAULTS.branding);
    case "contact":
      return flatStrings(Object.keys(SETTING_DEFAULTS.contact), v, SETTING_DEFAULTS.contact);
    case "socials":
      return flatStrings(Object.keys(SETTING_DEFAULTS.socials), v, SETTING_DEFAULTS.socials);
    case "stats":
      return {
        accreditedHotels: Math.max(0, Math.trunc(num(v.accreditedHotels, 0))),
        certifiedGuides: Math.max(0, Math.trunc(num(v.certifiedGuides, 0))),
        trainingGraduates: Math.max(0, Math.trunc(num(v.trainingGraduates, 0)))
      };
  }
  return v;
}
async function readSetting(key) {
  const res = await query("SELECT value FROM site_settings WHERE key = $1", [key]);
  const stored = res.rows[0] ? parseJson(res.rows[0].value, {}) : {};
  return cleanSetting(key, { ...SETTING_DEFAULTS[key], ...stored && typeof stored === "object" ? stored : {} });
}
adminContentRouter.get("/admin/settings/:key", auth, requirePermission("settings.site"), async (req, res) => {
  if (!(req.params.key in SETTING_DEFAULTS)) return fail(res, 404, `Unknown setting '${req.params.key}'`);
  return res.json({ success: true, data: await readSetting(req.params.key) });
});
adminContentRouter.put("/admin/settings/:key", auth, requirePermission("settings.site"), async (req, res) => {
  const key = req.params.key;
  if (!(key in SETTING_DEFAULTS)) return fail(res, 404, `Unknown setting '${key}'`);
  const raw = req.body && typeof req.body === "object" && "value" in req.body ? req.body.value : req.body;
  const value = cleanSetting(key, raw);
  if (key === "contact") {
    const errs = {};
    for (const k of ["emailGeneral", "emailSupport"]) {
      if (value[k] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value[k])) errs[k] = "Invalid email address";
    }
    if (Object.keys(errs).length) return fail(res, 400, "Please fix the highlighted fields", errs);
  }
  await query(
    `INSERT INTO site_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)]
  );
  await audit(req, "settings.update", "site_settings", key);
  return res.json({ success: true, data: { success: true } });
});
adminContentRouter.get("/admin/regions", auth, requirePermission("regions"), async (_req, res) => {
  const regions = await query("SELECT * FROM regions ORDER BY sort_order ASC");
  const counts = await query("SELECT region_id, COUNT(*) AS total FROM members GROUP BY region_id");
  const byRegion = {};
  for (const c of counts.rows) byRegion[c.region_id] = parseInt(c.total, 10) || 0;
  const data = regions.rows.map(mapRow).map((r) => toRegionDto(r, byRegion[r.id] || 0));
  return res.json({ success: true, data });
});
adminContentRouter.post("/admin/regions", auth, requirePermission("regions"), async (req, res) => {
  const b = req.body || {};
  const name = toI18n({ en: str(b.name) || "", om: str(b.nameOm) || "", am: str(b.nameAm) || "" });
  if (!name.en) return fail(res, 400, "Region name is required", { name: "Name is required" });
  const baseId = `reg-${slugify(name.en, "region")}`;
  let id = baseId;
  let n = 2;
  while ((await query("SELECT id FROM regions WHERE id = $1", [id])).rows.length > 0) id = `${baseId}-${n++}`;
  const maxRes = await query("SELECT COALESCE(MAX(sort_order), 0) AS max FROM regions");
  const nextOrder = (parseInt(maxRes.rows[0]?.max, 10) || 0) + 1;
  const ins = await query(
    `INSERT INTO regions (id, name, parent_id, type, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, JSON.stringify(name), null, str(b.type) || "zone", nextOrder, bool(b.active, true)]
  );
  await audit(req, "region.create", "regions", id, { name: name.en });
  return res.status(201).json({ success: true, data: toRegionDto(mapRow(ins.rows[0]), 0) });
});
adminContentRouter.put("/admin/regions/:id", auth, requirePermission("regions"), async (req, res) => {
  const b = req.body || {};
  const cur = await query("SELECT * FROM regions WHERE id = $1", [req.params.id]);
  if (cur.rows.length === 0) return fail(res, 404, "Region not found");
  const existing = toI18n(cur.rows[0].name);
  const name = {
    en: b.name !== void 0 ? str(b.name) || existing.en : existing.en,
    om: b.nameOm !== void 0 ? str(b.nameOm) || "" : existing.om,
    am: b.nameAm !== void 0 ? str(b.nameAm) || "" : existing.am
  };
  const updated = await updateById("regions", req.params.id, {
    name: JSON.stringify(name),
    type: b.type !== void 0 ? str(b.type) || "zone" : void 0,
    is_active: b.active !== void 0 ? bool(b.active, true) : void 0
  });
  await audit(req, "region.update", "regions", req.params.id);
  const cnt = await query("SELECT COUNT(*) AS total FROM members WHERE region_id = $1", [req.params.id]);
  return res.json({ success: true, data: toRegionDto(updated, parseInt(cnt.rows[0]?.total, 10) || 0) });
});
var LOOKUP_TABLES = {
  sectors: "lookup_sectors",
  fields: "lookup_fields_of_study",
  "graduation-levels": "lookup_graduation_levels",
  occupations: "lookup_occupation_types"
};
adminContentRouter.get("/admin/lookups/:type", auth, requirePermission("lookups"), async (req, res) => {
  const table = LOOKUP_TABLES[req.params.type];
  if (!table) return fail(res, 400, "Invalid lookup type");
  const result = await query(`SELECT * FROM ${table} WHERE is_active = true ORDER BY sort_order ASC`);
  return res.json({ success: true, data: result.rows.map(mapRow).map(toLookupDto) });
});
var PERIODS = ["weekly", "monthly", "yearly"];
adminContentRouter.get("/admin/contribution-plans", auth, requirePermission("payments"), async (_req, res) => {
  const result = await query("SELECT * FROM contribution_plans ORDER BY amount_etb ASC");
  return res.json({ success: true, data: result.rows.map(mapRow).map(toPlanDto) });
});
adminContentRouter.post("/admin/contribution-plans", auth, requirePermission("payments.record"), async (req, res) => {
  const b = req.body || {};
  const errors = {};
  if (!str(b.name)) errors.name = "Name is required";
  if (!PERIODS.includes(b.period)) errors.period = "Period must be weekly, monthly or yearly";
  if (!(num(b.amountEtb, 0) > 0)) errors.amountEtb = "Amount must be greater than 0";
  if (Object.keys(errors).length) return fail(res, 400, "Please fix the highlighted fields", errors);
  const id = import_crypto2.default.randomUUID();
  const ins = await query(
    `INSERT INTO contribution_plans (id, name, period, amount_etb, description, is_active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, str(b.name), b.period, num(b.amountEtb), str(b.description) ?? null, bool(b.active, true)]
  );
  await audit(req, "plan.create", "contribution_plans", id, { name: b.name, amountEtb: b.amountEtb });
  return res.status(201).json({ success: true, data: toPlanDto(mapRow(ins.rows[0])) });
});
adminContentRouter.put("/admin/contribution-plans/:id", auth, requirePermission("payments.record"), async (req, res) => {
  const b = req.body || {};
  if (b.period !== void 0 && !PERIODS.includes(b.period)) return fail(res, 400, "Invalid period", { period: "Invalid period" });
  if (b.amountEtb !== void 0 && !(num(b.amountEtb, 0) > 0)) return fail(res, 400, "Invalid amount", { amountEtb: "Amount must be greater than 0" });
  const updated = await updateById("contribution_plans", req.params.id, {
    name: b.name !== void 0 ? str(b.name) : void 0,
    period: b.period,
    amount_etb: b.amountEtb !== void 0 ? num(b.amountEtb) : void 0,
    description: b.description !== void 0 ? str(b.description) ?? null : void 0,
    is_active: b.active !== void 0 ? bool(b.active, true) : void 0
  });
  if (!updated) return fail(res, 404, "Plan not found");
  await audit(req, "plan.update", "contribution_plans", req.params.id);
  return res.json({ success: true, data: toPlanDto(updated) });
});
adminContentRouter.delete("/admin/contribution-plans/:id", auth, requirePermission("payments.record"), async (req, res) => {
  const del = await query("DELETE FROM contribution_plans WHERE id = $1 RETURNING id", [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, "Plan not found");
  await audit(req, "plan.delete", "contribution_plans", req.params.id);
  return res.json({ success: true, data: { success: true } });
});
var MESSAGE_STATUSES = ["new", "read", "in_progress", "resolved"];
adminContentRouter.get("/admin/messages", auth, requirePermission("messages"), async (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const status = str(req.query.status);
  const where = status ? "WHERE status = $1" : "";
  const values = status ? [status] : [];
  const total = parseInt((await query(`SELECT COUNT(*) AS total FROM contact_messages ${where}`, values)).rows[0].total, 10) || 0;
  const rows = await query(
    `SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset]
  );
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toMessageDto), meta: makeMeta(page, pageSize, total) });
});
adminContentRouter.patch("/admin/messages/:id", auth, requirePermission("messages"), async (req, res) => {
  const status = req.body?.status;
  if (!MESSAGE_STATUSES.includes(status)) return fail(res, 400, "Invalid status", { status: `Must be one of: ${MESSAGE_STATUSES.join(", ")}` });
  const updated = await updateById("contact_messages", req.params.id, { status });
  if (!updated) return fail(res, 404, "Message not found");
  return res.json({ success: true, data: toMessageDto(updated) });
});
adminContentRouter.get("/admin/subscribers", auth, requirePermission("subscribers"), async (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const total = parseInt((await query("SELECT COUNT(*) AS total FROM newsletter_subscribers")).rows[0].total, 10) || 0;
  const rows = await query("SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT $1 OFFSET $2", [pageSize, offset]);
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toSubscriberDto), meta: makeMeta(page, pageSize, total) });
});
adminContentRouter.delete("/admin/subscribers/:id", auth, requirePermission("subscribers"), async (req, res) => {
  const del = await query("DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING id", [req.params.id]);
  if (del.rows.length === 0) return fail(res, 404, "Subscriber not found");
  await audit(req, "subscriber.delete", "newsletter_subscribers", req.params.id);
  return res.json({ success: true, data: { success: true } });
});
adminContentRouter.get("/admin/sms/campaigns", auth, requirePermission("sms"), async (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const total = parseInt((await query("SELECT COUNT(*) AS total FROM sms_campaigns")).rows[0].total, 10) || 0;
  const rows = await query("SELECT * FROM sms_campaigns ORDER BY created_at DESC LIMIT $1 OFFSET $2", [pageSize, offset]);
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toSmsCampaignDto), meta: makeMeta(page, pageSize, total) });
});
adminContentRouter.get("/admin/sms/logs", auth, requirePermission("sms"), async (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const status = str(req.query.status);
  const where = status ? "WHERE l.status = $1" : "";
  const values = status ? [status] : [];
  const total = parseInt((await query(`SELECT COUNT(*) AS total FROM sms_logs l ${where}`, values)).rows[0].total, 10) || 0;
  const rows = await query(
    `SELECT l.*, m.full_name AS member_name FROM sms_logs l
     LEFT JOIN members m ON l.member_id = m.id
     ${where} ORDER BY l.sent_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset]
  );
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toSmsLogDto), meta: makeMeta(page, pageSize, total) });
});
var PERMISSION_OPTIONS = [
  { key: "dashboard", label: "View Dashboard & Analytics" },
  { key: "members", label: "View Members Register" },
  { key: "members.approve", label: "Approve & Reject Registrations" },
  { key: "members.edit", label: "Edit Member Details" },
  { key: "members.export", label: "Export Members (Excel/PDF)" },
  { key: "payments", label: "View Payments" },
  { key: "payments.record", label: "Record Contributions & Manage Plans" },
  { key: "payments.void", label: "Void Payments" },
  { key: "contributions.dashboard", label: "View Contribution Charts" },
  { key: "announcements", label: "Manage Announcements & Vacancies" },
  { key: "programs", label: "Manage Programs & Objectives" },
  { key: "partners", label: "Manage Partners" },
  { key: "activities", label: "Manage Activities" },
  { key: "sms", label: "Send SMS & Campaigns" },
  { key: "messages", label: "Manage Contact Inbox" },
  { key: "subscribers", label: "Manage Newsletter Subscribers" },
  { key: "regions", label: "Manage Regions" },
  { key: "lookups", label: "View System Lookups" },
  { key: "settings.site", label: "Manage Site Settings" },
  { key: "audit", label: "View Audit Logs" }
];
var VALID_PERMISSION_KEYS = PERMISSION_OPTIONS.map((p) => p.key);
adminContentRouter.get("/admin/meta/permissions", auth, (_req, res) => {
  return res.json({ success: true, data: PERMISSION_OPTIONS });
});
var USER_SELECT = `SELECT u.*, r.name AS region_name FROM admin_users u LEFT JOIN regions r ON u.region_id = r.id`;
adminContentRouter.get("/admin/users", auth, requireSuperAdmin, async (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const lang = getLang(req);
  const total = parseInt((await query("SELECT COUNT(*) AS total FROM admin_users")).rows[0].total, 10) || 0;
  const rows = await query(`${USER_SELECT} ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, [pageSize, offset]);
  return res.json({
    success: true,
    data: rows.rows.map(mapRow).map((r) => toAdminUserDto(r, lang)),
    meta: makeMeta(page, pageSize, total)
  });
});
var createUserSchema = import_zod.z.object({
  username: import_zod.z.string().min(3),
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(8, "Password must be at least 8 characters"),
  fullName: import_zod.z.string().min(2),
  role: import_zod.z.enum(["SuperAdmin", "RegionalAdmin", "Finance", "Editor"]),
  permissions: import_zod.z.array(import_zod.z.string()).optional(),
  regionId: import_zod.z.string().optional().nullable()
});
adminContentRouter.post("/admin/users", auth, requireSuperAdmin, validateBody(createUserSchema), async (req, res) => {
  const b = req.body;
  if (b.role === "RegionalAdmin" && !b.regionId) return fail(res, 400, "regionId is required for RegionalAdmin role", { regionId: "Required for RegionalAdmin" });
  const dup = await query("SELECT id FROM admin_users WHERE LOWER(username) = $1 OR LOWER(email) = $2", [b.username.toLowerCase(), b.email.toLowerCase()]);
  if (dup.rows.length > 0) return fail(res, 409, "A user with this username or email already exists");
  const permissions = (b.permissions || []).filter((p) => VALID_PERMISSION_KEYS.includes(p));
  const id = import_crypto2.default.randomUUID();
  const hash = await import_bcryptjs2.default.hash(b.password, 10);
  await query(
    `INSERT INTO admin_users (id, username, email, password_hash, full_name, role, permissions, region_id, is_active, must_change_password)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true)`,
    [id, b.username.toLowerCase(), b.email.toLowerCase(), hash, b.fullName, b.role, permissions, b.role === "RegionalAdmin" ? b.regionId : b.regionId || null]
  );
  await audit(req, "admin.create", "admin_users", id, { username: b.username, email: b.email, role: b.role });
  const row = await query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return res.status(201).json({ success: true, data: toAdminUserDto(mapRow(row.rows[0]), getLang(req)) });
});
adminContentRouter.put("/admin/users/:id", auth, requireSuperAdmin, async (req, res) => {
  const b = req.body || {};
  const cur = await query("SELECT * FROM admin_users WHERE id = $1", [req.params.id]);
  if (cur.rows.length === 0) return fail(res, 404, "User not found");
  const role = b.role ?? cur.rows[0].role;
  if (!["SuperAdmin", "RegionalAdmin", "Finance", "Editor"].includes(role)) return fail(res, 400, "Invalid role", { role: "Invalid role" });
  const regionId = b.regionId !== void 0 ? str(b.regionId) ?? null : cur.rows[0].region_id;
  if (role === "RegionalAdmin" && !regionId) return fail(res, 400, "regionId is required for RegionalAdmin role", { regionId: "Required for RegionalAdmin" });
  if (req.params.id === req.admin.id && role !== "SuperAdmin") return fail(res, 400, "You cannot remove your own SuperAdmin role");
  if (b.email !== void 0) {
    const dup = await query("SELECT id FROM admin_users WHERE LOWER(email) = $1 AND id <> $2", [String(b.email).toLowerCase(), req.params.id]);
    if (dup.rows.length > 0) return fail(res, 409, "Another user already uses this email", { email: "Email already in use" });
  }
  await updateById("admin_users", req.params.id, {
    full_name: b.fullName !== void 0 ? str(b.fullName) : void 0,
    email: b.email !== void 0 ? String(b.email).toLowerCase() : void 0,
    role,
    permissions: Array.isArray(b.permissions) ? b.permissions.filter((p) => VALID_PERMISSION_KEYS.includes(p)) : void 0,
    region_id: regionId
  });
  await audit(req, "admin.update", "admin_users", req.params.id, { role });
  const row = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);
  return res.json({ success: true, data: toAdminUserDto(mapRow(row.rows[0]), getLang(req)) });
});
adminContentRouter.patch("/admin/users/:id/active", auth, requireSuperAdmin, async (req, res) => {
  const active = bool(req.body?.active ?? req.body?.isActive, true);
  if (req.params.id === req.admin.id && !active) return fail(res, 400, "You cannot deactivate your own account");
  const updated = await updateById("admin_users", req.params.id, { is_active: active });
  if (!updated) return fail(res, 404, "User not found");
  await audit(req, active ? "admin.activate" : "admin.deactivate", "admin_users", req.params.id);
  const row = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);
  return res.json({ success: true, data: toAdminUserDto(mapRow(row.rows[0]), getLang(req)) });
});
adminContentRouter.post("/admin/users/:id/reset-password", auth, requireSuperAdmin, async (req, res) => {
  const cur = await query("SELECT id FROM admin_users WHERE id = $1", [req.params.id]);
  if (cur.rows.length === 0) return fail(res, 404, "User not found");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = import_crypto2.default.randomBytes(12);
  let temp = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  temp = `${temp.slice(0, 9)}Aa7`;
  const hash = await import_bcryptjs2.default.hash(temp, 10);
  await updateById("admin_users", req.params.id, { password_hash: hash, must_change_password: true });
  await audit(req, "admin.reset_password", "admin_users", req.params.id);
  return res.json({ success: true, data: { success: true, tempPassword: temp } });
});
adminContentRouter.get("/admin/audit-logs", auth, requirePermission("audit"), async (req, res) => {
  const { page, pageSize, offset } = pageParams(req, 25);
  const total = parseInt((await query("SELECT COUNT(*) AS total FROM audit_logs")).rows[0].total, 10) || 0;
  const rows = await query(
    `SELECT a.*, u.full_name AS admin_name, u.username AS admin_username
     FROM audit_logs a LEFT JOIN admin_users u ON a.admin_id = u.id
     ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );
  return res.json({ success: true, data: rows.rows.map(mapRow).map(toAuditLogDto), meta: makeMeta(page, pageSize, total) });
});

// src/backend/routes.ts
var import_bcryptjs3 = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"), 1);
var import_zod2 = require("zod");
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);

// src/services/statsService.ts
var pad = (n) => String(n).padStart(2, "0");
var monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
function isoWeekKey(d) {
  const t2 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t2.getUTCDay() || 7;
  t2.setUTCDate(t2.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t2.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t2.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${t2.getUTCFullYear()}-W${pad(week)}`;
}
var StatsService = class {
  async getAdminSummary(regionId) {
    const mem = await query(
      `SELECT id, membership_status, registration_status, gender, occupation_type, created_at
       FROM members ${regionId ? "WHERE region_id = $1" : ""}`,
      regionId ? [regionId] : []
    );
    const members = mem.rows.map(mapRow);
    const now = /* @__PURE__ */ new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let active = 0, inactive = 0, pending = 0, pendingReg = 0, female = 0, male = 0, gov = 0, priv = 0, other = 0, newThisMonth = 0;
    for (const m of members) {
      if (m.membershipStatus === "active") active++;
      else if (m.membershipStatus === "inactive") inactive++;
      else pending++;
      if (m.registrationStatus === "pending") pendingReg++;
      if (m.gender === "female") female++;
      else if (m.gender === "male") male++;
      if (m.occupationType === "government") gov++;
      else if (m.occupationType === "private") priv++;
      else other++;
      if (m.createdAt && new Date(m.createdAt) >= firstOfMonth) newThisMonth++;
    }
    const pay = await query(
      `SELECT member_id, amount_etb, paid_at, period_end FROM payments
       WHERE status = 'paid' ${regionId ? "AND member_id IN (SELECT id FROM members WHERE region_id = $1)" : ""}`,
      regionId ? [regionId] : []
    );
    let year = 0, month = 0;
    const paidCurrent = /* @__PURE__ */ new Set();
    const firstStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    for (const p of pay.rows) {
      const paidAt = new Date(p.paid_at);
      const amt = Number(p.amount_etb) || 0;
      if (paidAt.getFullYear() === now.getFullYear()) year += amt;
      if (paidAt >= firstOfMonth) month += amt;
      if ((ymd(p.period_end) || "") >= firstStr) paidCurrent.add(p.member_id);
    }
    const eligible = members.filter((m) => m.registrationStatus === "approved" && m.membershipStatus === "active");
    const unpaid = eligible.filter((m) => !paidCurrent.has(m.id)).length;
    return {
      totalMembers: members.length,
      activeMembers: active,
      pendingMembers: pending,
      inactiveMembers: inactive,
      femaleMembers: female,
      maleMembers: male,
      governmentSector: gov,
      privateSector: priv,
      totalCollectedThisYear: year,
      totalCollectedThisMonth: month,
      unpaidMembersCount: unpaid,
      // convenience aliases the admin shim also understands
      active,
      inactive,
      pending,
      pendingRegistrations: pendingReg,
      female,
      male,
      governmentCount: gov,
      privateCount: priv,
      otherCount: other,
      newThisMonth
    };
  }
  async getMembersByDimension(dimension, lang = "en", regionId) {
    const cols = {
      gender: "gender",
      sector: "sector_id",
      field: "field_of_study_id",
      occupation: "occupation_type",
      region: "region_id",
      graduationLevel: "graduation_level_id"
    };
    const col = cols[dimension];
    if (!col) return [];
    const params = [];
    let where = "WHERE registration_status = 'approved'";
    if (regionId) {
      where += " AND region_id = $1";
      params.push(regionId);
    }
    const res = await query(`SELECT ${col} AS k FROM members ${where}`, params);
    const counts = /* @__PURE__ */ new Map();
    for (const r of res.rows) {
      const k = r.k == null ? "" : String(r.k);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const labels = /* @__PURE__ */ new Map();
    const lookupSql = {
      sector: "SELECT id, label AS name FROM lookup_sectors",
      field: "SELECT id, label AS name FROM lookup_fields_of_study",
      graduationLevel: "SELECT id, label AS name FROM lookup_graduation_levels",
      region: "SELECT id, name FROM regions"
    };
    if (lookupSql[dimension]) {
      const lr = await query(lookupSql[dimension]);
      for (const r of lr.rows) labels.set(r.id, pick(parseJson(r.name, {}), lang) || r.id);
    } else if (dimension === "gender") {
      labels.set("male", "Male");
      labels.set("female", "Female");
    } else if (dimension === "occupation") {
      labels.set("private", "Private");
      labels.set("government", "Government");
      labels.set("other", "Other");
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    return Array.from(counts.entries()).filter(([k]) => k !== "").map(([k, value]) => ({
      label: labels.get(k) || k,
      value,
      percentage: total ? Number((value / total * 100).toFixed(1)) : 0
    })).sort((a, b) => b.value - a.value);
  }
  async getContributionsDashboard(params) {
    const months = params.range === "3m" ? 3 : params.range === "6m" ? 6 : 12;
    const group = params.group || "month";
    const regionId = params.regionId || void 0;
    const now = /* @__PURE__ */ new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const pay = await query(
      `SELECT p.member_id, p.amount_etb, p.method, p.paid_at, p.period_end, m.region_id
       FROM payments p LEFT JOIN members m ON p.member_id = m.id
       WHERE p.status = 'paid' ${regionId ? "AND m.region_id = $1" : ""}`,
      regionId ? [regionId] : []
    );
    let totalYear = 0, totalMonth = 0;
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const timeline = /* @__PURE__ */ new Map();
    const methods = /* @__PURE__ */ new Map();
    const regionAmount = /* @__PURE__ */ new Map();
    const paidCurrent = /* @__PURE__ */ new Set();
    const firstStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    if (group === "month") {
      for (let i = 0; i < months; i++) timeline.set(monthKey(new Date(since.getFullYear(), since.getMonth() + i, 1)), 0);
    }
    for (const p of pay.rows) {
      const paidAt = new Date(p.paid_at);
      const amt = Number(p.amount_etb) || 0;
      if (paidAt.getFullYear() === now.getFullYear()) totalYear += amt;
      if (paidAt >= firstOfMonth) totalMonth += amt;
      if ((ymd(p.period_end) || "") >= firstStr) paidCurrent.add(p.member_id);
      if (paidAt >= since) {
        const key = group === "year" ? String(paidAt.getFullYear()) : group === "week" ? isoWeekKey(paidAt) : monthKey(paidAt);
        timeline.set(key, (timeline.get(key) || 0) + amt);
        methods.set(p.method, (methods.get(p.method) || 0) + amt);
        if (p.region_id) regionAmount.set(p.region_id, (regionAmount.get(p.region_id) || 0) + amt);
      }
    }
    const mem = await query(
      `SELECT id, region_id FROM members WHERE registration_status = 'approved' AND membership_status = 'active' ${regionId ? "AND region_id = $1" : ""}`,
      regionId ? [regionId] : []
    );
    const unpaidByRegion = /* @__PURE__ */ new Map();
    let paidCount = 0, unpaidCount = 0;
    for (const m of mem.rows) {
      if (paidCurrent.has(m.id)) paidCount++;
      else {
        unpaidCount++;
        unpaidByRegion.set(m.region_id, (unpaidByRegion.get(m.region_id) || 0) + 1);
      }
    }
    const regs = await query("SELECT id, name FROM regions");
    const regionName = /* @__PURE__ */ new Map();
    for (const r of regs.rows) regionName.set(r.id, pick(parseJson(r.name, {}), "en") || r.id);
    const regionIds = /* @__PURE__ */ new Set([...regionAmount.keys(), ...unpaidByRegion.keys()]);
    return {
      totalYear,
      totalMonth,
      paidCount,
      unpaidCount,
      timeline: Array.from(timeline.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([period, amount]) => ({ period, amount })),
      methodDistribution: Array.from(methods.entries()).map(([method, amount]) => ({ method, amount })),
      byRegion: Array.from(regionIds).map((id) => ({
        region: regionName.get(id) || id,
        amount: regionAmount.get(id) || 0,
        unpaid: unpaidByRegion.get(id) || 0
      }))
    };
  }
  async getPublicStats() {
    const memRes = await query("SELECT COUNT(*) AS total FROM members WHERE registration_status = 'approved'");
    return { totalMembers: parseInt(memRes.rows[0]?.total || "0", 10) };
  }
};
var statsService = new StatsService();

// src/services/emailService.ts
var import_nodemailer = __toESM(require("nodemailer"), 1);

// src/translations.ts
var translations = {
  en: {
    "otp.subject": "Your OPHEA Verification Code",
    "otp.emailBody": "Your verification code is: {{code}}. It will expire in {{minutes}} minutes. Do not share this code with anyone.",
    "otp.sms": "OPHEA: Your verification code is {{code}}. Valid for {{minutes}} min.",
    "registration.receivedSubject": "OPHEA Membership Registration Received",
    "registration.receivedBody": "Dear {{fullName}}, your registration for OPHEA membership has been received. Your registration number is {{memberNo}}. Our administration team will review your application and documents shortly.",
    "registration.receivedSms": "OPHEA: Hello {{fullName}}, your registration #{{memberNo}} has been received and is under review.",
    "registration.approvedSubject": "Congratulations! Your OPHEA Membership Application is Approved",
    "registration.approvedBody": "Dear {{fullName}}, your membership application has been approved! Your member number is {{memberNo}}. Please proceed with your contribution to activate your full membership.",
    "registration.approvedSms": "OPHEA: Congratulations {{fullName}}! Your membership application (#{{memberNo}}) is approved.",
    "registration.rejectedSubject": "Update regarding your OPHEA Membership Application",
    "registration.rejectedBody": "Dear {{fullName}}, thank you for your application to OPHEA. Unfortunately, we could not approve your application at this time. Reason: {{reason}}.",
    "registration.rejectedSms": "OPHEA: Update on membership application #{{memberNo}}: Unfortunately it could not be approved. Reason: {{reason}}.",
    "payment.receiptSubject": "OPHEA Contribution Payment Receipt - {{receiptNo}}",
    "payment.receiptBody": "Dear {{fullName}}, thank you for your contribution payment of {{amount}} ETB ({{period}}). Receipt number: {{receiptNo}}.",
    "payment.receiptSms": "OPHEA: Received {{amount}} ETB contribution from {{fullName}}. Receipt #{{receiptNo}}. Thank you for supporting OPHEA!",
    "payment.reminderSubject": "OPHEA Contribution Reminder",
    "payment.reminderBody": "Dear {{fullName}}, this is a friendly reminder that your {{period}} contribution for OPHEA is due. Thank you for your continued support.",
    "payment.reminderSms": "OPHEA: Reminder to {{fullName}}: Your {{period}} contribution is due. Thank you.",
    "error.unauthorized": "Unauthorized: Access token is missing or invalid.",
    "error.forbidden": "Forbidden: You do not have permission to perform this action.",
    "error.notFound": "Resource not found.",
    "error.duplicateMember": "A member with this phone number, email address, or ID number already exists.",
    "error.validationFailed": "Validation failed. Please verify your submitted fields.",
    "error.rateLimited": "Too many requests. Please try again later."
  },
  om: {
    "otp.subject": "Koodii Eenyummeessaa OPHEA Keessan",
    "otp.emailBody": "Koodiin mirkaneessaa keessan: {{code}}. Daqiiqaa {{minutes}} keessatti darba. Eenyumayyuuf hin qoodinaa.",
    "otp.sms": "OPHEA: Koodiin keessan {{code}}. Daqiiqaa {{minutes}}f qofa hojjeta.",
    "registration.receivedSubject": "Galmeen Miseensummaa OPHEA Qaqqabeera",
    "registration.receivedBody": "Kabajamoo {{fullName}}, iyyanni miseensummaa OPHEA keessan dhiyaateera. Lakkoofsi galmee keessan {{memberNo}} dha. Gareen keenya ragaalee keessan qoratee deebii isiniif kenna.",
    "registration.receivedSms": "OPHEA: Nagaa {{fullName}}, galmeen keessan lakk. #{{memberNo}} qaqqabee qoratamaa jira.",
    "registration.approvedSubject": "Baga Gammadxan! Iyyanni Miseensummaa OPHEA Keessan Ragga'eera",
    "registration.approvedBody": "Kabajamoo {{fullName}}, iyyanni miseensummaa keessan ragga'eera! Lakkoofsi miseensaa: {{memberNo}}.",
    "registration.approvedSms": "OPHEA: Baga gammadde {{fullName}}! Iyyanni miseensummaa kee (#{{memberNo}}) ragga'eera.",
    "registration.rejectedSubject": "Waa'ee Iyyata Miseensummaa OPHEA Keessan",
    "registration.rejectedBody": "Kabajamoo {{fullName}}, iyyanni keessan yeroo ammaa hin fudhatamne. Sababa: {{reason}}.",
    "registration.rejectedSms": "OPHEA: Iyyanni miseensaa #{{memberNo}} hin raggaane. Sababa: {{reason}}.",
    "payment.receiptSubject": "Nagahee Kaffaltii Gumaacha OPHEA - {{receiptNo}}",
    "payment.receiptBody": "Kabajamoo {{fullName}}, kaffaltii gumaacha keessan Qarshii {{amount}} ETB galateeffanna. Lakkoofsi nagahee: {{receiptNo}}.",
    "payment.receiptSms": "OPHEA: Gumaachi Qar. {{amount}} {{fullName}} irraa qaqqabeera. Nagahee #{{receiptNo}}. Galatoomaa!",
    "payment.reminderSubject": "Yaadachiisa Kaffaltii Gumaacha OPHEA",
    "payment.reminderBody": "Kabajamoo {{fullName}}, kaffaltiin gumaacha keessan yeroon isaa ga'eera. Deeggarsa keessaniif galatoomaa.",
    "payment.reminderSms": "OPHEA: Yaadachiisa {{fullName}}: Yeroon kaffaltii gumaacha keessanii ga'eera. Galatoomaa.",
    "error.unauthorized": "Hayyama hin qabdan: Hayyamni keessan sirrii miti.",
    "error.forbidden": "Dhorkameera: Gocha kana raawwachuuf mirga hin qabdan.",
    "error.notFound": "Qabeenyi hin argamne.",
    "error.duplicateMember": "Miseensi lakkoofsa bilbilaa, imeelii ykn waraqaa eenyummaa kanaan duraan galmaa'eera.",
    "error.validationFailed": "Ragaa guuttan mirkaneeffadhaa.",
    "error.rateLimited": "Iyyata baay'ee ergitaniittu. Booda irra deebi'aa yaalaa."
  },
  am: {
    "otp.subject": "\u12E8\u12A6\u122E\u121A\u12EB \u1206\u1235\u1352\u1273\u120A\u1272 \u121B\u1205\u1260\u122D \u12E8\u121B\u1228\u130B\u1308\u132B \u12AE\u12F5",
    "otp.emailBody": "\u12E8\u121B\u1228\u130B\u1308\u132B \u12AE\u12F5\u12CE\u1361 {{code}} \u1290\u12CD\u1362 \u12ED\u1205 \u12AE\u12F5 \u1260{{minutes}} \u12F0\u1242\u1243\u12CE\u127D \u12CD\u1235\u1325 \u12EB\u1260\u1243\u120D\u1362",
    "otp.sms": "OPHEA: \u12E8\u121B\u1228\u130B\u1308\u132B \u12AE\u12F5\u12CE {{code}} \u1290\u12CD\u1362 \u1208{{minutes}} \u12F0\u1242\u1243 \u12EB\u1308\u1208\u130D\u120B\u120D\u1362",
    "registration.receivedSubject": "\u12E8\u12A0\u1263\u120D\u1290\u1275 \u121B\u1218\u120D\u12A8\u127B\u12CE \u12F0\u122D\u1236\u1293\u120D",
    "registration.receivedBody": "\u12CD\u12F5 {{fullName}}\u1363 \u12E8OPHEA \u12A0\u1263\u120D\u1290\u1275 \u121B\u1218\u120D\u12A8\u127B\u12CE \u12F0\u122D\u1236\u1293\u120D\u1362 \u12E8\u1218\u1218\u12DD\u1308\u1262\u12EB \u1241\u1325\u122D\u12CE {{memberNo}} \u1290\u12CD\u1362",
    "registration.receivedSms": "OPHEA: \u1230\u120B\u121D {{fullName}}\u1363 \u121B\u1218\u120D\u12A8\u127B\u12CE #{{memberNo}} \u12F0\u122D\u1236\u1295 \u1260\u130D\u121D\u1308\u121B \u120B\u12ED \u1290\u12CD\u1362",
    "registration.approvedSubject": "\u12A5\u1295\u12B3\u1295 \u12F0\u1235 \u12A0\u120E\u1275! \u12E8\u12A0\u1263\u120D\u1290\u1275 \u121B\u1218\u120D\u12A8\u127B\u12CE \u1338\u12F5\u124B\u120D",
    "registration.approvedBody": "\u12CD\u12F5 {{fullName}}\u1363 \u12E8\u12A0\u1263\u120D\u1290\u1275 \u121B\u1218\u120D\u12A8\u127B\u12CE \u1338\u12F5\u124B\u120D! \u12E8\u12A0\u1263\u120D\u1290\u1275 \u1218\u1208\u12EB \u1241\u1325\u122D\u12CE\u1361 {{memberNo}}\u1362",
    "registration.approvedSms": "OPHEA: \u12A5\u1295\u12B3\u1295 \u12F0\u1235 \u12A0\u120E\u1275 {{fullName}}! \u12E8\u12A0\u1263\u120D\u1290\u1275 \u121B\u1218\u120D\u12A8\u127B\u12CE (#{{memberNo}}) \u1338\u12F5\u124B\u120D\u1362",
    "registration.rejectedSubject": "\u1235\u1208 \u12A0\u1263\u120D\u1290\u1275 \u121B\u1218\u120D\u12A8\u127B\u12CE",
    "registration.rejectedBody": "\u12CD\u12F5 {{fullName}}\u1363 \u121B\u1218\u120D\u12A8\u127B\u12CE \u1260\u12A0\u1201\u1291 \u12C8\u1245\u1275 \u12A0\u120D\u1270\u1240\u1260\u1208\u121D\u1362 \u121D\u12AD\u1295\u12EB\u1275\u1361 {{reason}}\u1362",
    "registration.rejectedSms": "OPHEA: \u121B\u1218\u120D\u12A8\u127B #{{memberNo}} \u12A0\u120D\u1338\u12F0\u1240\u121D\u1362 \u121D\u12AD\u1295\u12EB\u1275\u1361 {{reason}}\u1362",
    "payment.receiptSubject": "\u12E8OPHEA \u12AD\u134D\u12EB \u12F0\u1228\u1230\u129D - {{receiptNo}}",
    "payment.receiptBody": "\u12CD\u12F5 {{fullName}}\u1363 \u12E8{{amount}} \u1265\u122D \u1218\u12CB\u132E \u12AD\u134D\u12EB\u12CE \u12F0\u122D\u1236\u1293\u120D\u1362 \u12F0\u1228\u1230\u129D \u1241\u1325\u122D\u1361 {{receiptNo}}\u1362",
    "payment.receiptSms": "OPHEA: \u12E8{{amount}} \u1265\u122D \u1218\u12CB\u132E \u12A8{{fullName}} \u12F0\u122D\u1236\u1293\u120D\u1362 \u12F0\u1228\u1230\u129D #{{receiptNo}}\u1362 \u12A5\u1293\u1218\u1230\u130D\u1293\u1208\u1295!",
    "payment.reminderSubject": "\u12E8\u1218\u12CB\u132E \u12AD\u134D\u12EB \u121B\u1235\u1273\u12C8\u123B",
    "payment.reminderBody": "\u12CD\u12F5 {{fullName}}\u1363 \u12E8OPHEA \u1218\u12CB\u132E \u12AD\u134D\u12EB \u130A\u12DC \u1218\u12F5\u1228\u1231\u1295 \u12A5\u1293\u1235\u1273\u12CD\u1233\u1208\u1295\u1362",
    "payment.reminderSms": "OPHEA: \u121B\u1235\u1273\u12C8\u123B \u1208{{fullName}}\u1361 \u12E8\u1218\u12CB\u132E \u12AD\u134D\u12EB\u12CE \u12F0\u122D\u1237\u120D\u1362 \u12A5\u1293\u1218\u1230\u130D\u1293\u1208\u1295\u1362",
    "error.unauthorized": "\u1348\u1243\u12F5 \u12A0\u120D\u1270\u1230\u1320\u12CE\u1275\u121D\u1361 \u121B\u1235\u1228\u1303\u12CE \u1275\u12AD\u12AD\u120D \u12A0\u12ED\u12F0\u1208\u121D\u1362",
    "error.forbidden": "\u12E8\u1270\u12A8\u1208\u12A8\u1208\u1361 \u12ED\u1205\u1295\u1295 \u1270\u130D\u1263\u122D \u1208\u121B\u12A8\u1293\u12C8\u1295 \u1348\u1243\u12F5 \u12E8\u1208\u12CE\u1275\u121D\u1362",
    "error.notFound": "\u1218\u1228\u1303\u12CD \u12A0\u120D\u1270\u1308\u1298\u121D\u1362",
    "error.duplicateMember": "\u1260\u12DA\u1205 \u1235\u120D\u12AD\u1363 \u12A2\u121C\u12ED\u120D \u12C8\u12ED\u121D \u1218\u1273\u12C8\u1242\u12EB \u12E8\u1270\u1218\u12D8\u1308\u1260 \u12A0\u1263\u120D \u12A0\u1208\u1362",
    "error.validationFailed": "\u12E8\u1270\u121E\u120B\u12CD \u1218\u1228\u1303 \u12A0\u120D\u1270\u121F\u120B\u121D\u1362",
    "error.rateLimited": "\u1270\u12F0\u130B\u130B\u121A \u1219\u12A8\u122B\u1362 \u12A5\u1263\u12AD\u12CE \u1275\u1295\u123D \u1246\u12ED\u1270\u12CD \u12A5\u1295\u12F0\u1308\u1293 \u12ED\u121E\u12AD\u1229\u1362"
  },
  ar: {
    "otp.subject": "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u062E\u0627\u0635 \u0628\u0643 \u0641\u064A \u062C\u0645\u0639\u064A\u0629 OPHEA",
    "otp.emailBody": "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u062E\u0627\u0635 \u0628\u0643 \u0647\u0648: {{code}}. \u0635\u0627\u0644\u062D \u0644\u0645\u062F\u0629 {{minutes}} \u062F\u0642\u064A\u0642\u0629.",
    "otp.sms": "OPHEA: \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0647\u0648 {{code}}\u060C \u0635\u0627\u0644\u062D \u0644\u0645\u062F\u0629 {{minutes}} \u062F\u0642\u064A\u0642\u0629.",
    "registration.receivedSubject": "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 \u0641\u064A OPHEA",
    "registration.receivedBody": "\u0639\u0632\u064A\u0632\u064A {{fullName}}\u060C \u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628 \u0639\u0636\u0648\u064A\u062A\u0643 \u0628\u0646\u062C\u0627\u062D. \u0631\u0642\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644: {{memberNo}}.",
    "registration.receivedSms": "OPHEA: \u0645\u0631\u062D\u0628\u0627\u064B {{fullName}}\u060C \u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u0643 #{{memberNo}} \u0648\u0647\u0648 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629.",
    "registration.approvedSubject": "\u062A\u0647\u0627\u0646\u064A\u0646\u0627! \u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0637\u0644\u0628 \u0639\u0636\u0648\u064A\u062A\u0643",
    "registration.approvedBody": "\u0639\u0632\u064A\u0632\u064A {{fullName}}\u060C \u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0637\u0644\u0628 \u0639\u0636\u0648\u064A\u062A\u0643! \u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 \u0627\u0644\u062E\u0627\u0635 \u0628\u0643: {{memberNo}}.",
    "registration.approvedSms": "OPHEA: \u0645\u0628\u0631\u0648\u0643 {{fullName}}! \u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0639\u0636\u0648\u064A\u062A\u0643 \u0631\u0642\u0645 {{memberNo}}.",
    "registration.rejectedSubject": "\u0628\u0634\u0623\u0646 \u0637\u0644\u0628 \u0639\u0636\u0648\u064A\u062A\u0643 \u0641\u064A OPHEA",
    "registration.rejectedBody": "\u0639\u0632\u064A\u0632\u064A {{fullName}}\u060C \u0646\u0623\u0633\u0641 \u0644\u0639\u062F\u0645 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0637\u0644\u0628\u0643 \u0641\u064A \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u062D\u0627\u0644\u064A. \u0627\u0644\u0633\u0628\u0628: {{reason}}.",
    "registration.rejectedSms": "OPHEA: \u0644\u0645 \u062A\u062A\u0645 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628 #{{memberNo}}. \u0627\u0644\u0633\u0628\u0628: {{reason}}.",
    "payment.receiptSubject": "\u0625\u064A\u0635\u0627\u0644 \u062F\u0641\u0639 \u0645\u0633\u0627\u0647\u0645\u0629 OPHEA - {{receiptNo}}",
    "payment.receiptBody": "\u0639\u0632\u064A\u0632\u064A {{fullName}}\u060C \u0634\u0643\u0631\u0627\u064B \u0644\u062F\u0641\u0639\u0643 \u0645\u0633\u0627\u0647\u0645\u0629 \u0628\u0642\u064A\u0645\u0629 {{amount}} \u0628\u0631 \u0625\u062B\u064A\u0648\u0628\u064A. \u0631\u0642\u0645 \u0627\u0644\u0625\u064A\u0635\u0627\u0644: {{receiptNo}}.",
    "payment.receiptSms": "OPHEA: \u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 {{amount}} \u0628\u0631 \u0645\u0646 {{fullName}}. \u0631\u0642\u0645 \u0627\u0644\u0625\u064A\u0635\u0627\u0644 #{{receiptNo}}.",
    "payment.reminderSubject": "\u062A\u0630\u0643\u064A\u0631 \u0628\u0645\u0633\u0627\u0647\u0645\u0629 OPHEA",
    "payment.reminderBody": "\u0639\u0632\u064A\u0632\u064A {{fullName}}\u060C \u0646\u0648\u062F \u062A\u0630\u0643\u064A\u0631\u0643 \u0628\u0645\u0648\u0639\u062F \u062F\u0641\u0639 \u0645\u0633\u0627\u0647\u0645\u062A\u0643 \u0627\u0644\u062F\u0648\u0631\u064A\u0629 \u0641\u064A \u0627\u0644\u062C\u0645\u0639\u064A\u0629.",
    "payment.reminderSms": "OPHEA: \u062A\u0630\u0643\u064A\u0631 \u0644\u0644\u0639\u0636\u0648 {{fullName}}: \u062D\u0627\u0646 \u0645\u0648\u0639\u062F \u0627\u0644\u0645\u0633\u0627\u0647\u0645\u0629 \u0627\u0644\u062F\u0648\u0631\u064A\u0629. \u0634\u0643\u0631\u0627\u064B \u0644\u0643\u0645.",
    "error.unauthorized": "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D: \u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.",
    "error.forbidden": "\u0645\u0645\u0646\u0648\u0639: \u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621.",
    "error.notFound": "\u0627\u0644\u0645\u0648\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.",
    "error.duplicateMember": "\u064A\u0648\u062C\u062F \u0639\u0636\u0648 \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0628\u0631\u064A\u062F \u0623\u0648 \u0627\u0644\u0647\u0648\u064A\u0629.",
    "error.validationFailed": "\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0635\u062D\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.",
    "error.rateLimited": "\u0637\u0644\u0628\u0627\u062A \u0643\u062B\u064A\u0631\u0629 \u062C\u062F\u0627\u064B. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u0627\u064B."
  },
  fr: {
    "otp.subject": "Votre code de v\xE9rification OPHEA",
    "otp.emailBody": "Votre code de v\xE9rification est : {{code}}. Il expirera dans {{minutes}} minutes.",
    "otp.sms": "OPHEA: Votre code est {{code}}. Valable {{minutes}} min.",
    "registration.receivedSubject": "Inscription OPHEA bien re\xE7ue",
    "registration.receivedBody": "Cher(e) {{fullName}}, votre inscription \xE0 l'OPHEA a \xE9t\xE9 re\xE7ue. Num\xE9ro d'enregistrement : {{memberNo}}.",
    "registration.receivedSms": "OPHEA: Bonjour {{fullName}}, inscription #{{memberNo}} re\xE7ue et en cours d'examen.",
    "registration.approvedSubject": "F\xE9licitations ! Votre demande d'adh\xE9sion est approuv\xE9e",
    "registration.approvedBody": "Cher(e) {{fullName}}, votre adh\xE9sion a \xE9t\xE9 approuv\xE9e ! Votre num\xE9ro de membre est {{memberNo}}.",
    "registration.approvedSms": "OPHEA: F\xE9licitations {{fullName}} ! Votre adh\xE9sion (#{{memberNo}}) est approuv\xE9e.",
    "registration.rejectedSubject": "Mise \xE0 jour concernant votre adh\xE9sion OPHEA",
    "registration.rejectedBody": "Cher(e) {{fullName}}, nous ne pouvons pas approuver votre demande pour le moment. Motif : {{reason}}.",
    "registration.rejectedSms": "OPHEA: Demande #{{memberNo}} non approuv\xE9e. Motif : {{reason}}.",
    "payment.receiptSubject": "Re\xE7u de cotisation OPHEA - {{receiptNo}}",
    "payment.receiptBody": "Cher(e) {{fullName}}, nous confirmons la r\xE9ception de votre cotisation de {{amount}} ETB. Re\xE7u N\xB0 : {{receiptNo}}.",
    "payment.receiptSms": "OPHEA: Re\xE7u {{amount}} ETB de {{fullName}}. Re\xE7u #{{receiptNo}}. Merci pour votre soutien !",
    "payment.reminderSubject": "Rappel de cotisation OPHEA",
    "payment.reminderBody": "Cher(e) {{fullName}}, rappel amical que votre cotisation OPHEA est due. Merci.",
    "payment.reminderSms": "OPHEA: Rappel pour {{fullName}} : votre cotisation est due. Merci.",
    "error.unauthorized": "Non autoris\xE9 : jeton invalide ou manquant.",
    "error.forbidden": "Interdit : permissions insuffisantes.",
    "error.notFound": "Ressource introuvable.",
    "error.duplicateMember": "Un membre existe d\xE9j\xE0 avec ce num\xE9ro, email ou identifiant.",
    "error.validationFailed": "\xC9chec de validation des donn\xE9es.",
    "error.rateLimited": "Trop de requ\xEAtes. Veuillez r\xE9essayer plus tard."
  }
};
function t(key, lang = "en", params) {
  const dict = translations[lang] || translations.en;
  let text2 = dict[key] || translations.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text2 = text2.replace(new RegExp(`{{${k}}}`, "g"), String(v));
    }
  }
  return text2;
}

// src/services/emailService.ts
var EmailService = class {
  transporter = null;
  from;
  enabled;
  constructor() {
    this.from = process.env.SMTP_FROM || "OPHEA <no-reply@ophea.org>";
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 587;
    this.enabled = Boolean(host && user);
    if (this.enabled && host) {
      this.transporter = import_nodemailer.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        }
      });
    }
  }
  async sendMail(to, subject, text2, html) {
    if (!this.enabled || !this.transporter) {
      console.log(`[EmailService Simulated] To: ${to} | Subject: ${subject}`);
      return true;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: text2,
        html: html || `<p>${text2.replace(/\n/g, "<br/>")}</p>`
      });
      return true;
    } catch (err) {
      console.error("[EmailService] Failed to send email:", err?.message || err);
      return false;
    }
  }
  async sendOtpEmail(to, code, minutes, lang = "en") {
    const subject = t("otp.subject", lang);
    const body = t("otp.emailBody", lang, { code, minutes });
    return this.sendMail(to, subject, body);
  }
  async sendRegistrationReceived(to, fullName, memberNo, lang = "en") {
    const subject = t("registration.receivedSubject", lang);
    const body = t("registration.receivedBody", lang, { fullName, memberNo });
    return this.sendMail(to, subject, body);
  }
  async sendApprovalEmail(to, fullName, memberNo, lang = "en") {
    const subject = t("registration.approvedSubject", lang);
    const body = t("registration.approvedBody", lang, { fullName, memberNo });
    return this.sendMail(to, subject, body);
  }
  async sendRejectionEmail(to, fullName, reason, lang = "en") {
    const subject = t("registration.rejectedSubject", lang);
    const body = t("registration.rejectedBody", lang, { fullName, reason });
    return this.sendMail(to, subject, body);
  }
  async sendReceiptEmail(to, fullName, receiptNo, amount, period, lang = "en") {
    const subject = t("payment.receiptSubject", lang, { receiptNo });
    const body = t("payment.receiptBody", lang, { fullName, receiptNo, amount, period });
    return this.sendMail(to, subject, body);
  }
};
var emailService = new EmailService();

// src/services/afroSmsService.ts
var import_afromessage = __toESM(require("afromessage"), 1);
var AfroSmsService = class {
  client = null;
  token;
  identifierId;
  senderName;
  enabled;
  constructor() {
    this.token = process.env.AFROMESSAGE_TOKEN || "";
    this.identifierId = process.env.AFROMESSAGE_IDENTIFIER_ID || "";
    this.senderName = process.env.AFROMESSAGE_SENDER_NAME || "OPHEA";
    this.enabled = process.env.FEATURE_SMS === "true" && Boolean(this.token);
    if (this.token) {
      try {
        this.client = import_afromessage.default.getInstance({
          apiKey: this.token,
          senderName: this.senderName,
          identifierId: this.identifierId
        });
      } catch (err) {
        console.warn("[AfroSmsService] Could not initialize AfroMessage client:", err.message);
      }
    }
  }
  isEnabled() {
    return this.enabled && this.client !== null;
  }
  async sendSms(to, message) {
    if (!this.enabled || !this.client) {
      console.log(`[AfroSmsService Simulated] To: ${to} | Message: ${message}`);
      return { success: true, messageId: `sim-${Date.now()}` };
    }
    try {
      const response = await this.client.sendSms({
        to,
        message,
        from: this.senderName
      });
      return {
        success: true,
        messageId: response?.response?.id || response?.id || "delivered"
      };
    } catch (err) {
      console.error("[AfroSmsService] Error sending SMS:", err?.message || err);
      return {
        success: false,
        error: err?.message || "Failed to dispatch SMS via AfroMessage"
      };
    }
  }
  async getBalance() {
    return {
      balance: this.enabled ? "Active Account" : 1e3,
      currency: "ETB"
    };
  }
};
var afroSmsService = new AfroSmsService();

// src/services/exportService.ts
var import_exceljs = __toESM(require("exceljs"), 1);
var import_pdfkit = __toESM(require("pdfkit"), 1);
var ExportService = class {
  async exportMembersToExcel(members) {
    const workbook = new import_exceljs.default.Workbook();
    workbook.creator = "OPHEA System";
    workbook.created = /* @__PURE__ */ new Date();
    const sheet = workbook.addWorksheet("OPHEA Members");
    sheet.columns = [
      { header: "Member No", key: "memberNo", width: 18 },
      { header: "Full Name", key: "fullName", width: 28 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Email", key: "email", width: 28 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Occupation", key: "occupationType", width: 15 },
      { header: "Town / City", key: "town", width: 18 },
      { header: "Reg Status", key: "registrationStatus", width: 15 },
      { header: "Membership", key: "membershipStatus", width: 15 },
      { header: "Registered On", key: "createdAt", width: 20 }
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF166534" }
      // Forest green
    };
    for (const m of members) {
      sheet.addRow({
        memberNo: m.memberNo,
        fullName: m.fullName,
        phone: m.phone,
        email: m.email,
        gender: m.gender,
        occupationType: m.occupationType,
        town: m.town || "N/A",
        registrationStatus: m.registrationStatus,
        membershipStatus: m.membershipStatus,
        createdAt: new Date(m.createdAt).toLocaleDateString()
      });
    }
    return await workbook.xlsx.writeBuffer();
  }
  async exportPaymentsToExcel(payments) {
    const workbook = new import_exceljs.default.Workbook();
    workbook.creator = "OPHEA Finance";
    workbook.created = /* @__PURE__ */ new Date();
    const sheet = workbook.addWorksheet("Contributions");
    sheet.columns = [
      { header: "Receipt No", key: "receiptNo", width: 18 },
      { header: "Member No", key: "memberNo", width: 18 },
      { header: "Member Name", key: "memberName", width: 26 },
      { header: "Amount (ETB)", key: "amountEtb", width: 15 },
      { header: "Period", key: "period", width: 12 },
      { header: "Start Date", key: "periodStart", width: 14 },
      { header: "End Date", key: "periodEnd", width: 14 },
      { header: "Method", key: "method", width: 15 },
      { header: "Bank", key: "bank", width: 16 },
      { header: "Reference", key: "reference", width: 18 },
      { header: "Status", key: "status", width: 12 },
      { header: "Paid At", key: "paidAt", width: 18 }
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }
      // Deep Blue
    };
    for (const p of payments) {
      sheet.addRow({
        receiptNo: p.receiptNo,
        memberNo: p.memberNo || "N/A",
        memberName: p.memberName || "N/A",
        amountEtb: Number(p.amountEtb),
        period: p.period,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        method: p.method,
        bank: p.bank || "N/A",
        reference: p.reference || "N/A",
        status: p.status,
        paidAt: new Date(p.paidAt).toLocaleDateString()
      });
    }
    return await workbook.xlsx.writeBuffer();
  }
  async exportMembersToPdf(members) {
    return new Promise((resolve, reject) => {
      const doc = new import_pdfkit.default({ margin: 40, size: "A4" });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
      doc.fontSize(16).text("Oromia Hospitality & Tourism Professionals Association (OPHEA)", { align: "center" });
      doc.fontSize(12).text("Official Member Register", { align: "center" });
      doc.moveDown();
      doc.fontSize(9).text(`Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`, { align: "right" });
      doc.fontSize(9).text(`Total Members: ${members.length}`, { align: "left" });
      doc.moveDown();
      doc.fontSize(10).fillColor("#166534").text("Member No | Full Name | Phone | Occupation | Status");
      doc.fillColor("#000000");
      doc.text("--------------------------------------------------------------------------------------------------");
      doc.moveDown(0.5);
      for (const m of members.slice(0, 100)) {
        doc.fontSize(9).text(
          `${m.memberNo.padEnd(16)} | ${(m.fullName || "").slice(0, 24).padEnd(24)} | ${m.phone.padEnd(15)} | ${(m.occupationType || "").padEnd(12)} | ${m.membershipStatus}`
        );
      }
      if (members.length > 100) {
        doc.moveDown();
        doc.fontSize(9).fillColor("#666666").text(`... and ${members.length - 100} more members.`);
      }
      doc.end();
    });
  }
  async generateReceiptPdf(payment) {
    return new Promise((resolve, reject) => {
      const doc = new import_pdfkit.default({ margin: 50, size: "A5", layout: "landscape" });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
      doc.rect(20, 20, 555, 380).lineWidth(2).strokeColor("#166534").stroke();
      doc.fontSize(14).fillColor("#166534").text("OROMIA HOSPITALITY & TOURISM PROFESSIONALS ASSOCIATION", 40, 40, { align: "center" });
      doc.fontSize(10).fillColor("#444444").text("Waldaa Ogeeyyii Keessummeessuu fi Tuuriizimii Oromiyaa (OPHEA)", { align: "center" });
      doc.fontSize(12).fillColor("#000000").text("OFFICIAL CONTRIBUTION RECEIPT", { align: "center", underline: true });
      doc.moveDown();
      doc.fontSize(10);
      const topY = 120;
      doc.text(`Receipt No: ${payment.receiptNo}`, 50, topY);
      doc.text(`Date Paid: ${new Date(payment.paidAt).toLocaleDateString()}`, 350, topY);
      doc.text(`Member No: ${payment.memberNo || "N/A"}`, 50, topY + 25);
      doc.text(`Period Covered: ${payment.period.toUpperCase()} (${payment.periodStart} to ${payment.periodEnd})`, 350, topY + 25);
      doc.text(`Member Name: ${payment.memberName || "N/A"}`, 50, topY + 50);
      doc.text(`Payment Method: ${payment.method} ${payment.bank ? `(${payment.bank})` : ""}`, 350, topY + 50);
      doc.text(`Phone: ${payment.memberPhone || "N/A"}`, 50, topY + 75);
      doc.text(`Reference No: ${payment.reference || "N/A"}`, 350, topY + 75);
      doc.rect(50, 230, 495, 45).fillColor("#f0fdf4").fill().strokeColor("#166534").stroke();
      doc.fontSize(14).fillColor("#166534").text(`AMOUNT RECEIVED: ${Number(payment.amountEtb).toLocaleString()} ETB`, 60, 245, { align: "center" });
      doc.fontSize(9).fillColor("#444444");
      doc.text("Issued by OPHEA Finance Administration", 50, 310);
      doc.text("Authorized Signature & Seal: ___________________", 320, 310);
      doc.fontSize(8).text("This is an official computer-generated receipt from the OPHEA Management System.", 50, 350, { align: "center" });
      doc.end();
    });
  }
};
var exportService = new ExportService();

// src/services/smsCampaignService.ts
var SmsCampaignService = class {
  isProcessing = false;
  async createCampaign(input) {
    const members = await dbOperations.getMembersForCampaign(input.audienceFilter);
    const campaignId = await dbOperations.createSmsCampaign({
      name: input.name,
      message: input.message,
      audienceFilter: input.audienceFilter,
      scheduledAt: input.scheduledAt,
      createdBy: input.createdBy,
      totals: {
        targetCount: members.length,
        sentCount: 0,
        failedCount: 0
      }
    });
    if (!input.scheduledAt || new Date(input.scheduledAt) <= /* @__PURE__ */ new Date()) {
      setTimeout(() => this.processCampaign(campaignId), 100);
    }
    return { id: campaignId, targetCount: members.length };
  }
  async processCampaign(campaignId) {
    const campaign = await dbOperations.getSmsCampaignById(campaignId);
    if (!campaign || campaign.status === "sent" || campaign.status === "sending") {
      return;
    }
    await dbOperations.updateSmsCampaignStatus(campaignId, "sending");
    const members = await dbOperations.getMembersForCampaign(campaign.audienceFilter || {});
    let sent = 0;
    let failed = 0;
    for (const member of members) {
      if (!member.phone) continue;
      let personalizedMessage = campaign.message.replace(/{{fullName}}/g, member.fullName || "Member").replace(/{{memberNo}}/g, member.memberNo || "").replace(/{{amountDue}}/g, "100 ETB");
      const result = await afroSmsService.sendSms(member.phone, personalizedMessage);
      if (result.success) {
        sent += 1;
        await dbOperations.createSmsLog({
          campaignId,
          memberId: member.id,
          phone: member.phone,
          message: personalizedMessage,
          status: "sent",
          providerMessageId: result.messageId,
          sentAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else {
        failed += 1;
        await dbOperations.createSmsLog({
          campaignId,
          memberId: member.id,
          phone: member.phone,
          message: personalizedMessage,
          status: "failed",
          error: result.error,
          sentAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    await dbOperations.updateSmsCampaignStatus(campaignId, failed > 0 && sent === 0 ? "failed" : "sent", {
      targetCount: members.length,
      sentCount: sent,
      failedCount: failed
    });
  }
  startSmsScheduler() {
    setInterval(async () => {
      if (this.isProcessing) return;
      try {
        this.isProcessing = true;
        const dueCampaigns = await dbOperations.getDueScheduledSmsCampaigns();
        for (const c of dueCampaigns) {
          await this.processCampaign(c.id);
        }
      } catch (err) {
      } finally {
        this.isProcessing = false;
      }
    }, 60 * 1e3);
  }
};
var smsCampaignService = new SmsCampaignService();

// src/config/multer.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto3 = __toESM(require("crypto"), 1);
var import_multer = __toESM(require("multer"), 1);
var UPLOAD_PATH = process.env.UPLOAD_PATH || "./uploads";
var PRIVATE_UPLOAD_PATH = process.env.PRIVATE_UPLOAD_PATH || "./private_uploads";
for (const dir of [
  UPLOAD_PATH,
  import_path.default.join(UPLOAD_PATH, "images"),
  import_path.default.join(UPLOAD_PATH, "announcements"),
  import_path.default.join(UPLOAD_PATH, "partners"),
  import_path.default.join(UPLOAD_PATH, "activities"),
  PRIVATE_UPLOAD_PATH,
  import_path.default.join(PRIVATE_UPLOAD_PATH, "members")
]) {
  if (!import_fs.default.existsSync(dir)) {
    import_fs.default.mkdirSync(dir, { recursive: true });
  }
}
var ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];
var ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
var publicStorage = import_multer.default.diskStorage({
  destination: (req, file, cb) => {
    let sub = "images";
    if (req.baseUrl.includes("announcements")) sub = "announcements";
    else if (req.baseUrl.includes("partners")) sub = "partners";
    else if (req.baseUrl.includes("activities")) sub = "activities";
    const dest = import_path.default.join(UPLOAD_PATH, sub);
    if (!import_fs.default.existsSync(dest)) import_fs.default.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = import_path.default.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${import_crypto3.default.randomBytes(6).toString("hex")}${ext}`;
    cb(null, unique);
  }
});
var privateStorage = import_multer.default.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = import_path.default.join(PRIVATE_UPLOAD_PATH, "temp");
    if (!import_fs.default.existsSync(tempDir)) import_fs.default.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = import_path.default.extname(file.originalname).toLowerCase();
    const unique = `doc-${Date.now()}-${import_crypto3.default.randomBytes(8).toString("hex")}${ext}`;
    cb(null, unique);
  }
});
var fileFilter = (req, file, cb) => {
  const ext = import_path.default.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Invalid file type. Only JPEG, PNG, WEBP, and PDF documents are allowed."));
  }
  cb(null, true);
};
var uploadPublic = (0, import_multer.default)({
  storage: publicStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  // 5 MB
  fileFilter
});
var uploadPrivate = (0, import_multer.default)({
  storage: privateStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  // 5 MB
  fileFilter
});
var memberRegistrationUpload = uploadPrivate.fields([
  { name: "idDocument", maxCount: 1 },
  { name: "cvCompanyProfile", maxCount: 1 },
  { name: "academicCertificates", maxCount: 10 },
  { name: "credentials", maxCount: 5 },
  { name: "credentialDocs", maxCount: 10 }
]);

// src/backend/routes.ts
var apiRouter = createAsyncRouter();
function normalizeEthiopianPhone(phone) {
  let clean = phone.replace(/[^0-9+]/g, "");
  if (clean.startsWith("09")) clean = "+251" + clean.slice(1);
  else if (clean.startsWith("07")) clean = "+251" + clean.slice(1);
  else if (clean.startsWith("9") && clean.length === 9) clean = "+251" + clean;
  else if (clean.startsWith("7") && clean.length === 9) clean = "+251" + clean;
  else if (clean.startsWith("251")) clean = "+" + clean;
  return clean;
}
apiRouter.use(
  customRateLimiter({
    windowMs: 15 * 60 * 1e3,
    max: 300,
    message: "Global API rate limit exceeded. Please wait a few moments."
  })
);
async function loadAdminUserDto(id, lang) {
  const r = await query(
    "SELECT u.*, r.name AS region_name FROM admin_users u LEFT JOIN regions r ON u.region_id = r.id WHERE u.id = $1",
    [id]
  );
  return r.rows[0] ? toAdminUserDto(mapRow(r.rows[0]), lang) : null;
}
var loginSchema = import_zod2.z.object({
  usernameOrEmail: import_zod2.z.string().min(3),
  password: import_zod2.z.string().min(6)
});
var loginRateLimiter = customRateLimiter({
  windowMs: 15 * 60 * 1e3,
  max: 10,
  message: "Too many login attempts. Please try again after 15 minutes.",
  keyGenerator: (req) => `login:${req.ip || "127.0.0.1"}`
});
var handleLogin = async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const admin = await dbOperations.getAdminByUsernameOrEmail(usernameOrEmail);
  if (!admin) {
    await dbOperations.createAuditLog({
      action: "auth.login_failed",
      entity: "admin_users",
      before: { identifier: usernameOrEmail },
      ip: req.ip
    });
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  }
  if (!admin.isActive) {
    return res.status(403).json({ success: false, error: "Your administrator account has been deactivated." });
  }
  const isMatch = await import_bcryptjs3.default.compare(password, admin.passwordHash);
  if (!isMatch) {
    await dbOperations.createAuditLog({
      adminId: admin.id,
      action: "auth.login_failed_password",
      entity: "admin_users",
      entityId: admin.id,
      ip: req.ip
    });
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  }
  await dbOperations.updateAdminLastLogin(admin.id);
  const tokenPayload = {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    permissions: admin.permissions || [],
    regionId: admin.regionId
  };
  const expiresIn = process.env.JWT_EXPIRES_IN || "8h";
  const token = import_jsonwebtoken2.default.sign(tokenPayload, getJwtSecret(), { expiresIn });
  await dbOperations.createAuditLog({
    adminId: admin.id,
    action: "auth.login_success",
    entity: "admin_users",
    entityId: admin.id,
    ip: req.ip
  });
  return res.json({
    success: true,
    data: {
      token,
      user: await loadAdminUserDto(admin.id, getLang(req))
    }
  });
};
apiRouter.post("/auth/login", loginRateLimiter, validateBody(loginSchema), handleLogin);
apiRouter.post("/admin/login", loginRateLimiter, validateBody(loginSchema), handleLogin);
apiRouter.get("/auth/me", authenticateJWT, loadAdminContext, async (req, res) => {
  return res.json({ success: true, data: await loadAdminUserDto(req.admin.id, getLang(req)) });
});
var changePasswordSchema = import_zod2.z.object({
  currentPassword: import_zod2.z.string().min(6),
  newPassword: import_zod2.z.string().min(8, "New password must be at least 8 characters long")
});
apiRouter.post(
  "/auth/change-password",
  authenticateJWT,
  loadAdminContext,
  validateBody(changePasswordSchema),
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const admin = await dbOperations.getAdminById(req.admin.id);
    const isMatch = await import_bcryptjs3.default.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Current password does not match" });
    }
    const newHash = await import_bcryptjs3.default.hash(newPassword, 10);
    await dbOperations.changeAdminPassword(admin.id, newHash);
    await dbOperations.createAuditLog({
      adminId: admin.id,
      action: "auth.password_changed",
      entity: "admin_users",
      entityId: admin.id,
      ip: req.ip
    });
    return res.json({ success: true, message: "Password changed successfully" });
  }
);
apiRouter.post("/auth/logout", authenticateJWT, async (req, res) => {
  if (req.user) {
    await dbOperations.createAuditLog({
      adminId: req.user.id,
      action: "auth.logout",
      entity: "admin_users",
      entityId: req.user.id,
      ip: req.ip
    });
  }
  return res.json({ success: true, message: "Logged out successfully" });
});
var adminAuthChain = [authenticateJWT, loadAdminContext];
function memberFilters(req) {
  const q = req.query;
  const s = (v) => typeof v === "string" && v.trim() ? v.trim() : void 0;
  return {
    q: s(q.q),
    registrationStatus: s(q.registrationStatus),
    membershipStatus: s(q.membershipStatus),
    gender: s(q.gender),
    sectorId: s(q.sectorId),
    fieldId: s(q.fieldId),
    regionId: s(q.regionId),
    occupationType: s(q.occupationType),
    graduationLevelId: s(q.graduationLevelId),
    paid: q.paid === "true" ? true : q.paid === "false" ? false : void 0,
    createdFrom: s(q.createdFrom),
    createdTo: s(q.createdTo)
  };
}
function outsideRegion(req, member) {
  return req.admin?.role === "RegionalAdmin" && member.regionId !== req.admin.regionId;
}
async function memberDetail(id, lang) {
  const member = await dbOperations.getMemberById(id);
  if (!member) return null;
  const [docs, info] = await Promise.all([dbOperations.getMemberDocuments(id), loadPaymentInfo([id])]);
  return toMemberDetailDto(member, docs, lang, info[id]);
}
function validateMemberBody(b, creating) {
  const errors = {};
  if (creating) {
    for (const k of ["fullName", "phone", "email", "gender", "graduationLevelId", "occupationType", "sectorId", "fieldOfStudyId", "regionId", "idType", "idNumber"]) {
      if (!b[k]) errors[k] = "Required";
    }
  }
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) errors.email = "Invalid email address";
  if (b.gender && !["male", "female", "unspecified"].includes(b.gender)) errors.gender = "Must be male, female or unspecified";
  if (b.occupationType && !["private", "government", "other"].includes(b.occupationType)) errors.occupationType = "Invalid occupation type";
  if (b.idType && !["fayda", "passport", "kebele", "driver"].includes(b.idType)) errors.idType = "Invalid ID type";
  if (b.phone) {
    const p = normalizeEthiopianPhone(b.phone);
    if (!/^\+251[79]\d{8}$/.test(p)) errors.phone = "Enter a valid Ethiopian mobile number";
  }
  return errors;
}
apiRouter.get("/admin/members", adminAuthChain, requirePermission("members"), requireRegionScope, async (req, res) => {
  const lang = getLang(req);
  const result = await dbOperations.getMembers({
    ...memberFilters(req),
    page: parseInt(String(req.query.page || "1"), 10),
    pageSize: parseInt(String(req.query.pageSize || "20"), 10),
    sort: req.query.sort
  });
  const info = await loadPaymentInfo(result.items.map((m) => m.id));
  return res.json({
    success: true,
    data: result.items.map((m) => toMemberSummaryDto(m, lang, info[m.id])),
    meta: result.meta
  });
});
apiRouter.get("/admin/registrations/pending-count", adminAuthChain, requirePermission("members"), requireRegionScope, async (req, res) => {
  const regionId = req.query.regionId;
  const cond = regionId ? "WHERE registration_status = 'pending' AND region_id = $1" : "WHERE registration_status = 'pending'";
  const resCount = await query(`SELECT count(*) as count FROM members ${cond}`, regionId ? [regionId] : []);
  return res.json({ success: true, data: { pendingCount: parseInt(resCount.rows[0].count, 10) || 0 } });
});
apiRouter.get("/admin/members/export", adminAuthChain, requirePermission("members.export"), requireRegionScope, async (req, res) => {
  const format = req.query.format === "pdf" ? "pdf" : "xlsx";
  const data = await dbOperations.getMembers({ ...memberFilters(req), pageSize: 100, page: 1 });
  let items = data.items;
  for (let page = 2; page <= (data.meta?.totalPages || 1) && page <= 50; page++) {
    const more = await dbOperations.getMembers({ ...memberFilters(req), pageSize: 100, page });
    items = items.concat(more.items);
  }
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: `member.export_${format}`, entity: "members", ip: req.ip });
  if (format === "pdf") {
    const buffer2 = await exportService.exportMembersToPdf(items);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="ophea-members.pdf"');
    return res.send(buffer2);
  }
  const buffer = await exportService.exportMembersToExcel(items);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="ophea-members.xlsx"');
  return res.send(buffer);
});
apiRouter.post("/admin/members", adminAuthChain, requirePermission("members.edit"), requireRegionScope, async (req, res) => {
  const b = normalizeMemberBody(req.body || {});
  if (req.admin?.role === "RegionalAdmin") b.regionId = req.admin.regionId || b.regionId;
  const errors = validateMemberBody(b, true);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, error: "Please fix the highlighted fields", fields: errors });
  }
  const phone = normalizeEthiopianPhone(b.phone);
  const dup = await dbOperations.checkDuplicateMember(phone, b.email, b.idType, b.idNumber);
  if (dup) {
    return res.status(409).json({ success: false, error: "A member with this phone, email or ID number already exists", fields: { phone: "Possible duplicate" } });
  }
  const created = await dbOperations.createMember({
    memberNo: await dbOperations.getNextMemberNumber(),
    ...b,
    phone,
    idNumberHash: hashIdNumber(b.idType, b.idNumber),
    idNumberLast4: b.idNumber.slice(-4),
    registrationStatus: "pending",
    membershipStatus: "pending",
    source: "admin"
  });
  await dbOperations.approveMember(created.id, req.admin.fullName);
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: "member.create_admin", entity: "members", entityId: created.id, ip: req.ip });
  return res.status(201).json({ success: true, data: await memberDetail(created.id, getLang(req)) });
});
apiRouter.get("/admin/members/:id", adminAuthChain, requirePermission("members"), requireRegionScope, async (req, res) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: "Member not found" });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: "Forbidden: Member outside your regional jurisdiction." });
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});
apiRouter.get("/admin/members/:id/payments", adminAuthChain, requirePermission("payments"), requireRegionScope, async (req, res) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: "Member not found" });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: "Forbidden" });
  const rows = await query(
    `SELECT p.*, m.full_name AS member_name, m.member_no FROM payments p LEFT JOIN members m ON p.member_id = m.id
     WHERE p.member_id = $1 ORDER BY p.paid_at DESC`,
    [req.params.id]
  );
  return res.json({ success: true, data: rows.rows.map(mapRow).map((r) => toPaymentDto(r, getLang(req))) });
});
apiRouter.put("/admin/members/:id", adminAuthChain, requirePermission("members.edit"), requireRegionScope, async (req, res) => {
  const existing = await dbOperations.getMemberById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: "Member not found" });
  if (outsideRegion(req, existing)) return res.status(403).json({ success: false, error: "Forbidden" });
  const b = normalizeMemberBody(req.body || {});
  if (req.admin?.role === "RegionalAdmin") b.regionId = existing.regionId;
  const errors = validateMemberBody(b, false);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, error: "Please fix the highlighted fields", fields: errors });
  }
  const phone = b.phone ? normalizeEthiopianPhone(b.phone) : void 0;
  if (phone || b.email) {
    const clash = await query(
      "SELECT id FROM members WHERE id <> $1 AND (($2::text IS NOT NULL AND phone = $2) OR ($3::text IS NOT NULL AND LOWER(email) = $3))",
      [req.params.id, phone ?? null, b.email ? b.email.toLowerCase() : null]
    );
    if (clash.rows.length) {
      return res.status(409).json({ success: false, error: "Another member already uses this phone or email", fields: { phone: "Already in use" } });
    }
  }
  const cols = {
    full_name: b.fullName,
    phone,
    email: b.email ? b.email.toLowerCase() : void 0,
    gender: b.gender,
    date_of_birth: b.dateOfBirth,
    graduation_level_id: b.graduationLevelId,
    occupation_type: b.occupationType,
    sector_id: b.sectorId,
    field_of_study_id: b.fieldOfStudyId,
    professional_category: b.professionalCategory,
    organization_name: b.organizationName,
    job_title: b.jobTitle,
    region_id: b.regionId,
    town: b.town,
    id_type: b.idType,
    preferred_language: b.preferredLanguage,
    membership_category: b.membershipCategory,
    nationality: b.nationality,
    emergency_contact_name: b.emergencyContactName,
    emergency_contact_phone: b.emergencyContactPhone,
    business_tin: b.businessTin,
    employment_status: b.employmentStatus,
    year_established: b.yearEstablished,
    zone_sub_city: b.zoneSubCity,
    woreda: b.woreda,
    institution_name: b.institutionName,
    skills: b.skills,
    expertise_areas: b.expertiseAreas,
    interests: b.interests
  };
  if (b.idNumber && !b.idNumber.startsWith("\u2022\u2022")) {
    cols.id_number_hash = hashIdNumber(b.idType || existing.idType, b.idNumber);
    cols.id_number_last4 = b.idNumber.slice(-4);
  }
  const keys = Object.keys(cols).filter((k) => cols[k] !== void 0);
  if (keys.length) {
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    await query(`UPDATE members SET ${sets}, updated_at = NOW() WHERE id = $${keys.length + 1}`, [...keys.map((k) => cols[k]), req.params.id]);
  }
  await dbOperations.createAuditLog({
    adminId: req.admin?.id,
    action: "member.edit",
    entity: "members",
    entityId: req.params.id,
    after: Object.fromEntries(keys.filter((k) => !k.startsWith("id_number")).map((k) => [k, cols[k]])),
    ip: req.ip
  });
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});
apiRouter.patch("/admin/members/:id/status", adminAuthChain, requirePermission("members.edit"), requireRegionScope, async (req, res) => {
  const { membershipStatus } = req.body || {};
  if (!["active", "inactive", "pending"].includes(membershipStatus)) {
    return res.status(400).json({ success: false, error: "Invalid membership status", fields: { membershipStatus: "Must be active, inactive or pending" } });
  }
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: "Member not found" });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: "Forbidden" });
  await dbOperations.updateMemberStatus(req.params.id, membershipStatus);
  await dbOperations.createAuditLog({
    adminId: req.admin?.id,
    action: "member.status_change",
    entity: "members",
    entityId: req.params.id,
    before: { membershipStatus: member.membershipStatus },
    after: { membershipStatus },
    ip: req.ip
  });
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});
apiRouter.post("/admin/members/:id/approve", adminAuthChain, requirePermission("members.approve"), requireRegionScope, async (req, res) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: "Member not found" });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: "Forbidden" });
  const approved = await dbOperations.approveMember(req.params.id, req.admin.fullName);
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: "member.approve", entity: "members", entityId: req.params.id, ip: req.ip });
  emailService.sendApprovalEmail(approved.email, approved.fullName, approved.memberNo, approved.preferredLanguage);
  if (process.env.FEATURE_SMS === "true") {
    afroSmsService.sendSms(approved.phone, `OPHEA: Congratulations ${approved.fullName}! Your membership application (#${approved.memberNo}) is approved.`);
  }
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});
apiRouter.post("/admin/members/:id/reject", adminAuthChain, requirePermission("members.approve"), requireRegionScope, async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) return res.status(400).json({ success: false, error: "Rejection reason is required", fields: { reason: "Required" } });
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: "Member not found" });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: "Forbidden" });
  const rejected = await dbOperations.rejectMember(req.params.id, reason);
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: "member.reject", entity: "members", entityId: req.params.id, before: { reason }, ip: req.ip });
  emailService.sendRejectionEmail(rejected.email, rejected.fullName, reason, rejected.preferredLanguage);
  return res.json({ success: true, data: await memberDetail(req.params.id, getLang(req)) });
});
apiRouter.delete("/admin/members/:id", adminAuthChain, requireSuperAdmin, async (req, res) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: "Member not found" });
  await query(
    "UPDATE members SET membership_status = 'inactive', registration_status = 'rejected', rejection_reason = 'Deactivated by SuperAdmin', updated_at = NOW() WHERE id = $1",
    [req.params.id]
  );
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: "member.delete", entity: "members", entityId: req.params.id, ip: req.ip });
  return res.json({ success: true, data: { success: true } });
});
apiRouter.get("/admin/members/:id/documents/:docId", adminAuthChain, requirePermission("members"), requireRegionScope, async (req, res) => {
  const member = await dbOperations.getMemberById(req.params.id);
  if (!member) return res.status(404).json({ success: false, error: "Member not found" });
  if (outsideRegion(req, member)) return res.status(403).json({ success: false, error: "Forbidden" });
  const doc = await dbOperations.getMemberDocumentById(req.params.id, req.params.docId);
  if (!doc) return res.status(404).json({ success: false, error: "Document not found" });
  const filePath = import_path2.default.join(PRIVATE_UPLOAD_PATH, "members", req.params.id, doc.storedName);
  if (!import_fs2.default.existsSync(filePath)) return res.status(404).json({ success: false, error: "File missing from private storage" });
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: "document.view", entity: "member_documents", entityId: doc.id, ip: req.ip });
  res.setHeader("Content-Type", doc.mime);
  res.setHeader("Content-Disposition", `inline; filename="${String(doc.originalName).replace(/"/g, "")}"`);
  return import_fs2.default.createReadStream(import_path2.default.resolve(filePath)).pipe(res);
});
apiRouter.get(
  "/admin/dashboard/summary",
  adminAuthChain,
  requirePermission("dashboard"),
  requireRegionScope,
  async (req, res) => {
    const regionId = req.admin?.role === "RegionalAdmin" ? req.admin.regionId : req.query.regionId;
    const summary = await statsService.getAdminSummary(regionId);
    return res.json({ success: true, data: summary });
  }
);
apiRouter.get(
  "/admin/dashboard/members-by",
  adminAuthChain,
  requirePermission("dashboard"),
  requireRegionScope,
  async (req, res) => {
    const dimension = req.query.dimension || "sector";
    const lang = getLang(req);
    const regionId = req.admin?.role === "RegionalAdmin" ? req.admin.regionId : req.query.regionId;
    const breakdown = await statsService.getMembersByDimension(dimension, lang, regionId);
    return res.json({ success: true, data: breakdown });
  }
);
apiRouter.get(
  "/admin/dashboard/contributions",
  adminAuthChain,
  requirePermission("contributions.dashboard"),
  requireRegionScope,
  async (req, res) => {
    const range = req.query.range || "12m";
    const group = req.query.group || "month";
    const regionId = req.admin?.role === "RegionalAdmin" ? req.admin.regionId : req.query.regionId;
    const metrics = await statsService.getContributionsDashboard({ range, group, regionId });
    return res.json({ success: true, data: metrics });
  }
);
apiRouter.get(
  "/admin/dashboard/recent-activity",
  adminAuthChain,
  requirePermission("dashboard"),
  async (req, res) => {
    const logs = await query(
      `SELECT a.*, u.full_name as admin_name 
       FROM audit_logs a 
       LEFT JOIN admin_users u ON a.admin_id = u.id 
       ORDER BY a.created_at DESC LIMIT 15`
    );
    return res.json({ success: true, data: logs.rows.map(mapRow).map(toRecentActivityDto) });
  }
);
var pad2 = (n) => String(n).padStart(2, "0");
function periodBounds(period, dateStr) {
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  if (period === "yearly") return { start: `${y}-01-01`, end: `${y}-12-31` };
  if (period === "monthly") {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start: `${y}-${pad2(m)}-01`, end: `${y}-${pad2(m)}-${pad2(last)}` };
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  const mon = new Date(dt.getTime() - dow * 864e5);
  const sun = new Date(mon.getTime() + 6 * 864e5);
  const f = (x) => `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`;
  return { start: f(mon), end: f(sun) };
}
var isYmd = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
var todayYmd = () => {
  const n = /* @__PURE__ */ new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
};
async function findUnpaidMembers(period, dateStr, regionId) {
  const { start, end } = periodBounds(period, dateStr);
  const params = [start, end];
  let regionCond = "";
  if (regionId) {
    params.push(regionId);
    regionCond = "AND m.region_id = $3";
  }
  const res = await query(
    `SELECT m.*, r.name AS region_name, s.label AS sector_label, f.label AS field_label, g.label AS grad_label
     FROM members m
     LEFT JOIN regions r ON m.region_id = r.id
     LEFT JOIN lookup_sectors s ON m.sector_id = s.id
     LEFT JOIN lookup_fields_of_study f ON m.field_of_study_id = f.id
     LEFT JOIN lookup_graduation_levels g ON m.graduation_level_id = g.id
     WHERE m.registration_status = 'approved' AND m.membership_status = 'active'
     ${regionCond}
     AND NOT EXISTS (
       SELECT 1 FROM payments p
       WHERE p.member_id = m.id AND p.status = 'paid' AND p.period_start <= $2 AND p.period_end >= $1
     )
     ORDER BY m.full_name ASC
     LIMIT 1000`,
    params
  );
  return res.rows.map(mapRow);
}
var paymentCreateSchema = import_zod2.z.object({
  memberId: import_zod2.z.string().min(1),
  planId: import_zod2.z.string().optional(),
  amountEtb: import_zod2.z.number().positive(),
  period: import_zod2.z.enum(["weekly", "monthly", "yearly"]),
  paidForDate: import_zod2.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  method: import_zod2.z.enum(["cash", "bank_transfer", "mobile_money", "other"]),
  reference: import_zod2.z.string().optional(),
  bank: import_zod2.z.string().optional(),
  note: import_zod2.z.string().optional()
});
apiRouter.get("/admin/payments/unpaid", adminAuthChain, requirePermission("payments"), requireRegionScope, async (req, res) => {
  const period = ["weekly", "monthly", "yearly"].includes(String(req.query.period)) ? String(req.query.period) : "monthly";
  const date = isYmd(req.query.date) ? req.query.date : todayYmd();
  const rows = await findUnpaidMembers(period, date, req.query.regionId || void 0);
  const info = await loadPaymentInfo(rows.map((r) => r.id));
  const lang = getLang(req);
  return res.json({ success: true, data: rows.map((m) => toMemberSummaryDto(m, lang, info[m.id])) });
});
apiRouter.get("/admin/payments/export", adminAuthChain, requirePermission("payments"), requireRegionScope, async (req, res) => {
  const filters = {
    memberId: req.query.memberId,
    regionId: req.query.regionId,
    status: req.query.status,
    period: req.query.period,
    method: req.query.method,
    q: req.query.q,
    from: req.query.from,
    to: req.query.to
  };
  const first2 = await dbOperations.getPayments({ ...filters, page: 1, pageSize: 100 });
  let items = first2.items;
  for (let page = 2; page <= first2.meta.totalPages && page <= 50; page++) {
    items = items.concat((await dbOperations.getPayments({ ...filters, page, pageSize: 100 })).items);
  }
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: "payment.export", entity: "payments", ip: req.ip });
  const buffer = await exportService.exportPaymentsToExcel(items);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="ophea-payments.xlsx"');
  return res.send(buffer);
});
apiRouter.post("/admin/payments/reminders", adminAuthChain, requirePermission("sms"), requireRegionScope, async (req, res) => {
  const period = ["weekly", "monthly", "yearly"].includes(String(req.body?.period)) ? String(req.body.period) : "monthly";
  const date = isYmd(req.body?.date) ? req.body.date : todayYmd();
  const regionId = req.admin?.role === "RegionalAdmin" ? req.admin.regionId || void 0 : void 0;
  const unpaid = await findUnpaidMembers(period, date, regionId);
  if (process.env.FEATURE_SMS !== "true") {
    return res.json({ success: true, data: { queuedCount: 0 }, message: "SMS is not enabled on this server (FEATURE_SMS), so no reminders were queued." });
  }
  let queued = 0;
  for (const m of unpaid) {
    try {
      await afroSmsService.sendSms(m.phone, `OPHEA: Dear ${m.fullName}, your ${period} contribution is due. Please pay at your earliest convenience. Thank you.`);
      queued++;
    } catch {
    }
  }
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: "payment.reminders", entity: "payments", after: { period, date, queued }, ip: req.ip });
  return res.json({ success: true, data: { queuedCount: queued } });
});
apiRouter.post("/admin/payments", adminAuthChain, requirePermission("payments.record"), validateBody(paymentCreateSchema), async (req, res) => {
  const b = req.body;
  const member = await dbOperations.getMemberById(b.memberId);
  if (!member) return res.status(404).json({ success: false, error: "Member not found" });
  if (req.admin?.role === "RegionalAdmin" && member.regionId !== req.admin.regionId) {
    return res.status(403).json({ success: false, error: "Forbidden: Member outside your regional jurisdiction." });
  }
  const { start: periodStart, end: periodEnd } = periodBounds(b.period, b.paidForDate);
  const existing = await query(
    `SELECT id FROM payments WHERE member_id = $1 AND period = $2 AND period_start = $3 AND status = 'paid'`,
    [b.memberId, b.period, periodStart]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({
      success: false,
      error: `A contribution has already been recorded for this member for ${periodStart} to ${periodEnd}.`,
      fields: { paidForDate: "Already paid for this period" }
    });
  }
  const payment = await dbOperations.createPayment({
    memberId: b.memberId,
    planId: b.planId,
    regionId: member.regionId,
    amountEtb: b.amountEtb,
    period: b.period,
    periodStart,
    periodEnd,
    method: b.method,
    reference: b.reference,
    bank: b.bank,
    receivedBy: req.admin.fullName,
    receiptNo: await dbOperations.getNextReceiptNumber(),
    note: b.note
  });
  await dbOperations.createAuditLog({
    adminId: req.admin?.id,
    action: "payment.record",
    entity: "payments",
    entityId: payment.id,
    after: { receiptNo: payment.receiptNo, amountEtb: payment.amountEtb, period: payment.period, memberNo: member.memberNo },
    ip: req.ip
  });
  emailService.sendReceiptEmail(member.email, member.fullName, payment.receiptNo, payment.amountEtb, payment.period);
  if (process.env.FEATURE_SMS === "true") {
    afroSmsService.sendSms(member.phone, `OPHEA: Received ${payment.amountEtb} ETB contribution from ${member.fullName}. Receipt #${payment.receiptNo}. Thank you!`);
  }
  const full = await dbOperations.getPaymentById(payment.id);
  return res.status(201).json({ success: true, data: toPaymentDto(full, getLang(req)) });
});
apiRouter.get("/admin/payments", adminAuthChain, requirePermission("payments"), requireRegionScope, async (req, res) => {
  const s = (v) => typeof v === "string" && v.trim() ? v.trim() : void 0;
  const payments = await dbOperations.getPayments({
    memberId: s(req.query.memberId),
    regionId: s(req.query.regionId),
    status: s(req.query.status),
    period: s(req.query.period),
    method: s(req.query.method),
    q: s(req.query.q),
    from: s(req.query.from),
    to: s(req.query.to),
    page: parseInt(String(req.query.page || "1"), 10),
    pageSize: parseInt(String(req.query.pageSize || "20"), 10)
  });
  const lang = getLang(req);
  return res.json({ success: true, data: payments.items.map((p) => toPaymentDto(p, lang)), meta: payments.meta });
});
apiRouter.get("/admin/payments/:id", adminAuthChain, requirePermission("payments"), requireRegionScope, async (req, res) => {
  const payment = await dbOperations.getPaymentById(req.params.id);
  if (!payment) return res.status(404).json({ success: false, error: "Payment not found" });
  if (req.admin?.role === "RegionalAdmin" && payment.regionId !== req.admin.regionId) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  return res.json({ success: true, data: toPaymentDto(payment, getLang(req)) });
});
apiRouter.post("/admin/payments/:id/void", adminAuthChain, requirePermission("payments.void"), async (req, res) => {
  const note = String(req.body?.note || "").trim();
  if (!note) return res.status(400).json({ success: false, error: "A reason is required to void a payment", fields: { note: "Required" } });
  const existing = await dbOperations.getPaymentById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: "Payment not found" });
  if (existing.status === "void") return res.status(409).json({ success: false, error: "Payment is already void" });
  await dbOperations.voidPayment(req.params.id, note);
  await dbOperations.createAuditLog({ adminId: req.admin?.id, action: "payment.void", entity: "payments", entityId: req.params.id, after: { reason: note }, ip: req.ip });
  return res.json({ success: true, data: toPaymentDto(await dbOperations.getPaymentById(req.params.id), getLang(req)) });
});
apiRouter.get("/admin/payments/:id/receipt", adminAuthChain, requirePermission("payments"), async (req, res) => {
  const payment = await dbOperations.getPaymentById(req.params.id);
  if (!payment) return res.status(404).json({ success: false, error: "Payment not found" });
  const pdfBuffer = await exportService.generateReceiptPdf(payment);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="receipt-${payment.receiptNo}.pdf"`);
  return res.send(pdfBuffer);
});
apiRouter.post("/admin/sms/send", adminAuthChain, requirePermission("sms"), async (req, res) => {
  const { memberId, phone, message } = req.body;
  let targetPhone = phone;
  if (memberId && !targetPhone) {
    const mem = await dbOperations.getMemberById(memberId);
    if (mem) targetPhone = mem.phone;
  }
  if (!targetPhone || !message) {
    return res.status(400).json({ success: false, error: "Recipient phone number and message are required." });
  }
  const result = await afroSmsService.sendSms(targetPhone, message);
  await dbOperations.createSmsLog({
    memberId: memberId || null,
    phone: targetPhone,
    message,
    status: result.success ? "sent" : "failed",
    providerMessageId: result.messageId,
    error: result.error
  });
  return res.json({ success: result.success, messageId: result.messageId, error: result.error });
});
apiRouter.post("/admin/sms/campaigns", adminAuthChain, requirePermission("sms"), async (req, res) => {
  const { name, message, audienceFilter, scheduledAt } = req.body;
  if (!name || !message) {
    return res.status(400).json({ success: false, error: "Campaign name and message template are required." });
  }
  const campaign = await smsCampaignService.createCampaign({
    name,
    message,
    audienceFilter: audienceFilter || {},
    scheduledAt,
    createdBy: req.admin?.fullName || "Admin"
  });
  return res.status(201).json({ success: true, data: campaign });
});
apiRouter.get("/admin/sms/balance", adminAuthChain, requirePermission("sms"), async (req, res) => {
  const bal = await afroSmsService.getBalance();
  const n = typeof bal === "number" ? bal : Number(bal?.balance ?? 0);
  return res.json({ success: true, data: { balance: Number.isFinite(n) ? n : 0 } });
});
apiRouter.use(adminContentRouter);
apiRouter.use("/member", (req, res, next) => {
  if (process.env.FEATURE_MEMBER_PORTAL !== "true") {
    return res.status(403).json({
      success: false,
      error: "Member Portal is not enabled yet. Scheduled for Phase 4 deployment."
    });
  }
  next();
});
apiRouter.get("/member/directory", async (req, res) => {
  const result = await query(
    `SELECT member_no, full_name, occupation_type, town, organization_name 
     FROM members WHERE membership_status = 'active' LIMIT 50`
  );
  return res.json({ success: true, data: result.rows.map(mapRow) });
});

// src/routes/public.ts
var import_express2 = require("express");
var import_multer4 = __toESM(require("multer"), 1);
var import_path4 = __toESM(require("path"), 1);
var import_fs4 = __toESM(require("fs"), 1);
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);

// src/utils/response.ts
function success(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    data
  });
}
function paginated(res, data, meta, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    meta
  });
}
function fail2(res, error, statusCode = 400, fields) {
  const body = {
    success: false,
    error
  };
  if (fields && Object.keys(fields).length > 0) {
    body.fields = fields;
  }
  return res.status(statusCode).json(body);
}

// src/services/public/publicMappers.ts
function buildPublicProgram(row) {
  return {
    id: row.id,
    slug: row.slug || "",
    title: row.title,
    summary: row.summary,
    body: row.body,
    icon: row.icon || "",
    iconUrl: row.icon_url || "",
    orderIndex: Number(row.order_index ?? row.sort_order ?? 0)
  };
}
function buildPublicAnnouncement(row) {
  return {
    id: row.id,
    slug: row.slug || "",
    type: row.type,
    title: row.title,
    summary: row.summary,
    body: row.body,
    coverImage: row.cover_image_url || row.cover_image || null,
    coverImageUrl: row.cover_image_url || row.cover_image || null,
    location: row.location || null,
    organizationName: row.organization_name || null,
    attachmentUrl: row.attachment_url || null,
    externalLink: row.external_link || null,
    eventEndAt: row.event_end_at || null,
    registrationOpen: Boolean(row.registration_open),
    registrationUrl: row.registration_url || null,
    eventStartAt: row.event_start_at || null,
    deadline: row.deadline || null,
    publishedAt: row.published_at || null
  };
}
function buildPublicPartner(row) {
  return {
    id: row.id,
    name: typeof row.name === "object" && row.name !== null ? row.name.en || Object.values(row.name)[0] : row.name,
    website: row.website_url || row.website || null,
    logoUrl: row.logo_url || row.logo || null
  };
}
function buildPublicActivity(row) {
  let photos = [];
  if (Array.isArray(row.photos)) {
    photos = row.photos;
  } else if (typeof row.photos === "string") {
    try {
      const parsed = JSON.parse(row.photos);
      if (Array.isArray(parsed)) photos = parsed;
    } catch {
      photos = [row.photos];
    }
  } else if (row.image_url) {
    photos = [row.image_url];
  }
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || row.description || null,
    description: row.description || row.summary || null,
    date: row.activity_date || row.date || null,
    activityDate: row.activity_date || row.date || null,
    location: row.location || null,
    photos
  };
}

// src/services/public/registrationService.ts
var import_fs3 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_crypto4 = __toESM(require("crypto"), 1);

// src/utils/phone.ts
function normalizeEthiopianPhone2(phone) {
  let clean = String(phone || "").replace(/[^0-9+]/g, "");
  if (clean.startsWith("+")) clean = "+" + clean.slice(1).replace(/\+/g, "");
  if (clean.startsWith("09") || clean.startsWith("07")) clean = "+251" + clean.slice(1);
  else if (/^[79]\d{8}$/.test(clean)) clean = "+251" + clean;
  else if (clean.startsWith("251")) clean = "+" + clean;
  return clean;
}
var ETHIOPIAN_MOBILE = /^\+251[79]\d{8}$/;

// src/services/public/registrationService.ts
var DuplicateRegistrationError = class extends Error {
  constructor() {
    super("A member with this phone number, email address, or ID number already exists.");
    this.name = "DuplicateRegistrationError";
  }
};
var RegistrationValidationError = class extends Error {
  fields;
  constructor(fields) {
    super("Validation failed");
    this.name = "RegistrationValidationError";
    this.fields = fields;
  }
};
var text = (v) => typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
var first = (b, ...keys) => {
  for (const k of keys) {
    const v = text(b[k]);
    if (v) return v;
  }
  return "";
};
function toList(value) {
  if (value === void 0 || value === null || value === "") return [];
  if (Array.isArray(value)) return value.map((x) => text(x)).filter(Boolean);
  const raw = text(value);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => text(x)).filter(Boolean);
  } catch {
  }
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}
var ALLOWED_CATEGORIES = ["Professional", "Entrepreneur", "Corporate", "Associate"];
var ALLOWED_ID_TYPES = ["fayda", "passport", "kebele", "driver"];
var ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
function isPhoneOtpRequired() {
  return process.env.FEATURE_PHONE_OTP === "true";
}
function validateRegistrationInput(body, idDocumentFile) {
  const fields = {};
  const fullName = text(body.fullName);
  if (fullName.length < 2 || fullName.length > 120) fields.fullName = "Full name is required (2-120 characters)";
  const phone = normalizeEthiopianPhone2(text(body.phone));
  if (!ETHIOPIAN_MOBILE.test(phone)) fields.phone = "Enter a valid Ethiopian mobile number (+2519... or +2517...)";
  const email = text(body.email);
  if (!email) fields.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Invalid email address";
  const gender = text(body.gender).toLowerCase();
  if (gender && !["male", "female", "unspecified"].includes(gender)) fields.gender = "Gender must be male, female or unspecified";
  const category = text(body.membershipCategory);
  if (category && !ALLOWED_CATEGORIES.includes(category)) fields.membershipCategory = `Must be one of: ${ALLOWED_CATEGORIES.join(", ")}`;
  const dob = text(body.dateOfBirth);
  if (dob) {
    const parsed = /* @__PURE__ */ new Date(`${dob}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob) {
      fields.dateOfBirth = "Use a valid date (YYYY-MM-DD)";
    }
  }
  const idNumber = first(body, "idNumber", "nationalId");
  if (!idNumber) fields.idNumber = "ID number is required";
  const idType = first(body, "idType").toLowerCase() || "fayda";
  if (!ALLOWED_ID_TYPES.includes(idType)) fields.idType = `Must be one of: ${ALLOWED_ID_TYPES.join(", ")}`;
  if (!first(body, "regionId", "region")) fields.region = "Region is required";
  const consent = first(body, "consent", "declaration").toLowerCase();
  if (consent !== "true" && consent !== "on" && consent !== "1") fields.consent = "You must accept the declaration";
  if (!idDocumentFile) fields.idDocument = "ID document file is required (PDF, JPG or PNG, max 5MB)";
  else if (!ALLOWED_MIMES.includes(idDocumentFile.mimetype)) fields.idDocument = "Only PDF, JPG and PNG files are accepted";
  return { isValid: Object.keys(fields).length === 0, fields };
}
async function resolveLookup(table, value) {
  if (!value) return null;
  const res = await query(`SELECT id, code, label FROM ${table}`);
  const v = value.toLowerCase();
  for (const row of res.rows) {
    let label = row.label;
    if (typeof label === "string") {
      try {
        label = JSON.parse(label);
      } catch {
        label = { en: label };
      }
    }
    if (String(row.id).toLowerCase() === v || String(row.code).toLowerCase() === v || String(label?.en || "").toLowerCase() === v) {
      return row.id;
    }
  }
  return null;
}
async function resolveRegion(value) {
  const res = await query("SELECT id, name FROM regions WHERE is_active = true");
  const v = value.toLowerCase();
  for (const row of res.rows) {
    let name = row.name;
    if (typeof name === "string") {
      try {
        name = JSON.parse(name);
      } catch {
        name = { en: name };
      }
    }
    const names = [name?.en, name?.om, name?.am].filter(Boolean).map((x) => x.toLowerCase());
    if (String(row.id).toLowerCase() === v || String(row.id).toLowerCase() === `reg-${v}` || names.includes(v)) return row.id;
  }
  return null;
}
async function assertPhoneVerified(phone) {
  const res = await query("SELECT verified_for_phone_at AS verified_at FROM otp_codes WHERE phone = $1", [phone]);
  const at = res.rows[0]?.verified_at ? new Date(res.rows[0].verified_at).getTime() : 0;
  if (!at || Date.now() - at > 15 * 60 * 1e3) {
    throw new RegistrationValidationError({ phone: "Please verify this phone number with the SMS code first" });
  }
}
async function processRegistrationFilesAndSave(body, idDocumentFile, extraDocs = []) {
  const phone = normalizeEthiopianPhone2(text(body.phone));
  const email = text(body.email).toLowerCase();
  const idType = first(body, "idType").toLowerCase() || "fayda";
  const idNumber = first(body, "idNumber", "nationalId");
  const errors = {};
  const regionId = await resolveRegion(first(body, "regionId", "region"));
  if (!regionId) errors.region = "Unknown region";
  const gradInput = first(body, "graduationLevelId", "highestQualification");
  const graduationLevelId = gradInput ? await resolveLookup("lookup_graduation_levels", gradInput) : null;
  if (gradInput && !graduationLevelId) errors.highestQualification = "Unknown qualification";
  const fieldInput = first(body, "fieldOfStudyId", "fieldOfStudy");
  const fieldOfStudyId = fieldInput ? await resolveLookup("lookup_fields_of_study", fieldInput) : null;
  if (fieldInput && !fieldOfStudyId) errors.fieldOfStudy = "Unknown field of study";
  const subSectors = toList(body.industrySubSectors);
  const sectorInput = first(body, "sectorId") || subSectors[0] || "";
  const sectorId = sectorInput ? await resolveLookup("lookup_sectors", sectorInput) : null;
  const occ = first(body, "occupationType").toLowerCase();
  const occupationType = ["private", "government", "other"].includes(occ) ? occ : null;
  if (Object.keys(errors).length) throw new RegistrationValidationError(errors);
  if (isPhoneOtpRequired()) await assertPhoneVerified(phone);
  const memberId = import_crypto4.default.randomUUID();
  const memberDir = import_path3.default.join(PRIVATE_UPLOAD_PATH, "members", memberId);
  const docs = [{ file: idDocumentFile, kind: "id" }, ...extraDocs];
  const pool = await getPool();
  const client = await pool.connect();
  let started = false;
  try {
    const dup = await client.query(
      `SELECT id FROM members WHERE phone = $1 OR LOWER(email) = $2 OR id_number_hash = $3 LIMIT 1`,
      [phone, email, hashIdNumber(idType, idNumber)]
    );
    if (dup.rows.length > 0) throw new DuplicateRegistrationError();
    import_fs3.default.mkdirSync(memberDir, { recursive: true });
    await client.query("BEGIN");
    started = true;
    const memberNo = await dbOperations.getNextMemberNumber();
    const yearEstablished = parseInt(text(body.yearEstablished), 10);
    await client.query(
      `INSERT INTO members (
        id, member_no, full_name, phone, email, gender, date_of_birth,
        membership_category, nationality, business_tin, skills, expertise_areas, interests,
        emergency_contact_name, emergency_contact_phone,
        employment_status, year_established, zone_sub_city, woreda, institution_name,
        graduation_level_id, occupation_type, sector_id, field_of_study_id,
        professional_category, organization_name, job_title, region_id, town,
        id_type, id_number_hash, id_number_last4, registration_status, membership_status,
        preferred_language, source, phone_verified_at, consent_at, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,'pending','pending',$33,'online',$34,NOW(),NOW(),NOW()
      )`,
      [
        memberId,
        memberNo,
        text(body.fullName),
        phone,
        email,
        text(body.gender).toLowerCase() || "unspecified",
        text(body.dateOfBirth) || null,
        text(body.membershipCategory) || null,
        text(body.nationality) || null,
        text(body.businessTin) || null,
        first(body, "skills", "coreSkills") || null,
        toList(body.expertiseAreas ?? body.areasOfExpertise),
        toList(body.interests ?? body.areasOfInterest),
        text(body.emergencyContactName) || null,
        text(body.emergencyContactPhone) || null,
        text(body.employmentStatus) || null,
        Number.isFinite(yearEstablished) ? yearEstablished : null,
        text(body.zoneSubCity) || null,
        text(body.woreda) || null,
        text(body.institutionName) || null,
        graduationLevelId,
        occupationType,
        sectorId,
        fieldOfStudyId,
        first(body, "professionalCategory") || subSectors.join(", ") || null,
        first(body, "organizationName", "organization") || null,
        text(body.jobTitle) || null,
        regionId,
        first(body, "town", "cityTown") || null,
        idType,
        hashIdNumber(idType, idNumber),
        idNumber.slice(-4),
        ["en", "om", "am"].includes(text(body.preferredLanguage)) ? text(body.preferredLanguage) : "en",
        isPhoneOtpRequired() ? (/* @__PURE__ */ new Date()).toISOString() : null
      ]
    );
    for (const [index, doc] of docs.entries()) {
      const ext = import_path3.default.extname(doc.file.originalname).toLowerCase() || ".bin";
      const storedName = `${doc.kind}-${index + 1}-${import_crypto4.default.randomBytes(6).toString("hex")}${ext}`;
      const dest = import_path3.default.join(memberDir, storedName);
      import_fs3.default.renameSync(doc.file.path, dest);
      const sha256 = import_crypto4.default.createHash("sha256").update(import_fs3.default.readFileSync(dest)).digest("hex");
      await client.query(
        `INSERT INTO member_documents (id, member_id, kind, original_name, stored_name, mime, size, sha256, uploaded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
        [import_crypto4.default.randomUUID(), memberId, doc.kind, doc.file.originalname, storedName, doc.file.mimetype, doc.file.size, sha256]
      );
    }
    await client.query("COMMIT");
    started = false;
    return { memberId, memberNo };
  } catch (error) {
    if (started) await client.query("ROLLBACK");
    import_fs3.default.rmSync(memberDir, { recursive: true, force: true });
    for (const d of docs) import_fs3.default.rmSync(d.file.path, { force: true });
    throw error;
  } finally {
    client.release();
  }
}

// src/services/public/publicOtpService.ts
var import_crypto5 = __toESM(require("crypto"), 1);
var phoneSendTimestamps = /* @__PURE__ */ new Map();
function checkPhoneRateLimit(phone) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1e3;
  const timestamps = (phoneSendTimestamps.get(phone) || []).filter((t2) => now - t2 < windowMs);
  if (timestamps.length >= 3) {
    return false;
  }
  timestamps.push(now);
  phoneSendTimestamps.set(phone, timestamps);
  return true;
}
async function sendRegistrationOtp(phone) {
  const ethiopianPhoneRegex = /^\+251(9|7)\d{8}$/;
  if (!phone || !ethiopianPhoneRegex.test(phone)) {
    return { success: false, error: "Phone must be a valid Ethiopian number (+2519... or +2517...)" };
  }
  if (!checkPhoneRateLimit(phone)) {
    return { success: false, error: "Too many OTP requests for this phone number. Please wait 10 minutes." };
  }
  const code = Math.floor(1e5 + Math.random() * 9e5).toString();
  const codeHash = import_crypto5.default.createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1e3);
  const existing = await query("SELECT phone FROM otp_codes WHERE phone = $1", [phone]);
  if (existing.rows.length > 0) {
    await query(
      `UPDATE otp_codes SET
        code_hash = $1, "codeHash" = $1,
        expires_at = $2, "expiresAt" = $2,
        attempts = 0,
        consumed = false,
        created_at = NOW(), "createdAt" = NOW()
       WHERE phone = $3`,
      [codeHash, expiresAt, phone]
    );
  } else {
    await query(
      `INSERT INTO otp_codes (
        phone, code_hash, "codeHash", expires_at, "expiresAt", attempts, consumed, created_at, "createdAt"
      ) VALUES ($1, $2, $2, $3, $3, 0, false, NOW(), NOW())`,
      [phone, codeHash, expiresAt]
    );
  }
  const msg = `OPHEA: Your public registration verification code is ${code}. It expires in 5 minutes.`;
  await afroSmsService.sendSms(phone, msg);
  return {
    success: true,
    code: process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? code : void 0
  };
}
async function verifyRegistrationOtp(phone, code) {
  if (!phone || !code) {
    return { success: false, error: "Phone and verification code are required" };
  }
  const res = await query(
    `SELECT phone, code_hash, "codeHash", expires_at, "expiresAt", attempts, consumed FROM otp_codes WHERE phone = $1`,
    [phone]
  );
  if (res.rows.length === 0) {
    return { success: false, error: "Invalid or expired code" };
  }
  const row = res.rows[0];
  const storedHash = row.code_hash || row.codeHash;
  const expiresAt = new Date(row.expires_at || row.expiresAt);
  const attempts = Number(row.attempts || 0);
  const consumed = Boolean(row.consumed);
  if (consumed || expiresAt.getTime() < Date.now() || attempts >= 5) {
    return { success: false, error: "Invalid or expired code" };
  }
  const inputHash = import_crypto5.default.createHash("sha256").update(code.trim()).digest("hex");
  if (inputHash !== storedHash) {
    await query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1`, [phone]);
    return { success: false, error: "Invalid or expired code" };
  }
  await query(
    `UPDATE otp_codes SET
      consumed = true,
      verified_for_phone_at = NOW(),
      "verifiedForPhoneAt" = NOW()
     WHERE phone = $1`,
    [phone]
  );
  return { success: true };
}

// src/services/public/publicContentService.ts
async function getPublicSiteSettings() {
  const [branding, contact, socials] = await Promise.all([readSetting("branding"), readSetting("contact"), readSetting("socials")]);
  const i18n = (en, om = "") => ({ en, om, am: "" });
  const socialLinks = Object.fromEntries(Object.entries(socials).filter(([, v]) => typeof v === "string" && v.trim() !== ""));
  const phones = [contact.phonePrimary, contact.phoneSecondary, branding.supportPhone].filter((p, i, a) => p && a.indexOf(p) === i);
  const emails = [contact.emailGeneral, contact.emailSupport, branding.supportEmail].filter((e, i, a) => e && a.indexOf(e) === i);
  const coords = String(contact.mapCoordinates || "").trim();
  const mapLink = /^https?:\/\//i.test(coords) ? coords : coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : "";
  return {
    orgName: i18n(branding.orgName, branding.orgNameOm),
    shortName: "OPHEA",
    tagline: i18n(branding.tagline),
    mission: i18n(branding.mission),
    vision: i18n(branding.vision),
    logoUrl: "",
    contactPhones: phones,
    contactEmails: emails,
    address: i18n(contact.address),
    mapLink,
    workingHours: contact.workingHours,
    socialLinks,
    // convenience aliases (empty when not configured; nothing is invented)
    name: branding.orgName,
    email: emails[0] || "",
    phone: phones[0] || "",
    hotlines: phones,
    social: socialLinks
  };
}
async function getPublicRegionsWithWoredas() {
  const regRes = await query(`SELECT id, name FROM regions WHERE is_active = true ORDER BY sort_order ASC`);
  const worRes = await query(`SELECT id, region_id, name FROM woredas ORDER BY name ASC`);
  const woredasByRegion = {};
  for (const w of worRes.rows) {
    if (!woredasByRegion[w.region_id]) {
      woredasByRegion[w.region_id] = [];
    }
    woredasByRegion[w.region_id].push({
      id: w.id,
      name: w.name
    });
  }
  return regRes.rows.map((r) => {
    let regName = "";
    if (typeof r.name === "object" && r.name !== null) {
      regName = r.name.en || Object.values(r.name)[0] || "";
    } else {
      regName = String(r.name || "");
    }
    return {
      id: r.id,
      name: regName,
      woredas: woredasByRegion[r.id] || []
    };
  });
}
async function submitPublicContact(data) {
  const id = `msg-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
  await query(
    `INSERT INTO contact_messages (id, name, full_name, email, phone, subject, message, status, source, created_at)
     VALUES ($1, $2, $2, $3, $4, $5, $6, 'new', 'public_website', NOW())`,
    [id, data.fullName.trim(), data.email.trim(), data.phone.trim(), data.subject.trim(), data.message.trim()]
  );
  return { id };
}
async function subscribePublicNewsletter(data) {
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.name ? String(data.name).trim() : null;
  const cleanLang = data.language ? String(data.language).trim().toLowerCase() : null;
  const existing = await query(`SELECT id FROM newsletter_subscribers WHERE email = $1`, [cleanEmail]);
  if (existing.rows.length === 0) {
    const id = `sub-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
    await query(
      `INSERT INTO newsletter_subscribers (id, name, email, language, is_active, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [id, cleanName, cleanEmail, cleanLang]
    );
  }
}

// src/routes/public.ts
var publicRouter = (0, import_express2.Router)();
var tmpDir = import_path4.default.resolve(PRIVATE_UPLOAD_PATH, "temp");
if (!import_fs4.default.existsSync(tmpDir)) {
  import_fs4.default.mkdirSync(tmpDir, { recursive: true });
}
var registrationUpload = (0, import_multer4.default)({
  dest: tmpDir,
  limits: { fileSize: 5 * 1024 * 1024 }
  // 5 MB per file
}).fields([
  { name: "idDocument", maxCount: 1 },
  { name: "credentialDocs", maxCount: 10 },
  { name: "cvCompanyProfile", maxCount: 1 },
  { name: "academicCertificates", maxCount: 10 }
]);
var globalPublicLimiter = (0, import_express_rate_limit.default)({
  windowMs: 60 * 1e3,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please slow down." }
});
var otpRouteLimiter = (0, import_express_rate_limit.default)({
  windowMs: 60 * 1e3,
  max: process.env.NODE_ENV === "production" ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many OTP requests from this IP. Please try again later." }
});
publicRouter.use(globalPublicLimiter);
publicRouter.get("/site-settings", async (req, res) => {
  try {
    const data = await getPublicSiteSettings();
    return success(res, data);
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
var PUBLIC_STATS_CONTRACT_VERSION = 1;
var statsHandler = async (_req, res) => {
  try {
    const membersResult = await query(`SELECT COUNT(*)::int AS total FROM members WHERE membership_status = 'active'`);
    const counters = await readSetting("stats");
    const toInt = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    };
    const data = {
      totalMembers: toInt(membersResult.rows[0]?.total),
      accreditedHotels: toInt(counters.accreditedHotels),
      certifiedGuides: toInt(counters.certifiedGuides),
      trainingGraduates: toInt(counters.trainingGraduates)
    };
    res.setHeader("X-Contract-Version", String(PUBLIC_STATS_CONTRACT_VERSION));
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json({ success: true, data });
  } catch (err) {
    return fail2(res, err.message, 500);
  }
};
publicRouter.get("/stats", statsHandler);
publicRouter.get("/programs", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM programs WHERE is_active = true ORDER BY sort_order ASC`
    );
    return success(res, result.rows.map(buildPublicProgram));
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.get("/programs/:slug", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM programs WHERE slug = $1 AND is_active = true`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return fail2(res, "Not found", 404);
    }
    return success(res, buildPublicProgram(result.rows[0]));
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.get("/announcements", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "10"), 10)));
    const offset = (page - 1) * limit;
    let whereClause = `WHERE status = 'published' AND (published_at IS NULL OR published_at <= NOW())`;
    const params = [];
    if (req.query.type) {
      params.push(req.query.type);
      whereClause += ` AND type = $${params.length}`;
    }
    const countRes = await query(`SELECT COUNT(*) as count FROM announcements ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);
    const totalPages = Math.ceil(total / limit) || 1;
    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;
    const listRes = await query(
      `SELECT * FROM announcements ${whereClause} ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );
    return paginated(res, listRes.rows.map(buildPublicAnnouncement), {
      page,
      pageSize: limit,
      total,
      totalPages
    });
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.get("/announcements/:slug", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM announcements WHERE slug = $1 AND status = 'published' AND (published_at IS NULL OR published_at <= NOW())`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return fail2(res, "Not found", 404);
    }
    return success(res, buildPublicAnnouncement(result.rows[0]));
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.get("/partners", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM partners WHERE is_active = true ORDER BY sort_order ASC, name ASC`
    );
    return success(res, result.rows.map(buildPublicPartner));
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.get("/activities", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM activities WHERE is_public = true ORDER BY activity_date DESC LIMIT 50`
    );
    return success(res, result.rows.map(buildPublicActivity));
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.get("/lookups/regions", async (req, res) => {
  try {
    const data = await getPublicRegionsWithWoredas();
    return success(res, data);
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.get("/config", (_req, res) => {
  return success(res, { phoneOtpRequired: isPhoneOtpRequired() });
});
publicRouter.get("/objectives", async (req, res) => {
  try {
    const kind = typeof req.query.kind === "string" ? req.query.kind : "";
    const result = kind ? await query("SELECT * FROM objectives WHERE kind = $1 ORDER BY sort_order ASC", [kind]) : await query("SELECT * FROM objectives ORDER BY kind ASC, sort_order ASC");
    return success(res, result.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      description: r.description,
      sortOrder: Number(r.sort_order) || 0
    })));
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
var LOOKUP_TABLES2 = {
  "graduation-levels": "lookup_graduation_levels",
  fields: "lookup_fields_of_study",
  sectors: "lookup_sectors",
  occupations: "lookup_occupation_types"
};
publicRouter.get("/lookups/:type", async (req, res) => {
  const table = LOOKUP_TABLES2[req.params.type];
  if (!table) return fail2(res, "Unknown lookup type", 404);
  try {
    const result = await query(`SELECT id, code, label FROM ${table} WHERE is_active = true ORDER BY sort_order ASC`);
    return success(res, result.rows);
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.post("/registrations", (req, res, next) => {
  registrationUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      return fail2(res, uploadErr.message || "File upload error", 400);
    }
    try {
      const files = req.files;
      const idDocFile = files?.["idDocument"]?.[0];
      const extraDocs = [
        ...(files?.["credentialDocs"] || []).map((file) => ({ file, kind: "credential" })),
        ...(files?.["academicCertificates"] || []).map((file) => ({ file, kind: "credential" })),
        ...(files?.["cvCompanyProfile"] || []).map((file) => ({ file, kind: "cv" }))
      ];
      const discardUploads = () => {
        for (const list of Object.values(files || {})) for (const f of list) import_fs4.default.rmSync(f.path, { force: true });
      };
      if (req.body.gender && typeof req.body.gender === "string") {
        req.body.gender = req.body.gender.toLowerCase();
      }
      const validation = validateRegistrationInput(req.body, idDocFile);
      if (!validation.isValid) {
        discardUploads();
        return fail2(res, "Validation failed", 400, validation.fields);
      }
      const member = await processRegistrationFilesAndSave(req.body, idDocFile, extraDocs);
      return res.status(201).json({
        success: true,
        data: {
          memberId: member.memberId,
          memberNo: member.memberNo,
          registrationStatus: "pending",
          membershipStatus: "pending",
          message: "Application received. Our team will review it shortly."
        }
      });
    } catch (err) {
      if (err instanceof DuplicateRegistrationError) {
        return fail2(res, err.message, 409);
      }
      if (err instanceof RegistrationValidationError) {
        return fail2(res, "Validation failed", 400, err.fields);
      }
      return fail2(res, err.message, 500);
    }
  });
});
publicRouter.post("/registrations/otp/send", otpRouteLimiter, async (req, res) => {
  try {
    const phone = normalizeEthiopianPhone2(String(req.body?.phone || ""));
    const result = await sendRegistrationOtp(phone);
    if (!result.success) {
      return fail2(res, result.error || "Failed to send OTP", 400);
    }
    const responseData = { message: "OTP sent" };
    if ((process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && result.code) {
      responseData.code = result.code;
    }
    return success(res, responseData);
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.post("/registrations/otp/verify", otpRouteLimiter, async (req, res) => {
  try {
    const phone = normalizeEthiopianPhone2(String(req.body?.phone || ""));
    const code = String(req.body?.code || "");
    const result = await verifyRegistrationOtp(phone, code);
    if (!result.success) {
      return fail2(res, result.error || "Invalid or expired code", 400);
    }
    return success(res, { verified: true });
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.post("/contact", async (req, res) => {
  try {
    const { fullName, email, phone, subject, message } = req.body;
    const fields = {};
    if (!fullName || typeof fullName !== "string" || fullName.trim().length === 0) {
      fields.fullName = "Full name is required";
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fields.email = "Valid email is required";
    }
    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      fields.phone = "Phone number is required";
    }
    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      fields.subject = "Subject is required";
    }
    if (!message || typeof message !== "string" || message.trim().length < 10 || message.trim().length > 2e3) {
      fields.message = "Message must be between 10 and 2000 characters";
    }
    if (Object.keys(fields).length > 0) {
      return fail2(res, "Validation failed", 400, fields);
    }
    await submitPublicContact({ fullName, email, phone, subject, message });
    return success(res, { message: "Message received" });
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});
publicRouter.post("/newsletter", async (req, res) => {
  try {
    const { email, name, language } = req.body;
    const fields = {};
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fields.email = "Valid email is required";
    }
    if (language !== void 0 && language !== null && !["en", "om", "am"].includes(language)) {
      fields.language = "Language must be one of: en, om, am";
    }
    if (Object.keys(fields).length > 0) {
      return fail2(res, "Validation failed", 400, fields);
    }
    await subscribePublicNewsletter({ email, name, language });
    return success(res, { message: "Subscribed" });
  } catch (err) {
    return fail2(res, err.message, 500);
  }
});

// src/routes/health.ts
var import_express3 = require("express");
var healthRouter = (0, import_express3.Router)();
healthRouter.get("/health", async (_req, res) => {
  const startedAt = Date.now();
  let dbOk = false;
  try {
    await query("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const status = dbOk ? "healthy" : "degraded";
  const payload = {
    status,
    uptimeSeconds: Math.floor(process.uptime()),
    db: dbOk ? "ok" : "unreachable",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    latencyMs: Date.now() - startedAt
  };
  res.status(dbOk ? 200 : 503).json({ success: dbOk, status, data: payload });
});

// src/routes/contract.ts
var import_express4 = require("express");
var contractRouter = (0, import_express4.Router)();
contractRouter.get("/contract.json", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    version: 1,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    envelope: {
      success: "boolean",
      data: "any",
      meta: "optional { page:number, pageSize:number, total:number, totalPages:number }",
      error: "optional string",
      fields: "optional Record<string,string>"
    },
    paginationKeys: ["page", "pageSize", "total", "totalPages"],
    endpoints: {
      public: {
        "GET /api/public/stats": {
          responseShape: ["totalMembers", "accreditedHotels", "certifiedGuides", "trainingGraduates"],
          headers: { "X-Contract-Version": "1" }
        },
        "GET /api/public/announcements": { paginated: true },
        "GET /api/public/announcements/:slug": {},
        "GET /api/public/programs": {},
        "GET /api/public/programs/:slug": {},
        "GET /api/public/partners": {},
        "GET /api/public/activities": {},
        "GET /api/public/config": { responseShape: ["phoneOtpRequired"] },
        "GET /api/public/objectives": { query: ["kind"] },
        "GET /api/public/lookups/regions": {},
        "GET /api/public/lookups/graduation-levels": {},
        "GET /api/public/lookups/fields": {},
        "GET /api/public/lookups/sectors": {},
        "GET /api/public/lookups/occupations": {},
        "GET /api/public/site-settings": {},
        "POST /api/public/contact": { requiredFields: ["fullName", "email", "phone", "subject", "message"] },
        "POST /api/public/newsletter": { requiredFields: ["email"], optional: ["name", "language"] },
        "POST /api/public/registrations": {
          multipart: true,
          requiredFields: ["fullName", "phone", "email", "idNumber|nationalId", "region|regionId", "consent|declaration", "idDocument"],
          optional: [
            "idType",
            "gender",
            "dateOfBirth",
            "membershipCategory",
            "nationality",
            "emergencyContactName",
            "emergencyContactPhone",
            "businessTin",
            "skills|coreSkills",
            "expertiseAreas|areasOfExpertise",
            "interests|areasOfInterest",
            "highestQualification|graduationLevelId",
            "fieldOfStudy|fieldOfStudyId",
            "industrySubSectors",
            "employmentStatus",
            "organization",
            "jobTitle",
            "yearEstablished",
            "zoneSubCity",
            "woreda",
            "cityTown",
            "institutionName",
            "cvCompanyProfile",
            "academicCertificates",
            "credentialDocs"
          ]
        },
        "POST /api/public/registrations/otp/send": { requiredFields: ["phone"] },
        "POST /api/public/registrations/otp/verify": { requiredFields: ["phone", "code"] }
      },
      auth: {
        "POST /api/auth/login": { requiredFields: ["usernameOrEmail", "password"] },
        "GET  /api/auth/me": {},
        "POST /api/auth/change-password": { requiredFields: ["currentPassword", "newPassword"] },
        "POST /api/auth/logout": {}
      },
      admin: {
        "GET /api/admin/dashboard/summary": {},
        "GET /api/admin/dashboard/members-by": { query: ["dimension", "lang", "regionId"] },
        "GET /api/admin/dashboard/contributions": { query: ["range", "group", "regionId"] },
        "GET /api/admin/dashboard/recent-activity": {},
        "GET /api/admin/members": { paginated: true, query: ["q", "registrationStatus", "membershipStatus", "gender", "regionId", "sectorId", "fieldId", "paid", "page", "pageSize", "sort"] },
        "POST /api/admin/members": {},
        "GET /api/admin/members/:id": {},
        "GET /api/admin/members/:id/payments": {},
        "PUT /api/admin/members/:id": {},
        "PATCH /api/admin/members/:id/status": { requiredFields: ["membershipStatus"] },
        "POST /api/admin/members/:id/approve": {},
        "POST /api/admin/members/:id/reject": { requiredFields: ["reason"] },
        "DELETE /api/admin/members/:id": {},
        "GET /api/admin/registrations/pending-count": {},
        "GET /api/admin/members/export": { query: ["format"], binary: true },
        "GET /api/admin/members/:id/documents/:docId": { binary: true, authHeader: true },
        "GET /api/admin/payments": { paginated: true },
        "POST /api/admin/payments": { requiredFields: ["memberId", "amountEtb", "period", "paidForDate", "method"] },
        "POST /api/admin/payments/:id/void": { requiredFields: ["note"] },
        "GET /api/admin/payments/:id/receipt": { binary: true },
        "GET /api/admin/payments/unpaid": {},
        "GET /api/admin/payments/export": { binary: true },
        "GET /api/admin/payments/:id": {},
        "POST /api/admin/payments/reminders": { requiredFields: ["period", "date"] },
        "GET /api/admin/contribution-plans": {},
        "POST /api/admin/contribution-plans": { requiredFields: ["name", "period", "amountEtb"] },
        "PUT /api/admin/contribution-plans/:id": {},
        "DELETE /api/admin/contribution-plans/:id": {},
        "GET /api/admin/announcements": { paginated: false, query: ["type", "status", "q"] },
        "POST /api/admin/announcements": {},
        "PUT /api/admin/announcements/:id": {},
        "PATCH /api/admin/announcements/:id/publish": {},
        "PATCH /api/admin/announcements/:id/archive": {},
        "DELETE /api/admin/announcements/:id": {},
        "GET /api/admin/programs": {},
        "POST /api/admin/programs": {},
        "PUT /api/admin/programs/:id": {},
        "DELETE /api/admin/programs/:id": {},
        "GET /api/admin/objectives": {},
        "POST /api/admin/objectives": {},
        "PUT /api/admin/objectives/:id": {},
        "DELETE /api/admin/objectives/:id": {},
        "GET /api/admin/partners": {},
        "POST /api/admin/partners": {},
        "PUT /api/admin/partners/:id": {},
        "DELETE /api/admin/partners/:id": {},
        "GET /api/admin/activities": {},
        "POST /api/admin/activities": {},
        "PUT /api/admin/activities/:id": {},
        "DELETE /api/admin/activities/:id": {},
        "GET /api/admin/settings/:key": {},
        "PUT /api/admin/settings/:key": {},
        "GET /api/admin/messages": { paginated: true, query: ["status", "page", "pageSize"] },
        "PATCH /api/admin/messages/:id": { requiredFields: ["status"], enum: { status: ["new", "read", "in_progress", "resolved"] } },
        "GET /api/admin/subscribers": { paginated: true },
        "DELETE /api/admin/subscribers/:id": {},
        "POST /api/admin/sms/send": {},
        "POST /api/admin/sms/campaigns": {},
        "GET /api/admin/sms/campaigns": { paginated: true },
        "GET /api/admin/sms/logs": { paginated: true },
        "GET /api/admin/sms/balance": {},
        "GET /api/admin/meta/permissions": {},
        "GET /api/admin/users": { paginated: true },
        "POST /api/admin/users": {},
        "PUT /api/admin/users/:id": {},
        "PATCH /api/admin/users/:id/active": { requiredFields: ["active"] },
        "POST /api/admin/users/:id/reset-password": {},
        "GET /api/admin/regions": {},
        "POST /api/admin/regions": {},
        "PUT /api/admin/regions/:id": {},
        "GET /api/admin/lookups/:type": {},
        "GET /api/admin/audit-logs": { paginated: true }
      }
    },
    enums: {
      registrationStatus: ["pending", "approved", "rejected"],
      membershipStatus: ["active", "inactive", "pending"],
      announcementType: ["news", "event", "vacancy", "proposal", "research"],
      announcementStatus: ["draft", "published", "archived"],
      paymentMethod: ["cash", "bank_transfer", "mobile_money", "other"],
      paymentStatus: ["paid", "void"],
      paymentPeriod: ["weekly", "monthly", "yearly"],
      messageStatus: ["new", "read", "in_progress", "resolved"],
      memberGender: ["male", "female", "unspecified"],
      memberIdType: ["fayda", "passport", "kebele", "driver"]
    },
    localizedFields: ["en", "om", "am"],
    notes: [
      "All admin endpoints require Authorization: Bearer <token>.",
      "All public endpoints accept no Authorization header and are rate-limited.",
      "Paginated responses include meta = { page, pageSize, total, totalPages }.",
      "Error responses include fields object with per-field validation messages.",
      "Arabic (ar) and French (fr) are NOT supported yet \u2014 only en/om/am."
    ]
  });
});

// src/backend/swagger.ts
var openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "OPHEA REST API Backend",
    version: "1.0.0",
    description: "Headless REST API backend for the Oromia Hospitality & Tourism Professionals Association (OPHEA). Powers the public registration & information website and the administrative member-management portal.",
    contact: {
      name: "OPHEA Technical Administration",
      email: "support@ophea.org"
    }
  },
  servers: [
    {
      url: "/api",
      description: "Default relative API server"
    },
    {
      url: "http://localhost:3000/api",
      description: "Local development server"
    }
  ],
  tags: [
    { name: "Health", description: "API health checks and engine status" },
    { name: "Auth", description: "Admin authentication, token verification, and password management" },
    { name: "Public", description: "Unauthenticated public association endpoints (lookups, programs, stats)" },
    { name: "Public Registration", description: "Public member onboarding and document submission" },
    { name: "Members", description: "Admin member management, verification, approvals, and exports" },
    { name: "Dashboard", description: "Real-time statistical aggregations, demographics, and metrics" },
    { name: "Payments", description: "Contribution tracking, official receipts, and financial reporting" },
    { name: "Content", description: "CMS announcements, activities, objectives, programs, and settings" },
    { name: "SMS", description: "AfroMessage SMS dispatches and targeted bulk campaigns" },
    { name: "Users", description: "Administrative user accounts and RBAC permission assignments" },
    { name: "Audit", description: "Immutable system action logs" }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Provide your JWT bearer token obtained from POST /api/auth/login"
      }
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "object" },
          error: { type: "string", example: null }
        }
      },
      ApiErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string", example: "Validation failed or resource not found" },
          fields: { type: "object", additionalProperties: { type: "string" } }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["usernameOrEmail", "password"],
        properties: {
          usernameOrEmail: { type: "string", example: "admin@ophea.org" },
          password: { type: "string", example: "Admin12345!ChangeMe" }
        }
      },
      LoginResponseData: {
        type: "object",
        properties: {
          token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsIn..." },
          user: {
            type: "object",
            properties: {
              id: { type: "string", example: "9a21b4fe-..." },
              username: { type: "string", example: "superadmin" },
              email: { type: "string", example: "admin@ophea.org" },
              fullName: { type: "string", example: "OPHEA Central Administrator" },
              role: { type: "string", enum: ["SuperAdmin", "RegionalAdmin", "Finance", "Editor"], example: "SuperAdmin" },
              permissions: { type: "array", items: { type: "string" } },
              regionId: { type: "string", nullable: true },
              mustChangePassword: { type: "boolean", example: false }
            }
          }
        }
      },
      MemberRegistrationRequest: {
        type: "object",
        required: [
          "fullName",
          "phone",
          "email",
          "gender",
          "graduationLevelId",
          "occupationType",
          "sectorId",
          "fieldOfStudyId",
          "regionId",
          "idType",
          "idNumber",
          "consent"
        ],
        properties: {
          fullName: { type: "string", example: "Tolasa Gudeta" },
          phone: { type: "string", example: "+251911223344" },
          email: { type: "string", example: "tolasa.gudeta@example.com" },
          gender: { type: "string", enum: ["male", "female"], example: "male" },
          dateOfBirth: { type: "string", format: "date", example: "1995-04-12" },
          graduationLevelId: { type: "string", example: "grad-first_degree" },
          occupationType: { type: "string", enum: ["private", "government", "other"], example: "private" },
          sectorId: { type: "string", example: "sec-hotel" },
          fieldOfStudyId: { type: "string", example: "fos-tourism_mgmt" },
          professionalCategory: { type: "string", example: "Executive Housekeeper" },
          organizationName: { type: "string", example: "Oromia Grand Palace Hotel" },
          jobTitle: { type: "string", example: "General Manager" },
          regionId: { type: "string", example: "reg-adama-city" },
          town: { type: "string", example: "Adama" },
          idType: { type: "string", enum: ["fayda", "passport"], example: "fayda" },
          idNumber: { type: "string", example: "123456789012" },
          consent: { type: "boolean", example: true }
        }
      },
      PaymentRecordRequest: {
        type: "object",
        required: ["memberId", "amountEtb", "period", "paidForDate", "method"],
        properties: {
          memberId: { type: "string", format: "uuid", example: "320e6f77-..." },
          planId: { type: "string", nullable: true, example: "plan-monthly-100" },
          amountEtb: { type: "number", example: 100 },
          period: { type: "string", enum: ["weekly", "monthly", "yearly"], example: "monthly" },
          paidForDate: { type: "string", format: "date", example: "2026-11-01" },
          method: { type: "string", enum: ["cash", "bank_transfer", "mobile_money", "other"], example: "mobile_money" },
          bank: { type: "string", example: "Sinke Bank" },
          reference: { type: "string", example: "TXN-9988221" },
          note: { type: "string", example: "November monthly dues" }
        }
      },
      SmsCampaignRequest: {
        type: "object",
        required: ["name", "message"],
        properties: {
          name: { type: "string", example: "Annual General Meeting Invitation" },
          message: { type: "string", example: "Dear {{fullName}}, your OPHEA member number is {{memberNo}}. Please attend the upcoming summit." },
          audienceFilter: {
            type: "object",
            properties: {
              regionId: { type: "string" },
              sectorId: { type: "string" },
              membershipStatus: { type: "string", enum: ["active", "pending", "inactive"] }
            }
          },
          scheduledAt: { type: "string", format: "date-time", nullable: true }
        }
      }
    }
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Service health check and database connectivity",
        responses: {
          "200": { description: "Service is healthy" }
        }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Administrator login",
        description: "Authenticates with username or email and returns a signed JWT token.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } }
          }
        },
        responses: {
          "200": {
            description: "Authentication successful",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponseData" } } }
          },
          "401": { description: "Invalid credentials" },
          "429": { description: "Too many login attempts" }
        }
      }
    },
    "/admin/login": {
      post: {
        tags: ["Auth"],
        summary: "Alias for /auth/login",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } }
          }
        },
        responses: {
          "200": { description: "Authentication successful" }
        }
      }
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current administrator context",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Current admin record" },
          "401": { description: "Unauthorized" }
        }
      }
    },
    "/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change administrator password",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string", minLength: 8 }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Password changed successfully" },
          "400": { description: "Current password incorrect or validation error" }
        }
      }
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Audit-logged administrator logout",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Logged out successfully" }
        }
      }
    },
    "/public/site-settings": {
      get: {
        tags: ["Public"],
        summary: "Public organization settings, profile, and contacts",
        security: [],
        responses: {
          "200": { description: "Site settings object" }
        }
      }
    },
    "/public/stats": {
      get: {
        tags: ["Public"],
        summary: "Public safe aggregated metrics (4 numbers: totalMembers, accreditedHotels, certifiedGuides, trainingGraduates)",
        security: [],
        responses: {
          "200": { description: "Safe aggregates object" }
        }
      }
    },
    "/public/lookups": {
      get: {
        tags: ["Public"],
        summary: "Localized system lookups (regions, sectors, fields, grad levels)",
        security: [],
        parameters: [
          { name: "lang", in: "query", schema: { type: "string", enum: ["en", "om", "am", "ar", "fr"] } }
        ],
        responses: {
          "200": { description: "Localized lookup items" }
        }
      }
    },
    "/public/lookups/regions": {
      get: {
        tags: ["Public"],
        summary: "Regions with nested woredas",
        security: [],
        responses: {
          "200": { description: "List of regions with woredas" }
        }
      }
    },
    "/public/programs": {
      get: {
        tags: ["Public"],
        summary: "List published core programs",
        security: [],
        responses: {
          "200": { description: "List of program objects" }
        }
      }
    },
    "/public/programs/{slug}": {
      get: {
        tags: ["Public"],
        summary: "Get program detail by slug",
        security: [],
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Program detail" },
          "404": { description: "Program not found" }
        }
      }
    },
    "/public/objectives": {
      get: {
        tags: ["Public"],
        summary: "List organizational objectives",
        security: [],
        parameters: [
          { name: "kind", in: "query", schema: { type: "string", enum: ["general", "official", "main", "specific"] } }
        ],
        responses: {
          "200": { description: "List of objectives" }
        }
      }
    },
    "/public/partners": {
      get: {
        tags: ["Public"],
        summary: "List published partner organizations",
        security: [],
        responses: {
          "200": { description: "List of partners" }
        }
      }
    },
    "/public/activities": {
      get: {
        tags: ["Public"],
        summary: "List recent organizational activities",
        security: [],
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 10 } }],
        responses: {
          "200": { description: "List of activities" }
        }
      }
    },
    "/public/announcements": {
      get: {
        tags: ["Public"],
        summary: "List published announcements, events, and vacancies",
        security: [],
        parameters: [
          { name: "type", in: "query", schema: { type: "string", enum: ["vacancy", "call_for_proposal", "call_for_research", "news", "event"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } }
        ],
        responses: {
          "200": { description: "Paginated announcements" }
        }
      }
    },
    "/public/announcements/{slug}": {
      get: {
        tags: ["Public"],
        summary: "Get published announcement by slug",
        security: [],
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Announcement detail" },
          "404": { description: "Not found" }
        }
      }
    },
    "/public/registrations": {
      post: {
        tags: ["Public"],
        summary: "Submit new membership registration (multipart/form-data)",
        security: [],
        description: "Creates a pending member directly in the members table and associates uploaded documents with that member. OTP verification does not change member status.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["fullName", "phone", "idType", "idNumber", "idDocument"],
                properties: {
                  fullName: { type: "string", minLength: 2, maxLength: 120 },
                  email: { type: "string", format: "email" },
                  phone: { type: "string", pattern: "^\\+251(9|7)\\d{8}$" },
                  gender: { type: "string", enum: ["male", "female", "unspecified"] },
                  membershipCategory: {
                    type: "string",
                    enum: ["Professional", "Entrepreneur", "Corporate", "Associate"]
                  },
                  dateOfBirth: { type: "string", format: "date" },
                  nationality: { type: "string" },
                  emergencyContactName: { type: "string" },
                  emergencyContactPhone: { type: "string" },
                  businessTin: { type: "string" },
                  skills: { type: "string" },
                  expertiseAreas: { type: "array", items: { type: "string" } },
                  interests: { type: "array", items: { type: "string" } },
                  qualification: { type: "string" },
                  fieldOfStudy: { type: "string" },
                  organization: { type: "string" },
                  zone: { type: "string" },
                  idType: { type: "string", enum: ["fayda", "passport", "kebele", "driver"] },
                  idNumber: { type: "string" },
                  idDocument: { type: "string", format: "binary" },
                  credentialDocs: { type: "array", items: { type: "string", format: "binary" } }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Pending member created; response contains memberId and memberNo" },
          "400": { description: "Validation failed" },
          "409": { description: "Member with the supplied phone, email, or ID already exists" }
        }
      }
    },
    "/public/registrations/otp/send": {
      post: {
        tags: ["Public"],
        summary: "Dispatch 6-digit registration OTP to Ethiopian phone via AfroMessage",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone"],
                properties: {
                  phone: { type: "string", pattern: "^\\+251(9|7)\\d{8}$" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "OTP sent" },
          "400": { description: "Invalid phone or rate limit exceeded" }
        }
      }
    },
    "/public/registrations/otp/verify": {
      post: {
        tags: ["Public"],
        summary: "Verify registration OTP code",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone", "code"],
                properties: {
                  phone: { type: "string" },
                  code: { type: "string", minLength: 6, maxLength: 6 }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Verified successfully" },
          "400": { description: "Invalid or expired code" }
        }
      }
    },
    "/public/contact": {
      post: {
        tags: ["Public"],
        summary: "Submit contact message",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName", "email", "phone", "subject", "message"],
                properties: {
                  fullName: { type: "string" },
                  email: { type: "string", format: "email" },
                  phone: { type: "string" },
                  subject: { type: "string" },
                  message: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Message received" }
        }
      }
    },
    "/public/newsletter": {
      post: {
        tags: ["Public"],
        summary: "Subscribe to newsletter",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                  name: { type: "string" },
                  language: { type: "string", enum: ["en", "om", "am"] }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Subscribed" }
        }
      }
    },
    "/public/translations/{lang}": {
      get: {
        tags: ["Public"],
        summary: "Get UI translation strings for a language",
        parameters: [{ name: "lang", in: "path", required: true, schema: { type: "string", enum: ["en", "om", "am", "ar", "fr"] } }],
        responses: {
          "200": { description: "Key-value translations dictionary" }
        }
      }
    },
    "/admin/members": {
      get: {
        tags: ["Members"],
        summary: "List members with filtering, search, and pagination",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "registrationStatus", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"] } },
          { name: "membershipStatus", in: "query", schema: { type: "string", enum: ["pending", "active", "inactive"] } },
          { name: "gender", in: "query", schema: { type: "string", enum: ["male", "female"] } },
          { name: "regionId", in: "query", schema: { type: "string" } },
          { name: "sectorId", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
          { name: "sort", in: "query", schema: { type: "string", example: "createdAt:desc" } }
        ],
        responses: {
          "200": { description: "Paginated members list with metadata" },
          "401": { description: "Unauthorized" }
        }
      },
      post: {
        tags: ["Members"],
        summary: "Manually register a member by admin",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/MemberRegistrationRequest" } } }
        },
        responses: {
          "201": { description: "Member created" }
        }
      }
    },
    "/admin/members/{id}": {
      get: {
        tags: ["Members"],
        summary: "Get member profile with documents and payment history",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Full member record" },
          "404": { description: "Member not found" }
        }
      },
      put: {
        tags: ["Members"],
        summary: "Update member profile details",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          "200": { description: "Member updated" }
        }
      },
      delete: {
        tags: ["Members"],
        summary: "Deactivate / soft-delete member (SuperAdmin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Member deactivated" }
        }
      }
    },
    "/admin/members/{id}/approve": {
      post: {
        tags: ["Members"],
        summary: "Approve pending member registration",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Member approved" }
        }
      }
    },
    "/admin/members/{id}/reject": {
      post: {
        tags: ["Members"],
        summary: "Reject pending member registration with reason",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["reason"],
                properties: { reason: { type: "string" } }
              }
            }
          }
        },
        responses: {
          "200": { description: "Member rejected" }
        }
      }
    },
    "/admin/members/{id}/status": {
      patch: {
        tags: ["Members"],
        summary: "Toggle membership status (active | inactive)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["membershipStatus"],
                properties: { membershipStatus: { type: "string", enum: ["active", "inactive", "pending"] } }
              }
            }
          }
        },
        responses: {
          "200": { description: "Status updated" }
        }
      }
    },
    "/admin/members/export": {
      get: {
        tags: ["Members"],
        summary: "Export filtered members to Excel or PDF",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "format", in: "query", schema: { type: "string", enum: ["xlsx", "pdf"], default: "xlsx" } }
        ],
        responses: {
          "200": { description: "Binary file download" }
        }
      }
    },
    "/admin/members/{id}/documents/{docId}": {
      get: {
        tags: ["Members"],
        summary: "Securely stream private Fayda ID or credential document",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "docId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Binary stream with Content-Type header" },
          "404": { description: "Document not found" }
        }
      }
    },
    "/admin/registrations/pending-count": {
      get: {
        tags: ["Members"],
        summary: "Get total unreviewed registrations count for badge notification",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Pending count" }
        }
      }
    },
    "/admin/dashboard/summary": {
      get: {
        tags: ["Dashboard"],
        summary: "Get admin overview KPI counts",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "KPI summary statistics" }
        }
      }
    },
    "/admin/dashboard/members-by": {
      get: {
        tags: ["Dashboard"],
        summary: "Get member demographic breakdown by dimension",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "dimension", in: "query", required: true, schema: { type: "string", enum: ["gender", "sector", "field", "occupation", "region", "graduationLevel"] } },
          { name: "lang", in: "query", schema: { type: "string", enum: ["en", "om", "am", "ar", "fr"] } }
        ],
        responses: {
          "200": { description: "Array of [{ key, label, count, percent }]" }
        }
      }
    },
    "/admin/dashboard/contributions": {
      get: {
        tags: ["Dashboard"],
        summary: "Get dynamic contribution time-series and financial analytics",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "range", in: "query", schema: { type: "string", enum: ["3m", "6m", "12m"], default: "12m" } },
          { name: "group", in: "query", schema: { type: "string", enum: ["week", "month", "year"], default: "month" } }
        ],
        responses: {
          "200": { description: "Financial analytics time series" }
        }
      }
    },
    "/admin/payments": {
      get: {
        tags: ["Payments"],
        summary: "List contribution payments with pagination",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Payments list" }
        }
      },
      post: {
        tags: ["Payments"],
        summary: "Record new contribution payment and generate official receipt",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentRecordRequest" } } }
        },
        responses: {
          "201": { description: "Payment recorded" },
          "409": { description: "Duplicate payment for period" }
        }
      }
    },
    "/admin/payments/{id}": {
      get: {
        tags: ["Payments"],
        summary: "Get single payment detail",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Payment record" }
        }
      }
    },
    "/admin/payments/{id}/void": {
      post: {
        tags: ["Payments"],
        summary: "Void an erroneous payment",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { note: { type: "string" } } } } } },
        responses: {
          "200": { description: "Payment voided" }
        }
      }
    },
    "/admin/payments/{id}/receipt": {
      get: {
        tags: ["Payments"],
        summary: "Download or view official branded PDF payment receipt",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "PDF receipt binary" }
        }
      }
    },
    "/admin/payments/unpaid": {
      get: {
        tags: ["Payments"],
        summary: "Identify active members with unpaid dues for a specific period",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["monthly", "yearly"], default: "monthly" } },
          { name: "date", in: "query", schema: { type: "string", format: "date" } }
        ],
        responses: {
          "200": { description: "List of unpaid members" }
        }
      }
    },
    "/admin/contribution-plans": {
      get: {
        tags: ["Payments"],
        summary: "List available contribution plans",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Plans list" }
        }
      }
    },
    "/admin/payments/export": {
      get: {
        tags: ["Payments"],
        summary: "Export payment records to Excel spreadsheet",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "XLSX file download" }
        }
      }
    },
    "/admin/announcements": {
      get: {
        tags: ["Content"],
        summary: "List all announcements for admin management",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Announcements list" }
        }
      },
      post: {
        tags: ["Content"],
        summary: "Create announcement, vacancy, or event",
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          "201": { description: "Announcement created" }
        }
      }
    },
    "/admin/announcements/{id}/publish": {
      patch: {
        tags: ["Content"],
        summary: "Publish an announcement",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Published" }
        }
      }
    },
    "/admin/announcements/{id}/archive": {
      patch: {
        tags: ["Content"],
        summary: "Archive an announcement",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Archived" }
        }
      }
    },
    "/admin/messages": {
      get: {
        tags: ["Content"],
        summary: "List contact inbox submissions",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Messages list" }
        }
      }
    },
    "/admin/messages/{id}": {
      patch: {
        tags: ["Content"],
        summary: "Update contact message status (read, replied, archived)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" } } } } } },
        responses: {
          "200": { description: "Status updated" }
        }
      }
    },
    "/admin/subscribers": {
      get: {
        tags: ["Content"],
        summary: "List newsletter subscribers",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Subscribers list" }
        }
      }
    },
    "/admin/sms/send": {
      post: {
        tags: ["SMS"],
        summary: "Send single SMS to member or phone number",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  memberId: { type: "string" },
                  phone: { type: "string" },
                  message: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "SMS dispatched" }
        }
      }
    },
    "/admin/sms/campaigns": {
      get: {
        tags: ["SMS"],
        summary: "List bulk SMS campaigns and delivery stats",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Campaigns list" }
        }
      },
      post: {
        tags: ["SMS"],
        summary: "Create and dispatch targeted bulk SMS campaign",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SmsCampaignRequest" } } }
        },
        responses: {
          "201": { description: "Campaign created and queued" }
        }
      }
    },
    "/admin/sms/balance": {
      get: {
        tags: ["SMS"],
        summary: "Get AfroMessage balance",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Balance details" }
        }
      }
    },
    "/admin/meta/permissions": {
      get: {
        tags: ["Users"],
        summary: "Single source of truth for permission keys and human labels",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "List of permission items" }
        }
      }
    },
    "/admin/users": {
      get: {
        tags: ["Users"],
        summary: "List administrator accounts (SuperAdmin only)",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Users list" }
        }
      },
      post: {
        tags: ["Users"],
        summary: "Create new administrator with role and permissions",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "email", "password", "fullName", "role"],
                properties: {
                  username: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  fullName: { type: "string" },
                  role: { type: "string", enum: ["SuperAdmin", "RegionalAdmin", "Finance", "Editor"] },
                  permissions: { type: "array", items: { type: "string" } },
                  regionId: { type: "string", nullable: true }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Admin created" }
        }
      }
    },
    "/admin/users/{id}/active": {
      patch: {
        tags: ["Users"],
        summary: "Activate or deactivate administrator account",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["isActive"], properties: { isActive: { type: "boolean" } } } } } },
        responses: {
          "200": { description: "Status updated" }
        }
      }
    },
    "/admin/audit-logs": {
      get: {
        tags: ["Audit"],
        summary: "List audit log entries with pagination",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 25 } }
        ],
        responses: {
          "200": { description: "Audit logs" }
        }
      }
    }
  }
};

// server.ts
var jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is missing or shorter than 32 characters.");
  process.exit(1);
}
var args = process.argv.slice(2);
var cliPort = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) {
    cliPort = parseInt(args[i + 1], 10);
  } else if (args[i].startsWith("--port=")) {
    cliPort = parseInt(args[i].split("=")[1], 10);
  }
}
var envPort = parseInt(process.env.PORT || "", 10);
var PORT = cliPort || (Number.isFinite(envPort) && envPort > 0 ? envPort : 3e3);
var app = (0, import_express5.default)();
var allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:5174,http://localhost:3000").split(",").map((o) => o.trim());
app.use(
  (0, import_cors.default)({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-otp-token"],
    exposedHeaders: ["X-Contract-Version"]
  })
);
app.use(
  (0, import_helmet.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(import_express5.default.json({ limit: "10mb" }));
app.use(import_express5.default.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  "/uploads",
  (0, import_cors.default)(),
  import_express5.default.static(import_path5.default.resolve(UPLOAD_PATH), {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
  })
);
app.get("/", (_req, res) => {
  return res.json({
    success: true,
    name: "OPHEA API",
    version: "1.0.0"
  });
});
var healthHandler = async (_req, res) => {
  const startedAt = Date.now();
  let dbOk = false;
  try {
    await query("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const status = dbOk ? "healthy" : "degraded";
  const payload = {
    status,
    uptimeSeconds: Math.floor(process.uptime()),
    db: dbOk ? "ok" : "unreachable",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    latencyMs: Date.now() - startedAt
  };
  return res.status(dbOk ? 200 : 503).json({ success: dbOk, status, data: payload });
};
app.get("/health", healthHandler);
app.get("/api-docs/openapi.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  return res.json(openApiSpec);
});
app.use(
  "/api-docs",
  import_swagger_ui_express.default.serve,
  import_swagger_ui_express.default.setup(openApiSpec, {
    customSiteTitle: "OPHEA REST API Documentation & Explorer",
    customCss: ".swagger-ui .topbar { background-color: #166534; }",
    swaggerOptions: {
      defaultModelExpandDepth: 3,
      docExpansion: "list",
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
      displayRequestDuration: true
    }
  })
);
app.use("/api", healthRouter);
app.use("/api", contractRouter);
app.use("/api/public", publicRouter);
app.use("/api", apiRouter);
if (process.env.FEATURE_SMS === "true") {
  smsCampaignService.startSmsScheduler();
}
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint '${req.originalUrl}' not found on OPHEA API`
  });
});
app.use((err, req, res, next) => {
  console.error("[Global Error]", err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});
async function startServer() {
  try {
    await initDatabase();
    const serverInstance = app.listen(PORT, "0.0.0.0", () => {
      console.log(`================================================================`);
      console.log(`  OPHEA Headless Backend API running on http://0.0.0.0:${PORT}`);
      console.log(`  Swagger UI:    http://localhost:${PORT}/api-docs`);
      console.log(`  OpenAPI JSON:  http://localhost:${PORT}/api-docs/openapi.json`);
      console.log(`  Health Check:  http://localhost:${PORT}/health`);
      console.log(`================================================================`);
    });
    serverInstance.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[Server] Port ${PORT} is already in use. Stop the other process or set PORT.`);
        process.exit(1);
      } else {
        console.error("[Server] Unexpected listen error:", err);
      }
    });
  } catch (err) {
    console.error("Fatal initialization error:", err);
    process.exit(1);
  }
}
startServer();
var server_default = app;
