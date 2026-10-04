// Contact helpers shared by the committee page and the privacy notice.

/** Where visitors send corrections, removal requests and questions about published data. */
export const CONTACT_EMAIL = 'chhath@shaharpura.com';

/**
 * wa.me link for a mobile number as stored in the sheet ("7282032146", "+91 72820 32146",
 * "07282032146"). A bare 10-digit Indian number gets the 91 country code; anything that cannot
 * be a real number returns '' so the caller can hide the button instead of linking nowhere.
 */
export function whatsappUrl(mobile: unknown): string {
  const digits = String(mobile ?? '').replace(/\D/g, '').replace(/^0+/, '');
  let full = '';
  if (digits.length === 10) full = '91' + digits;
  else if (digits.length >= 11 && digits.length <= 15) full = digits;
  return full ? `https://wa.me/${full}` : '';
}

/** tel: href with only dialable characters, or '' if there is no number. */
export function telHref(mobile: unknown): string {
  const n = String(mobile ?? '').replace(/[^\d+]/g, '');
  return n ? `tel:${n}` : '';
}
