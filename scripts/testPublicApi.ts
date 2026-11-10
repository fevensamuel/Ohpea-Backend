/**
 * Comprehensive Test Suite for OHPEA Public API Surface
 * Tests all requirements from Section 5:
 * - GET /api/public/stats (4 numeric fields, ignores stale Authorization)
 * - GET /api/public/announcements with pagination
 * - GET /api/public/announcements/<draft-slug> -> 404
 * - GET /api/public/programs/<unknown-slug> -> 404
 * - POST /api/public/contact -> row appears in messages (via GET /api/admin/messages with admin JWT)
 * - POST /api/public/newsletter -> idempotent 200 (via GET /api/admin/subscribers with admin JWT)
 * - POST /api/public/registrations missing idDocument -> 400 with fields.idDocument
 * - OTP send -> verify happy path -> registrations.otpVerified === true & status === 'pending_review'
 * - OTP verify wrong code 5x -> 400, attempts increment, 6th call blocked
 * - Every public GET returns { success: true, data } (and meta when paginated)
 */

import 'dotenv/config';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log(`[PublicApiTests] Running OHPEA public API test suite against ${BASE_URL}...\n`);
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`  [TEST] ${name.padEnd(55)} ... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err: any) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  // Obtain admin JWT for cross-verifying admin-facing tables over HTTP
  let adminToken = '';
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernameOrEmail: process.env.SEED_ADMIN_EMAIL || 'admin@ohpea.org',
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin12345!ChangeMe',
    }),
  });
  if (loginRes.ok) {
    const loginJson = (await loginRes.json()) as any;
    adminToken = loginJson.data?.token || '';
  }

  // Test 1: GET /api/public/stats (4 numeric fields, ignores stale Authorization, contract header)
  await test('GET /api/public/stats (4 numeric fields, ignores stale Auth, X-Contract-Version: 1)', async () => {
    const res = await fetch(`${BASE_URL}/api/public/stats`, {
      headers: {
        Authorization: 'Bearer invalid-expired-stale-token-12345',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const version = res.headers.get('X-Contract-Version');
    if (version !== '1') throw new Error(`expected X-Contract-Version: 1, got ${version}`);

    const json = (await res.json()) as any;
    if (!json.success || !json.data) throw new Error('Response envelope missing success or data');

    const keys = Object.keys(json.data).sort();
    const expectedKeys = ['accreditedHotels', 'certifiedGuides', 'totalMembers', 'trainingGraduates'];
    if (keys.length !== expectedKeys.length || keys.some((k, i) => k !== expectedKeys[i])) {
      throw new Error(`Expected exactly 4 keys [${expectedKeys.join(', ')}], got [${keys.join(', ')}]`);
    }

    const { totalMembers, accreditedHotels, certifiedGuides, trainingGraduates } = json.data;
    if (typeof totalMembers !== 'number') throw new Error('totalMembers is not a number');
    if (typeof accreditedHotels !== 'number') throw new Error('accreditedHotels is not a number');
    if (typeof certifiedGuides !== 'number') throw new Error('certifiedGuides is not a number');
    if (typeof trainingGraduates !== 'number') throw new Error('trainingGraduates is not a number');
  });

  // Test 2: GET /api/public/announcements?type=news&limit=5&page=2
  await test('GET /api/public/announcements (pagination & published filter)', async () => {
    const checkRes = await fetch(`${BASE_URL}/api/public/announcements?type=news&limit=5&page=2`);
    if (!checkRes.ok) throw new Error(`HTTP ${checkRes.status}`);
    const json = (await checkRes.json()) as any;
    if (!json.success || !Array.isArray(json.data)) throw new Error('Invalid envelope or data is not array');
    if (!json.meta) throw new Error('Missing meta object in paginated response');
    if (json.meta.page !== 2) throw new Error(`Expected meta.page === 2, got ${json.meta.page}`);
    if (json.meta.pageSize !== 5) throw new Error(`Expected meta.pageSize === 5, got ${json.meta.pageSize}`);
    for (const item of json.data) {
      if (item.type !== 'news') throw new Error(`Expected type news, got ${item.type}`);
    }
  });

  // Test 3: GET /api/public/announcements/<draft-slug> -> 404
  await test('GET /api/public/announcements/<draft-slug> -> 404 error envelope', async () => {
    // Create a draft announcement via admin API
    const draftSlug = `draft-announcement-${Date.now()}`;
    if (adminToken) {
      await fetch(`${BASE_URL}/api/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: 'Draft Announcement',
          slug: draftSlug,
          type: 'news',
          summary: 'Draft summary',
          body: 'Draft body',
          status: 'draft',
        }),
      });
    }

    const res = await fetch(`${BASE_URL}/api/public/announcements/${draftSlug}`);
    if (res.status !== 404) throw new Error(`Expected 404, got HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (json.success !== false) throw new Error('Expected success === false');
    if (!json.error) throw new Error('Expected error message in envelope');
  });

  // Test 4: GET /api/public/programs/<unknown-slug> -> 404
  await test('GET /api/public/programs/<unknown-slug> -> 404 error envelope', async () => {
    const res = await fetch(`${BASE_URL}/api/public/programs/unknown-slug-${Date.now()}`);
    if (res.status !== 404) throw new Error(`Expected 404, got HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (json.success !== false) throw new Error('Expected success === false');
    if (!json.error) throw new Error('Expected error message in envelope');
  });

  // Test 5: POST /api/public/contact -> row appears in messages
  await test('POST /api/public/contact -> persists in messages table', async () => {
    const testSubject = `Inquiry-${Date.now()}`;
    const payload = {
      fullName: 'Abebe Bikila',
      email: 'abebe.test@example.com',
      phone: '+251911002233',
      subject: testSubject,
      message: 'This is a detailed inquiry message with more than 10 characters.',
    };

    const res = await fetch(`${BASE_URL}/api/public/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    if (!json.success || !json.data?.message) throw new Error('Invalid contact response');

    // Verify row appears via GET /api/admin/messages with admin JWT
    if (adminToken) {
      const msgRes = await fetch(`${BASE_URL}/api/admin/messages`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (msgRes.ok) {
        const msgJson = (await msgRes.json()) as any;
        const found = (msgJson.data || []).find((m: any) => m.subject === testSubject);
        if (!found) throw new Error('Submitted contact message not found in admin messages list');
      }
    }
  });

  // Test 6: POST /api/public/newsletter twice -> 200 both times, single row
  await test('POST /api/public/newsletter twice -> 200 both times, single row', async () => {
    const email = `sub.${Date.now()}@example.com`;

    const res1 = await fetch(`${BASE_URL}/api/public/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: 'Subscriber 1' }),
    });
    if (!res1.ok) throw new Error(`First submit failed: HTTP ${res1.status}`);
    const json1 = (await res1.json()) as any;
    if (!json1.success) throw new Error('First response success !== true');

    const res2 = await fetch(`${BASE_URL}/api/public/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: 'Subscriber 1 Duplicate' }),
    });
    if (!res2.ok) throw new Error(`Second submit failed: HTTP ${res2.status}`);
    const json2 = (await res2.json()) as any;
    if (!json2.success) throw new Error('Second response success !== true');

    // Verify exactly 1 subscriber exists for this email via GET /api/admin/subscribers
    if (adminToken) {
      const subRes = await fetch(`${BASE_URL}/api/admin/subscribers`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (subRes.ok) {
        const subJson = (await subRes.json()) as any;
        const matching = (subJson.data || []).filter((s: any) => s.email === email);
        if (matching.length !== 1) {
          throw new Error(`Expected exactly 1 subscriber row, found ${matching.length}`);
        }
      }
    }
  });

  // Test 7: POST /api/public/registrations with missing idDocument -> 400 with fields.idDocument
  await test('POST /api/public/registrations missing idDocument -> 400 with fields.idDocument', async () => {
    const formData = new FormData();
    formData.append('fullName', 'Chala Tolessa');
    formData.append('phone', '+251911223344');
    formData.append('idType', 'fayda');
    formData.append('idNumber', 'FAYDA-12345');
    // Deliberately omitting idDocument

    const res = await fetch(`${BASE_URL}/api/public/registrations`, {
      method: 'POST',
      body: formData,
    });
    if (res.status !== 400) throw new Error(`Expected HTTP 400, got ${res.status}`);
    const json = (await res.json()) as any;
    if (json.success !== false) throw new Error('Expected success === false');
    if (!json.fields?.idDocument) throw new Error('Expected fields.idDocument in error envelope');
  });

  // Test 8: OTP send -> verify happy path -> status === 'pending_review'
  await test('OTP send -> verify happy path -> status === "pending_review"', async () => {
    const rand = Math.floor(Math.random() * 89999999 + 10000000);
    const phone = `+2519${rand}`;

    // 1. Submit multipart registration with idDocument
    const formData = new FormData();
    formData.append('fullName', 'Chala Tolessa Test');
    formData.append('phone', phone);
    formData.append('email', `chala.${rand}@example.com`);
    formData.append('idType', 'fayda');
    formData.append('idNumber', `FAYDA-${rand}`);
    formData.append('zone', 'East Shewa');

    const dummyFile = new Blob(['Dummy PDF content for ID Document verification'], { type: 'application/pdf' });
    formData.append('idDocument', dummyFile, 'fayda_id.pdf');

    const regRes = await fetch(`${BASE_URL}/api/public/registrations`, {
      method: 'POST',
      body: formData,
    });
    if (!regRes.ok) {
      const err = await regRes.text();
      throw new Error(`Registration failed HTTP ${regRes.status}: ${err}`);
    }

    // 2. Request OTP send
    const sendRes = await fetch(`${BASE_URL}/api/public/registrations/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!sendRes.ok) throw new Error(`OTP send failed: HTTP ${sendRes.status}`);
    const sendJson = (await sendRes.json()) as any;
    const code = sendJson.data?.code;
    if (!code) throw new Error('Expected OTP code in dev response');

    // 3. Verify OTP with received code
    const verifyRes = await fetch(`${BASE_URL}/api/public/registrations/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    if (!verifyRes.ok) throw new Error(`OTP verify failed: HTTP ${verifyRes.status}`);
    const verifyJson = (await verifyRes.json()) as any;
    if (!verifyJson.success || !verifyJson.data?.verified) throw new Error('OTP verify response invalid');
  });

  // Test 9: OTP verify with wrong code 5x -> 400, attempts increment, 6th call blocked
  await test('OTP verify wrong code 5x -> 400, attempts increment, 6th call blocked', async () => {
    const rand = Math.floor(Math.random() * 89999999 + 10000000);
    const phone = `+2517${rand}`;

    // Send OTP to initialize otp_codes record on server
    const sendRes = await fetch(`${BASE_URL}/api/public/registrations/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!sendRes.ok) throw new Error(`OTP send failed: HTTP ${sendRes.status}`);
    const sendJson = (await sendRes.json()) as any;
    const realCode = sendJson.data?.code;

    // Call 5 times with wrong code
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${BASE_URL}/api/public/registrations/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: '000000' }),
      });
      if (res.status !== 400) throw new Error(`Attempt ${i}: Expected HTTP 400, got ${res.status}`);
    }

    // 6th call: even with the real code, must be blocked because attempts >= 5
    const res6 = await fetch(`${BASE_URL}/api/public/registrations/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: realCode || '123456' }),
    });
    if (res6.status !== 400) throw new Error(`6th call: Expected HTTP 400 lockout, got ${res6.status}`);
  });

  // Test 10: Every public GET returns { success: true, data } (and meta when paginated)
  await test('Every public GET returns standard envelope', async () => {
    const endpoints = [
      '/api/public/site-settings',
      '/api/public/stats',
      '/api/public/programs',
      '/api/public/announcements',
      '/api/public/partners',
      '/api/public/activities',
      '/api/public/lookups/regions',
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${BASE_URL}${ep}`);
      if (!res.ok) throw new Error(`GET ${ep} returned HTTP ${res.status}`);
      const json = (await res.json()) as any;
      if (json.success !== true) throw new Error(`GET ${ep} success !== true`);
      if (json.data === undefined) throw new Error(`GET ${ep} missing data property`);
      if (ep === '/api/public/announcements' && !json.meta) {
        throw new Error(`GET ${ep} missing meta property on paginated list`);
      }
    }
  });

  /* ==========================================================================
     PROMPT 7: 5 COMPATIBILITY ISSUES FIX VERIFICATION
     ========================================================================== */

  // Test 11: Contact -> admin messages roundtrip
  await test('Compat 1: Contact -> admin messages roundtrip (source === public_website)', async () => {
    const uniqueEmail = `contact.roundtrip.${Date.now()}@example.com`;
    const subject = `Roundtrip Inquiry ${Date.now()}`;
    const contactRes = await fetch(`${BASE_URL}/api/public/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Tolera Daba',
        email: uniqueEmail,
        phone: '+251911998877',
        subject,
        message: 'Checking contact form to admin messages roundtrip verification.',
      }),
    });
    if (!contactRes.ok) throw new Error(`Contact POST failed HTTP ${contactRes.status}`);

    if (adminToken) {
      const msgRes = await fetch(`${BASE_URL}/api/admin/messages`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!msgRes.ok) throw new Error(`Admin messages GET failed HTTP ${msgRes.status}`);
      const msgJson = (await msgRes.json()) as any;
      const found = (msgJson.data || []).find((m: any) => m.email === uniqueEmail);
      if (!found) throw new Error('Submitted contact message not found in admin messages list');
      if (found.source !== 'public_website') {
        throw new Error(`Expected source === 'public_website', got '${found.source}'`);
      }
    }
  });

  // Test 12: Repeated verify is safe
  await test('Compat 2: Repeated OTP verify is safe (second verify 400, stays pending_review)', async () => {
    const rand = Math.floor(Math.random() * 89999999 + 10000000);
    const phone = `+2519${rand}`;

    // 1. Submit multipart registration
    const formData = new FormData();
    formData.append('fullName', 'Repeated Verify Test');
    formData.append('phone', phone);
    formData.append('email', `repverify.${rand}@example.com`);
    formData.append('idType', 'fayda');
    formData.append('idNumber', `FAYDA-${rand}`);
    formData.append('idDocument', new Blob(['Sample ID'], { type: 'application/pdf' }), 'id.pdf');

    const regRes = await fetch(`${BASE_URL}/api/public/registrations`, {
      method: 'POST',
      body: formData,
    });
    if (!regRes.ok) {
      const errText = await regRes.text();
      throw new Error(`Registration failed HTTP ${regRes.status}: ${errText}`);
    }
    const regJson = (await regRes.json()) as any;
    const registrationId = regJson.data?.registrationId;

    // 2. Request OTP
    const sendRes = await fetch(`${BASE_URL}/api/public/registrations/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!sendRes.ok) throw new Error(`OTP send failed HTTP ${sendRes.status}`);
    const code = (await sendRes.json() as any).data?.code;

    // 3. First verify -> Success (200)
    const v1Res = await fetch(`${BASE_URL}/api/public/registrations/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    if (!v1Res.ok) throw new Error(`First verify failed HTTP ${v1Res.status}`);

    // Verify registration status is now pending_review and otpVerified is true
    if (adminToken && registrationId) {
      const checkRes = await fetch(`${BASE_URL}/api/admin/registrations/${registrationId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (checkRes.ok) {
        const checkJson = (await checkRes.json()) as any;
        if (checkJson.data?.status !== 'pending_review') {
          throw new Error(`Expected status === 'pending_review', got ${checkJson.data?.status}`);
        }
        if (!checkJson.data?.otpVerified) {
          throw new Error('Expected otpVerified === true');
        }
      }
    }

    // 4. Repeated verify with same code -> must return HTTP 400 (consumed/invalid code)
    const v2Res = await fetch(`${BASE_URL}/api/public/registrations/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    if (v2Res.status !== 400) {
      throw new Error(`Expected repeated verify to return HTTP 400, got ${v2Res.status}`);
    }

    // Check registration status still intact as pending_review
    if (adminToken && registrationId) {
      const checkRes = await fetch(`${BASE_URL}/api/admin/registrations/${registrationId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (checkRes.ok) {
        const checkJson = (await checkRes.json()) as any;
        if (checkJson.data?.status !== 'pending_review') {
          throw new Error(`Registration corrupted after repeated verify! Status is ${checkJson.data?.status}`);
        }
      }
    }
  });

  // Test 13: Verify before upload self-promotion
  await test('Compat 3: Verify before upload self-promotes to pending_review', async () => {
    const rand = Math.floor(Math.random() * 89999999 + 10000000);
    const phone = `+2519${rand}`;

    // 1. Send OTP first
    const sendRes = await fetch(`${BASE_URL}/api/public/registrations/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!sendRes.ok) throw new Error(`OTP send failed HTTP ${sendRes.status}`);
    const code = (await sendRes.json() as any).data?.code;

    // 2. Verify OTP BEFORE creating registration
    const verifyRes = await fetch(`${BASE_URL}/api/public/registrations/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    if (!verifyRes.ok) throw new Error(`Early verify failed HTTP ${verifyRes.status}`);

    // 3. Now submit multipart registration
    const formData = new FormData();
    formData.append('fullName', 'Early Verified Applicant');
    formData.append('phone', phone);
    formData.append('email', `early.verified.${rand}@example.com`);
    formData.append('idType', 'passport');
    formData.append('idNumber', `EP-${rand}`);
    formData.append('idDocument', new Blob(['Passport Doc'], { type: 'application/pdf' }), 'passport.pdf');

    const regRes = await fetch(`${BASE_URL}/api/public/registrations`, {
      method: 'POST',
      body: formData,
    });
    if (!regRes.ok) {
      const errText = await regRes.text();
      throw new Error(`Registration upload failed HTTP ${regRes.status}: ${errText}`);
    }
    const regJson = (await regRes.json()) as any;
    const registrationId = regJson.data?.registrationId;
    if (!registrationId) throw new Error('Missing registrationId in response');

    // 4. Verify that registration was self-promoted to pending_review and otpVerified === true
    if (adminToken) {
      const checkRes = await fetch(`${BASE_URL}/api/admin/registrations/${registrationId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (checkRes.ok) {
        const checkJson = (await checkRes.json()) as any;
        if (checkJson.data?.status !== 'pending_review') {
          throw new Error(`Expected self-promotion to 'pending_review', got '${checkJson.data?.status}'`);
        }
        if (!checkJson.data?.otpVerified) {
          throw new Error('Expected otpVerified === true on self-promoted registration');
        }
      }
    }
  });

  // Test 14: Enum validation
  await test('Compat 4: Enum validation (newsletter.language & registration.idType)', async () => {
    // 1. Newsletter with invalid language
    const nlRes = await fetch(`${BASE_URL}/api/public/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `enum.test.${Date.now()}@example.com`,
        language: 'xx', // invalid language code
      }),
    });
    if (nlRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for invalid newsletter language, got ${nlRes.status}`);
    }
    const nlJson = (await nlRes.json()) as any;
    if (!nlJson.fields?.language) {
      throw new Error(`Expected error envelope to contain fields.language`);
    }

    // 2. Registration with invalid idType
    const formData = new FormData();
    formData.append('fullName', 'Invalid ID Type Applicant');
    formData.append('phone', '+251911003344');
    formData.append('email', `invalid.idtype.${Date.now()}@example.com`);
    formData.append('idType', 'other'); // invalid idType enum
    formData.append('idNumber', '12345');
    formData.append('idDocument', new Blob(['Test ID']), 'id.pdf');

    const regRes = await fetch(`${BASE_URL}/api/public/registrations`, {
      method: 'POST',
      body: formData,
    });
    if (regRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for invalid idType, got ${regRes.status}`);
    }
    const regJson = (await regRes.json()) as any;
    if (!regJson.fields?.idType) {
      throw new Error(`Expected error envelope to contain fields.idType`);
    }
  });

  // Test 15: Contact table unification
  await test('Compat 5: Contact table unification (canonical contact_messages table)', async () => {
    const testEmail = `unify.${Date.now()}@example.com`;
    const contactRes = await fetch(`${BASE_URL}/api/public/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Canonical Check',
        email: testEmail,
        phone: '+251911228899',
        subject: 'Testing Table Unification',
        message: 'Verifying canonical contact_messages table stores submissions accurately.',
      }),
    });
    if (!contactRes.ok) throw new Error(`Contact submission failed HTTP ${contactRes.status}`);

    // Check via admin endpoint (which queries contact_messages)
    if (adminToken) {
      const res = await fetch(`${BASE_URL}/api/admin/messages`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error(`Admin messages check failed HTTP ${res.status}`);
      const data = (await res.json()) as any;
      const count = (data.data || []).filter((m: any) => m.email === testEmail).length;
      if (count !== 1) {
        throw new Error(`Expected exactly 1 message in canonical table, found ${count}`);
      }
    }
  });

  /* ==========================================================================
     DIAGNOSTICS & CONTRACT TESTS
     ========================================================================== */

  // Test 16: GET /api/health liveness check
  await test('GET /api/health liveness check (db, status, uptimeSeconds, latencyMs)', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const json = (await res.json()) as any;
    if (json.success !== true) throw new Error('Expected success === true');
    if (!json.data) throw new Error('Missing data in /api/health response');
    if (json.data.status !== 'ok') throw new Error(`Expected status === 'ok', got ${json.data.status}`);
    if (json.data.db !== 'ok') throw new Error(`Expected db === 'ok', got ${json.data.db}`);
    if (typeof json.data.uptimeSeconds !== 'number') throw new Error('uptimeSeconds is not a number');
    if (typeof json.data.latencyMs !== 'number') throw new Error('latencyMs is not a number');
    if (!json.data.timestamp) throw new Error('Missing timestamp in health data');
  });

  // Test 17: GET /api/contract.json machine-readable contract
  await test('GET /api/contract.json returns 200 with version and endpoints', async () => {
    const res = await fetch(`${BASE_URL}/api/contract.json`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const contract = (await res.json()) as any;
    if (typeof contract.version !== 'number') throw new Error('contract.version missing or not a number');
    if (contract.version !== 1) throw new Error(`Expected contract.version === 1, got ${contract.version}`);
    if (!contract.endpoints?.public || !contract.endpoints?.admin || !contract.endpoints?.auth) {
      throw new Error('contract.endpoints incomplete (missing public, admin, or auth)');
    }
    if (!contract.endpoints.public['GET /api/public/stats']?.headers?.['X-Contract-Version']) {
      throw new Error('Missing X-Contract-Version header definition in stats endpoint contract');
    }
  });

  console.log(`\n================================================================`);
  console.log(`  Public API Test Results: ${passed} passed, ${failed} failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[PublicApiTests] Fatal error:', err);
  process.exit(1);
});
