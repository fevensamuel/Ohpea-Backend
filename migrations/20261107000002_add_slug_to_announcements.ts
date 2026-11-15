import type { Pool } from 'pg';

export async function up(pool: Pool | any): Promise<void> {
  await pool.query(`
    ALTER TABLE announcements ADD COLUMN IF NOT EXISTS slug TEXT;
  `);

  const res = await pool.query(`SELECT id, title, slug FROM announcements`);
  for (const row of res.rows) {
    if (!row.slug) {
      let rawTitle = '';
      if (typeof row.title === 'object' && row.title !== null) {
        rawTitle = row.title.en || row.title.om || Object.values(row.title)[0] || 'announcement';
      } else {
        rawTitle = String(row.title || 'announcement');
      }
      let baseSlug = rawTitle
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'announcement';

      let candidate = baseSlug;
      let counter = 2;
      while (true) {
        const check = await pool.query('SELECT id FROM announcements WHERE slug = $1 AND id != $2', [candidate, row.id]);
        if (check.rows.length === 0) break;
        candidate = `${baseSlug}-${counter}`;
        counter++;
      }
      await pool.query('UPDATE announcements SET slug = $1 WHERE id = $2', [candidate, row.id]);
    }
  }

  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_slug ON announcements(slug);`);
  } catch {
    // Ignore if index already exists
  }
}

export async function down(pool: Pool | any): Promise<void> {
  try {
    await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS slug;`);
  } catch {
    // Ignore in down
  }
}
