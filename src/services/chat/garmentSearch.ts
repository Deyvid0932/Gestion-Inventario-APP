import { SearchResult, levenshteinDistance, normalizeText } from '../../utils/nlpEngine';

const ignoredWords = new Set([
  'a', 'al', 'busca', 'buscar', 'buscame', 'con', 'cual', 'cuales', 'cuanta', 'cuantas',
  'cuanto', 'cuantos', 'de', 'del', 'dime', 'donde', 'el', 'en', 'encuentra', 'encontrar',
  'es', 'esta', 'estan', 'hay', 'la', 'las', 'lo', 'los', 'me', 'muestra', 'muestrame',
  'necesito', 'op', 'por', 'prenda', 'prendas', 'quiero', 'que', 'tengo', 'tienes',
  'un', 'una', 'unas', 'unos', 'ver', 'vestimenta', 'color', 'estilo', 'tipo',
  'caja', 'cajas', 'lote', 'lotes', 'inventario', 'ubicacion', 'ubicame',
  'cantidad', 'numero', 'total', 'resumen', 'saber', 'puedes', 'podrias',
  'favor', 'porfavor', 'dame', 'trae', 'traeme', 'tenemos', 'tenia',
]);
const colorRoots = ['roj', 'negr', 'blanc', 'amarill', 'verd', 'azul', 'gris', 'morad', 'rosad'];

const words = (value: string): string[] =>
  normalizeText(value.replace(/[-_/]/g, ' ')).split(' ').filter(Boolean);

export const garmentSearchTerms = (message: string): string[] =>
  words(message).filter(word => !ignoredWords.has(word));

const canonicalWord = (word: string): string => {
  const colorRoot = colorRoots.find(root => word.startsWith(root));
  if (colorRoot) return colorRoot;
  if (word.length > 4 && word.endsWith('s')) return word.slice(0, -1);
  return word;
};

const termScore = (term: string, fieldWords: string[], compact: string): number => {
  if (fieldWords.some(word => word === term)) return 4;
  if (fieldWords.some(word => canonicalWord(word) === canonicalWord(term))) return 3;
  if (term.length >= 3 && compact.includes(term)) return 2;
  if (term.length >= 5 && fieldWords.some(word =>
    Math.abs(word.length - term.length) <= 1 && levenshteinDistance(word, term) === 1
  )) return 1;
  return 0;
};

/** Ordena prendas reales por coincidencia de OP, estilo y color, sin fusionar IDs iguales. */
export const rankGarmentCandidates = (items: SearchResult[], message: string): SearchResult[] => {
  const query = normalizeText(message);
  const includeBox = /\bcaja\b/.test(query);
  const includeInventory = /\b(lote|inventario)\b/.test(query);
  const boxTerm = query.match(/\bcaja\s+(\w+)/)?.[1];
  const opTerm = query.match(/\bop\s+(\d{4,10})\b/)?.[1];
  const terms = garmentSearchTerms(message);
  if (!terms.length) return [];

  const scored = items.map(item => {
    const fields = [
      { kind: 'op', words: words(item.op || ''), weight: 10 },
      { kind: 'style', words: words(item.style || ''), weight: 5 },
      { kind: 'color', words: words(item.color || ''), weight: 4 },
      ...(includeBox ? [{ kind: 'box', words: words(item.box_name || ''), weight: 2 }] : []),
      ...(includeInventory ? [{ kind: 'inventory', words: words(item.inventory_name || ''), weight: 2 }] : []),
    ];
    let score = 0;
    let matchedTerms = 0;
    for (const term of terms) {
      const eligibleFields = term === boxTerm ? fields.filter(field => field.kind === 'box')
        : term === opTerm ? fields.filter(field => field.kind === 'op')
        : colorRoots.includes(canonicalWord(term)) ? fields.filter(field => field.kind === 'color')
        : fields;
      const best = Math.max(0, ...eligibleFields.map(field => {
        const compact = field.words.join('');
        // Los números de OP deben coincidir enteros; un prefijo no identifica una OP.
        if (field.weight === 10 && /^\d+$/.test(term)) {
          return field.words.includes(term) || compact === term ? 40 : 0;
        }
        return termScore(term, field.words, compact) * field.weight;
      }));
      if (best > 0) matchedTerms += 1;
      score += best;
    }
    return { ...item, score: -score, matchedTerms };
  });

  const complete = scored.filter(item => item.matchedTerms === terms.length);
  // Una palabra adicional del usuario puede no estar almacenada; en ese caso
  // solo se admiten coincidencias parciales si otras dos palabras sí coinciden.
  const plausible = complete.length > 0 ? complete : scored.filter(item =>
    terms.length >= 3 && item.matchedTerms >= terms.length - 1 && item.matchedTerms >= 2
  );
  if (!plausible.length) return [];
  plausible.sort((a, b) => a.score - b.score);
  const bestScore = plausible[0].score;
  return plausible
    .filter(item => item.score <= bestScore + 5)
    .map(({ matchedTerms: _matchedTerms, ...item }) => item);
};
