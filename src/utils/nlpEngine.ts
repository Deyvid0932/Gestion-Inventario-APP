export const normalizeText = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const extractSearchTerms = (text: string): string[] => {
  const normalized = normalizeText(text);
  const stopWords = [
    'donde', 'esta', 'la', 'el', 'los', 'las', 'un', 'una', 'busca', 'encuentra', 'en', 'de', 'para', 'por', 'con',
    'op', 'color', 'estilo', 'lote', 'lotes', 'caja', 'cajas', 'prenda', 'prendas'
  ];

  return normalized
    .split(' ')
    .filter(word => !stopWords.includes(word) && word.length >= 1);
};

export const levenshteinDistance = (a: string, b: string): number => {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

export interface SearchResult {
  id: string;
  op: string;
  style: string;
  color: string;
  status: number;
  photo_uri?: string | null;
  box_id: string;
  box_name: string;
  inventory_name: string;
  inventory_id: string;
  alarm_datetime?: string | null;
  score?: number;
}

export const rankResults = (results: SearchResult[], searchTerms: string[], originalQuery?: string): SearchResult[] => {
  const queryNorm = originalQuery ? normalizeText(originalQuery) : '';

  const hasOpKeyword = /\bop\b/.test(queryNorm);
  const hasCajaKeyword = /\bcaja\b/.test(queryNorm);
  const hasLoteKeyword = /\blote\b/.test(queryNorm);
  const hasColorKeyword = /\bcolor\b/.test(queryNorm);
  const hasEstiloKeyword = /\bestilo\b/.test(queryNorm);

  const ranked = results.map(item => {
    let matchScore = 0;
    let levenshteinPenalty = 0;

    const opNorm = item.op ? normalizeText(item.op) : '';
    const styleNorm = item.style ? normalizeText(item.style) : '';
    const colorNorm = item.color ? normalizeText(item.color) : '';
    const boxNorm = item.box_name ? normalizeText(item.box_name) : '';
    const invNorm = item.inventory_name ? normalizeText(item.inventory_name) : '';

    for (const term of searchTerms) {
      let termMatched = false;

      if (hasOpKeyword) {
        if (opNorm === term) {
          matchScore += 100;
          termMatched = true;
        } else if (opNorm.includes(term)) {
          matchScore += 40;
          termMatched = true;
        }
      }

      if (hasCajaKeyword) {
        if (boxNorm === term || boxNorm.includes(term)) {
          matchScore += 100;
          termMatched = true;
        }
      }

      if (hasLoteKeyword) {
        if (invNorm === term || invNorm.includes(term)) {
          matchScore += 100;
          termMatched = true;
        }
      }

      if (hasColorKeyword) {
        if (colorNorm === term || colorNorm.includes(term)) {
          matchScore += 100;
          termMatched = true;
        }
      }

      if (hasEstiloKeyword) {
        if (styleNorm === term || styleNorm.includes(term)) {
          matchScore += 100;
          termMatched = true;
        }
      }

      if (!termMatched) {
        const properties = [opNorm, styleNorm, colorNorm, boxNorm, invNorm];
        for (const prop of properties) {
          if (!prop) continue;
          if (prop === term) {
            matchScore += 10;
            termMatched = true;
          } else if (prop.includes(term)) {
            matchScore += 4;
            termMatched = true;
          }
        }
      }

      if (!termMatched && term.length >= 3) {
        const properties = [opNorm, styleNorm, colorNorm, boxNorm, invNorm];
        let minPropDist = Number.MAX_SAFE_INTEGER;
        for (const prop of properties) {
          if (!prop) continue;
          const words = prop.split(' ');
          for (const word of words) {
            const dist = levenshteinDistance(term, word);
            if (dist < minPropDist) minPropDist = dist;
          }
        }

        if (minPropDist <= 2) {
          matchScore += (3 - minPropDist);
          levenshteinPenalty += minPropDist;
        } else {
          levenshteinPenalty += 5;
        }
      } else if (!termMatched) {
        levenshteinPenalty += 1;
      }
    }

    const finalScore = -matchScore + (levenshteinPenalty * 0.1);
    return { ...item, score: finalScore };
  });

  const sorted = ranked
    .filter(item => item.score! < 0)
    .sort((a, b) => a.score! - b.score!);

  if (sorted.length === 0) {
    return [];
  }

  const bestScore = sorted[0].score!;

  if (bestScore <= -10) {
    return sorted.filter(item => item.score! <= bestScore + 3);
  }

  return sorted.slice(0, 30);
};
