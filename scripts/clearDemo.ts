/**
 * Clear Demo Data Script (npm run seed:clear-demo)
 */

import 'dotenv/config';
import { initDatabase, clearDemoData } from '../src/backend/database.js';

async function main() {
  await initDatabase();
  console.log('[Script] Clearing demo members and payments...');
  const result = await clearDemoData();
  console.log(`[Script] Successfully removed ${result.membersDeleted} demo members and ${result.paymentsDeleted} demo payments.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[Script] Clear demo error:', err);
  process.exit(1);
});
