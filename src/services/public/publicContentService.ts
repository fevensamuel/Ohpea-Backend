import { query } from '../../backend/database.js';

export async function getPublicSiteSettings() {
  const result = await query('SELECT key, value FROM site_settings');
  const rawSettings: Record<string, any> = {};
  for (const row of result.rows) {
    rawSettings[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  }

  const contact = rawSettings['contact'] || {};
  const social = rawSettings['social'] || rawSettings['socials'] || null;
  const address = rawSettings['address'] || contact.address || null;
  const coordinates = rawSettings['coordinates'] || { lat: 8.54, lng: 39.27 };
  const hotlines = rawSettings['hotlines'] || contact.phones || [];
  const branding = rawSettings['branding'] || rawSettings['general'] || {};

  return {
    name: branding.name || branding.orgName || 'Oromia Hospitality & Tourism Professionals Association',
    tagline: branding.tagline || 'Advancing Professionalism & Sustainable Tourism in Oromia',
    email: contact.email || (Array.isArray(contact.emails) ? contact.emails[0] : null),
    phone: contact.phone || (Array.isArray(contact.phones) ? contact.phones[0] : null),
    address: typeof address === 'string' ? address : address?.formatted || null,
    coordinates,
    social: social
      ? {
          facebook: social.facebook || null,
          twitter: social.twitter || null,
          linkedin: social.linkedin || null,
          youtube: social.youtube || null,
        }
      : null,
    hotlines: Array.isArray(hotlines) ? hotlines : [hotlines],
  };
}

export async function getPublicStatsNumbers() {
  const memRes = await query(
    `SELECT COUNT(*) as count FROM members WHERE membership_status = 'active'`
  );
  const totalMembers = parseInt(memRes.rows[0]?.count || '0', 10);

  const setRes = await query(
    `SELECT key, value FROM site_settings WHERE key IN ('stats.accreditedHotels', 'stats.certifiedGuides', 'stats.trainingGraduates')`
  );
  const statsMap: Record<string, number> = {};
  for (const row of setRes.rows) {
    const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    statsMap[row.key] = Number(val) || 0;
  }

  return {
    totalMembers,
    accreditedHotels: statsMap['stats.accreditedHotels'] ?? 87,
    certifiedGuides: statsMap['stats.certifiedGuides'] ?? 143,
    trainingGraduates: statsMap['stats.trainingGraduates'] ?? 320,
  };
}

export async function getPublicRegionsWithWoredas() {
  const regRes = await query(`SELECT id, name FROM regions WHERE is_active = true ORDER BY sort_order ASC`);
  const worRes = await query(`SELECT id, region_id, name FROM woredas ORDER BY name ASC`);

  const woredasByRegion: Record<string, any[]> = {};
  for (const w of worRes.rows) {
    if (!woredasByRegion[w.region_id]) {
      woredasByRegion[w.region_id] = [];
    }
    woredasByRegion[w.region_id].push({
      id: w.id,
      name: w.name,
    });
  }

  return regRes.rows.map((r: any) => {
    let regName = '';
    if (typeof r.name === 'object' && r.name !== null) {
      regName = r.name.en || Object.values(r.name)[0] || '';
    } else {
      regName = String(r.name || '');
    }
    return {
      id: r.id,
      name: regName,
      woredas: woredasByRegion[r.id] || [],
    };
  });
}

export async function submitPublicContact(data: {
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}) {
  const id = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await query(
    `INSERT INTO contact_messages (id, name, full_name, email, phone, subject, message, status, source, created_at)
     VALUES ($1, $2, $2, $3, $4, $5, $6, 'new', 'public_website', NOW())`,
    [id, data.fullName.trim(), data.email.trim(), data.phone.trim(), data.subject.trim(), data.message.trim()]
  );
  return { id };
}

export async function subscribePublicNewsletter(data: {
  email: string;
  name?: string | null;
  language?: string | null;
}) {
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.name ? String(data.name).trim() : null;
  const cleanLang = data.language ? String(data.language).trim().toLowerCase() : null;

  const existing = await query(`SELECT id FROM newsletter_subscribers WHERE email = $1`, [cleanEmail]);
  if (existing.rows.length === 0) {
    const id = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await query(
      `INSERT INTO newsletter_subscribers (id, name, email, language, is_active, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [id, cleanName, cleanEmail, cleanLang]
    );
  }
}
