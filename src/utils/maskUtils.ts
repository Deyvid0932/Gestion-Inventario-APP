
export const maskEmail = (email?: string | null): string => {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');

  if (atIndex <= 0) return trimmed;

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  let maskedLocal = '';
  if (localPart.length <= 2) {
    maskedLocal = `${localPart[0]}***`;
  } else {
    maskedLocal = `${localPart.substring(0, 2)}***${localPart.slice(-1)}`;
  }

  return `${maskedLocal}@${domain}`;
};
