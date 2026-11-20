export function maskPersonalInfo(text: string, enabled: boolean): string {
  if (!enabled || !text) return text;

  return text
    // Mask email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email-redacted]')
    // Mask phone numbers (Indian & international patterns)
    .replace(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s.-]?\d{3,5}[\s.-]?\d{4}/g, '[phone-redacted]')
    // Mask @handles
    .replace(/@[a-zA-Z0-9._]{2,30}/g, '@[user-masked]');
}
