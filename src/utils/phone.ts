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
