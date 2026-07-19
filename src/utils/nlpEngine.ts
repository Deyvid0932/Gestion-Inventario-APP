export const normalizeText = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .toLowerCase()
    .replace(/[^\w\s]/gi, '') // Quitar signos de puntuación
    .replace(/\s+/g, ' ') // Quitar espacios dobles
    .trim();
};

export const extractSearchTerms = (text: string): string[] => {
  const normalized = normalizeText(text);
  const stopWords = ['donde', 'esta', 'la', 'el', 'los', 'las', 'un', 'una', 'busca', 'encuentra', 'en', 'de', 'para', 'por', 'con'];
  
  return normalized
    .split(' ')
    .filter(word => !stopWords.includes(word) && word.length > 1);
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
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
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
  estilo: string;
  color: string;
  estado: number;
  fotoUri: string | null;
  cajaId: string;
  cajaNombre: string;
  inventarioNombre: string;
  inventarioId: string;
  score?: number; 
}

export const rankResults = (results: SearchResult[], searchTerms: string[]): SearchResult[] => {
  const fullSearchTerm = searchTerms.join(' ');

  const ranked = results.map(item => {
    let score = Number.MAX_SAFE_INTEGER;
    
    const opNorm = item.op ? normalizeText(item.op) : '';
    const estiloNorm = item.estilo ? normalizeText(item.estilo) : '';
    const colorNorm = item.color ? normalizeText(item.color) : '';

    // 1. Exact match de toda la frase de búsqueda (Máxima Prioridad)
    if (opNorm === fullSearchTerm || estiloNorm === fullSearchTerm || colorNorm === fullSearchTerm) {
      return { ...item, score: -1 };
    }

    // 2. Comparar cada término individual
    for (const term of searchTerms) {
      const opDist = opNorm ? levenshteinDistance(term, opNorm) : Number.MAX_SAFE_INTEGER;
      const estiloDist = estiloNorm ? levenshteinDistance(term, estiloNorm) : Number.MAX_SAFE_INTEGER;
      const colorDist = colorNorm ? levenshteinDistance(term, colorNorm) : Number.MAX_SAFE_INTEGER;
      
      // Exact match parcial
      if (opNorm === term || estiloNorm === term || colorNorm === term) return { ...item, score: 0 };
      
      // Contains
      if (opNorm.includes(term) || estiloNorm.includes(term) || colorNorm.includes(term)) return { ...item, score: 0.5 };
      
      const minDist = Math.min(opDist, estiloDist, colorDist);
      if (minDist < score) score = minDist;
    }
    
    return { ...item, score };
  });

  // 1. Filtrar coincidencias perfectas o exactas
  const exactMatches = ranked.filter(item => item.score! <= 0);
  
  if (exactMatches.length > 0) {
    // Si hay una coincidencia perfecta (score -1) devuelve solo esa(s)
    const perfectMatches = exactMatches.filter(item => item.score === -1);
    if (perfectMatches.length > 0) return perfectMatches.slice(0, 1);
    
    return exactMatches.sort((a, b) => a.score! - b.score!);
  }

  // 2. Si no hay exactos, devolver los fuzzy cercanos (score <= 2)
  return ranked
    .filter(item => item.score! <= 2)
    .sort((a, b) => a.score! - b.score!)
    .slice(0, 5); // TOP 5
};
