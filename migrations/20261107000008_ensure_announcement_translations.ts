import type { Pool } from 'pg';

export async function up(pool: Pool | any): Promise<void> {
  const columns = [
    'title_en TEXT',
    'title_om TEXT',
    'title_am TEXT',
    'summary_en TEXT',
    'summary_om TEXT',
    'summary_am TEXT',
    'body_en TEXT',
    'body_om TEXT',
    'body_am TEXT',
  ];

  for (const col of columns) {
    try {
      await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS ${col};`);
    } catch {
      // Ignore
    }
  }

  // Populate from JSON base columns if present
  const res = await pool.query(`SELECT id, title, summary, body FROM announcements`);
  for (const row of res.rows) {
    const t = typeof row.title === 'object' && row.title !== null ? row.title : {};
    const s = typeof row.summary === 'object' && row.summary !== null ? row.summary : {};
    const b = typeof row.body === 'object' && row.body !== null ? row.body : {};

    const tEn = t.en || (typeof row.title === 'string' ? row.title : '');
    const tOm = t.om || tEn;
    const tAm = t.am || tEn;

    const sEn = s.en || (typeof row.summary === 'string' ? row.summary : '');
    const sOm = s.om || sEn;
    const sAm = s.am || sEn;

    const bEn = b.en || (typeof row.body === 'string' ? row.body : '');
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

export async function down(pool: Pool | any): Promise<void> {
  const cols = [
    'title_en', 'title_om', 'title_am',
    'summary_en', 'summary_om', 'summary_am',
    'body_en', 'body_om', 'body_am'
  ];
  for (const c of cols) {
    try {
      await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS ${c};`);
    } catch {
      // Ignore
    }
  }
}
