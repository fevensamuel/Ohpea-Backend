/**
 * OHPEA API Smoke Test Script
 * Tests Health, Login, Public Lookups/Stats, Registration, Admin Member Management, and Swagger.
 */

import 'dotenv/config';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runSmokeTests() {
  console.log(`[SmokeTest] Starting OHPEA API smoke tests against ${BASE_URL}...\n`);
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`  Testing: ${name.padEnd(45)} ... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err: any) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  let authToken = '';

  await test('GET /health (Health Check)', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (!json.success || json.status !== 'healthy') throw new Error('Unhealthy status returned');
  });

  await test('GET /api-docs/openapi.json (OpenAPI Spec)', async () => {
    const res = await fetch(`${BASE_URL}/api-docs/openapi.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (!json.openapi || !json.info) throw new Error('Invalid OpenAPI JSON structure');
  });

  await test('GET /api/public/lookups (Zones, Sectors)', async () => {
    const res = await fetch(`${BASE_URL}/api/public/lookups?lang=en`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (!json.data.regions || json.data.regions.length === 0) throw new Error('No regions found');
    if (!json.data.sectors || json.data.sectors.length === 0) throw new Error('No sectors found');
  });

  await test('GET /api/public/stats (Safe Aggregates)', async () => {
    const res = await fetch(`${BASE_URL}/api/public/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (typeof (json.data.totalMembers ?? json.data.approvedTotal) !== 'number') {
      throw new Error('Missing totalMembers / approvedTotal');
    }
  });

  await test('POST /api/auth/login (Admin Login)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernameOrEmail: process.env.SEED_ADMIN_EMAIL || 'admin@ohpea.org',
        password: process.env.SEED_ADMIN_PASSWORD || 'Admin12345!ChangeMe',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (!json.data?.token) throw new Error('Missing JWT token');
    authToken = json.data.token;
  });

  await test('GET /api/auth/me (Current Admin Context)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (json.data.role !== 'SuperAdmin') throw new Error('Expected SuperAdmin role');
  });

  await test('POST /api/public/registrations (New Member)', async () => {
    const rand = Math.floor(Math.random() * 899999) + 100000;
    const formData = new FormData();
    formData.append('fullName', 'Smoke Tester User');
    formData.append('phone', `+2519${rand}01`);
    formData.append('email', `smoketest.${rand}@example.com`);
    formData.append('idType', 'fayda');
    formData.append('idNumber', `FAYDA-${rand}`);
    formData.append('zone', 'East Shewa');
    formData.append('idDocument', new Blob(['test dummy content'], { type: 'application/pdf' }), 'fayda.pdf');

    const res = await fetch(`${BASE_URL}/api/public/registrations`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = (await res.json()) as any;
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(err)}`);
    }
    const json = (await res.json()) as any;
    if (!json.data.registrationId && !json.data.memberNo) throw new Error('Missing generated registrationId');
  });

  await test('GET /api/admin/members (List & Search)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/members?pageSize=10`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (!Array.isArray(json.data) || json.data.length === 0) throw new Error('No members returned in list');
  });

  await test('GET /api/admin/dashboard/summary (KPI Aggregates)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/dashboard/summary`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (typeof json.data.totalMembers !== 'number') throw new Error('Invalid summary structure');
  });

  await test('GET /api/admin/dashboard/contributions (Time Series)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/dashboard/contributions?range=6m`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (!Array.isArray(json.data.timeSeries)) throw new Error('Missing timeSeries');
  });

  console.log(`\n================================================================`);
  console.log(`  Smoke Test Results: ${passed} passed, ${failed} failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error('[SmokeTest] Fatal Error:', err);
  process.exit(1);
});
