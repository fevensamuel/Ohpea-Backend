/**
 * Seed Demo Data Script (npm run seed:demo)
 */

import 'dotenv/config';
import { getPool, initDatabase, seedDemoData } from '../src/backend/database.js';

async function main() {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    throw new Error('Set SEED_DEMO_DATA=true to enable demo data seeding.');
  }

  await initDatabase();
  console.log('[Script] Triggering manual demo data seed...');
  const pool = await getPool();
  await seedDemoData(pool);
  console.log('[Script] Seed demo data completed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Script] Seed error:', err);
  process.exit(1);
});
