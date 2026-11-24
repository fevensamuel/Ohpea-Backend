import { query } from '../../backend/database.js';
import { readSetting } from '../../backend/adminContentRoutes.js';

export async function getPublicSiteSettings() {
  const [branding, contact, socials] = await Promise.all([readSetting('branding'), readSetting('contact'), readSetting('socials')]);
  const i18n = (en: string, om = '') => ({ en, om, am: '' });
  const socialLinks = Array.isArray(socials) ? socials.filter((item: any) => item.enabled && /^https?:\/\//i.test(item.url || '')).sort((a: any,b: any) => a.sortOrder - b.sortOrder) : Object.entries(socials).filter(([, v]) => typeof v === 'string' && v.trim() !== '').map(([platform,url]) => ({ id: platform, platform, label: platform, url, enabled: true }));
  const socialMap = Object.fromEntries(socialLinks.map((item: any) => [item.platform, item.url]));
  const phones = [contact.phonePrimary, contact.phoneSecondary, branding.supportPhone].filter((p: string, i: number, a: string[]) => p && a.indexOf(p) === i);
  const emails = [contact.emailGeneral, contact.emailSupport, branding.supportEmail].filter((e: string, i: number, a: string[]) => e && a.indexOf(e) === i);
  const coords = String(contact.mapCoordinates || '').trim();
  const mapLink = /^https?:\/\//i.test(coords) ? coords : coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';

  return {
    orgName: i18n(branding.orgName, branding.orgNameOm),
    shortName: 'OPHEA',
    tagline: i18n(branding.tagline),
    mission: i18n(branding.mission),
    vision: i18n(branding.vision),
    logoUrl: '',
    contactPhones: phones,
    contactEmails: emails,
    address: i18n(contact.address),
    mapLink,
    workingHours: contact.workingHours,
    socialLinks,
    socials: socialLinks,
    social: socialMap,
    // convenience aliases (empty when not configured; nothing is invented)
    name: branding.orgName,
    email: emails[0] || '',
    phone: phones[0] || '',
    hotlines: phones,
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
