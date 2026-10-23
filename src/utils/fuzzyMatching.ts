

export const normalizeText = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export const cleanAsterisks = (text: string): string => {
  return (text || '').replace(/\*+/g, '').trim();
};

export const STOP_WORDS = new Set([
  'caja', 'de', 'la', 'el', 'los', 'las', 'en', 'para', 'por', 'con',
  'un', 'una', 'y', 'o', 'del', 'al', 'que', 'hay', 'dime', 'dame',
  'mostrar', 'ver', 'busca', 'buscar', 'detalle'
]);

export const extractKeywords = (str: string): string[] => {
  const norm = normalizeText(str);
  return norm
    .split(/[^a-z0-9]+/i)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w));
};

export const levenshteinDistance = (a: string, b: string): number => {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; ++i) matrix[i] = [i];
  for (let i = 0; i <= an; ++i) matrix[0][i] = i;

  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
};


export const stringSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - dist) / maxLen);
};


export const nGramSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return stringSimilarity(s1, s2);

  const getBigrams = (s: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };

  const g1 = getBigrams(s1);
  const g2 = getBigrams(s2);
  let intersection = 0;
  for (const g of g1) {
    if (g2.has(g)) intersection++;
  }
  const total = g1.size + g2.size - intersection;
  return total > 0 ? intersection / total : 0;
};

export const computeCajaProximityScore = (
  query: string,
  cajaNombre: string
): number => {
  const qNorm = normalizeText(query);
  const cNorm = normalizeText(cajaNombre);
  if (!qNorm || !cNorm) return 0;
  if (qNorm === cNorm) return 100;

  const qNoCaja = normalizeText(query.replace(/caja/gi, ''));
  const cNoCaja = normalizeText(cajaNombre.replace(/caja/gi, ''));

  if (qNoCaja && cNoCaja && qNoCaja === cNoCaja) return 100;

  // 1. Similitud directa de cadena completa
  const simFull = stringSimilarity(qNorm, cNorm);
  const simNoCaja = (qNoCaja && cNoCaja) ? stringSimilarity(qNoCaja, cNoCaja) : 0;

  // 2. Similitud de bigramas
  const simBigram = nGramSimilarity(qNorm, cNorm);
  const simBigramNoCaja = (qNoCaja && cNoCaja) ? nGramSimilarity(qNoCaja, cNoCaja) : 0;

  // 3. Inclusión de subcadena con bonus de cercanía
  let inclusionBonus = 0;
  if (cNorm.includes(qNorm) || qNorm.includes(cNorm)) {
    inclusionBonus = 0.88;
  } else if (qNoCaja && cNoCaja && (cNoCaja.includes(qNoCaja) || qNoCaja.includes(cNoCaja))) {
    inclusionBonus = 0.84;
  }

  // 4. Cercanía por palabras clave (tolerando errores tipográficos en cada palabra)
  const qKeywords = extractKeywords(query);
  const cKeywords = extractKeywords(cajaNombre);
  let kwScore = 0;

  if (qKeywords.length > 0 && cKeywords.length > 0) {
    let matchedScoreSum = 0;
    for (const qk of qKeywords) {
      let bestKwSim = 0;
      for (const ck of cKeywords) {
        const sim = stringSimilarity(qk, ck);
        if (sim > bestKwSim) bestKwSim = sim;
      }
      matchedScoreSum += bestKwSim;
    }
    kwScore = matchedScoreSum / qKeywords.length;
  }

  const maxProximity = Math.max(simFull, simNoCaja, simBigram, simBigramNoCaja, inclusionBonus, kwScore);
  return Math.round(maxProximity * 100);
};
