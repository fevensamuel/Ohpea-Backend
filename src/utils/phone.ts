/** Normalise Ethiopian mobile numbers to +2519XXXXXXXX / +2517XXXXXXXX. Returns the cleaned input if unrecognised. */
export function normalizeEthiopianPhone(phone: string): string {
  let clean = String(phone || '').replace(/[^0-9+]/g, '');
  if (clean.startsWith('+')) clean = '+' + clean.slice(1).replace(/\+/g, '');
  if (clean.startsWith('09') || clean.startsWith('07')) clean = '+251' + clean.slice(1);
  else if (/^[79]\d{8}$/.test(clean)) clean = '+251' + clean;
  else if (clean.startsWith('251')) clean = '+' + clean;
  return clean;
}

export const ETHIOPIAN_MOBILE = /^\+251[79]\d{8}$/;

/** Normalize an E.164 phone number, applying Ethiopia's local dialing rules when nationality is Ethiopian. */
export function normalizePhoneForNationality(phone: string, nationality?: string): string {
  const raw = String(phone || '').trim();
  if (/ethiop/i.test(String(nationality || ''))) return normalizeEthiopianPhone(raw);
  let clean = raw.replace(/[\s().-]/g, '');
  if (clean.startsWith('00')) clean = '+' + clean.slice(2);
  if (!clean.startsWith('+')) clean = '+' + clean.replace(/\D/g, '');
  else clean = '+' + clean.slice(1).replace(/\D/g, '');
  return clean;
}

export const INTERNATIONAL_E164 = /^\+[1-9]\d{6,14}$/;
