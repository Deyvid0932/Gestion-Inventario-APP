/** Normaliza texto para búsqueda: sin tildes, minúsculas y espacios colapsados. */
export const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Evalúa si el texto de búsqueda coincide con alguno o la combinación de los campos dados,
 * tolerando mayúsculas/minúsculas, tildes, espacios múltiples y búsqueda compacta sin espacios.
 */
export const matchesNormalizedSearch = (
  fields: Array<string | null | undefined>,
  query: string
): boolean => {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const tokens = q.split(' ').filter(Boolean);
  const compactQ = q.replace(/\s+/g, '');
  const combined = normalizeSearchText(fields.filter(Boolean).join(' '));
  if (!combined) return false;

  if (tokens.every(token => combined.includes(token))) return true;
  return combined.replace(/\s+/g, '').includes(compactQ);
};
