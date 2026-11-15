import type { Pool } from 'pg';

export async function up(pool: Pool | any): Promise<void> {
  // Ensure column exists
  await pool.query(`
    ALTER TABLE programs ADD COLUMN IF NOT EXISTS slug TEXT;
  `);

  // Backfill any missing slugs from title
  const res = await pool.query(`SELECT id, title, slug FROM programs`);
  for (const row of res.rows) {
    if (!row.slug) {
      let rawTitle = '';
      if (typeof row.title === 'object' && row.title !== null) {
        rawTitle = row.title.en || row.title.om || Object.values(row.title)[0] || 'program';
      } else {
        rawTitle = String(row.title || 'program');
      }
      let baseSlug = rawTitle
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'program';

      let candidate = baseSlug;
      let counter = 2;
      while (true) {
        const check = await pool.query('SELECT id FROM programs WHERE slug = $1 AND id != $2', [candidate, row.id]);
        if (check.rows.length === 0) break;
        candidate = `${baseSlug}-${counter}`;
        counter++;
      }
      await pool.query('UPDATE programs SET slug = $1 WHERE id = $2', [candidate, row.id]);
    }
  }

  // Ensure unique constraint/index where possible
  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug);`);
  } catch {
    // Ignore if index already exists
  }
}

export async function down(pool: Pool | any): Promise<void> {
  try {
    await pool.query(`ALTER TABLE programs DROP COLUMN IF EXISTS slug;`);
  } catch {
    // Ignore in down
  }
}
