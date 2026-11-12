/**
 * Clear Demo Data Script (npm run seed:clear-demo)
 */

import 'dotenv/config';
import { initDatabase, clearDemoData } from '../src/backend/database.js';

async function main() {
  process.env.SEED_DEMO_DATA = 'false';
  await initDatabase();
  console.log('[Script] Clearing demo payments, members, announcements, and activities...');
  const result = await clearDemoData();
  console.log(
    `[Script] Removed ${result.paymentsDeleted} demo payments, ${result.membersDeleted} demo members, ` +
      `${result.announcementsDeleted} demo announcements, and ${result.activitiesDeleted} demo activities.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[Script] Clear demo error:', err);
  process.exit(1);
});
