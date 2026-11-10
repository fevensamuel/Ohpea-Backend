import type { Pool } from 'pg';

export async function up(pool: Pool | any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS woredas (
      id TEXT PRIMARY KEY,
      region_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_woredas_region ON woredas(region_id);
  `);

  // Seed default woredas if empty
  const countRes = await pool.query(`SELECT COUNT(*) as count FROM woredas`);
  if (parseInt(countRes.rows[0].count, 10) === 0) {
    const sampleWoredas = [
      { id: 'wor-adama', regionId: 'reg-east-shewa', name: 'Adama' },
      { id: 'wor-bishoftu', regionId: 'reg-east-shewa', name: 'Bishoftu' },
      { id: 'wor-shashemene', regionId: 'reg-west-arsi', name: 'Shashemene' },
      { id: 'wor-arssi-negele', regionId: 'reg-west-arsi', name: 'Arsi Negele' },
      { id: 'wor-jimma-town', regionId: 'reg-jimma-zone', name: 'Jimma Town' },
      { id: 'wor-agaro', regionId: 'reg-jimma-zone', name: 'Agaro' },
      { id: 'wor-ambo', regionId: 'reg-west-shewa', name: 'Ambo' },
      { id: 'wor-waliso', regionId: 'reg-sw-shewa', name: 'Waliso' },
      { id: 'wor-asella', regionId: 'reg-arsi-zone', name: 'Asella' },
      { id: 'wor-bale-robe', regionId: 'reg-bale-zone', name: 'Robe' },
      { id: 'wor-faydha', regionId: 'reg-finfinne-special', name: 'Burayu' },
      { id: 'wor-dukem', regionId: 'reg-finfinne-special', name: 'Dukem' },
    ];

    for (const w of sampleWoredas) {
      await pool.query(
        `INSERT INTO woredas (id, region_id, name) VALUES ($1, $2, $3)`,
        [w.id, w.regionId, w.name]
      );
    }
  }
}

export async function down(pool: Pool | any): Promise<void> {
  try {
    await pool.query(`DROP TABLE IF EXISTS woredas;`);
  } catch {
    // Ignore
  }
}
