import { SQLiteDatabase } from 'expo-sqlite';
import { SearchResult, normalizeText } from '../../utils/nlpEngine';
import { garmentSearchTerms, rankGarmentCandidates } from './garmentSearch';
import { ChatSession } from '../../types';
import { SettingsService } from '../device/SettingsService';
import {
  cleanAsterisks,
  computeCajaProximityScore,
} from '../../utils/fuzzyMatching';
import {
  askGroqToClassify,
  getLastSuccessfulModel,
  InventoryQuery,
} from './groqClient';
import {
  ChatRepository,
  ChatMessage,
  BoxMatchData,
} from './chatRepository';

export { ChatMessage, BoxMatchData, InventoryQuery };

const MAX_CHAT_MATCHES = 20;

const BASE_QUERY = `
  SELECT 
    g.id,
    g.box_id,
    g.op,
    g.style,
    g.color,
    (SELECT COALESCE(uri, storage_key)
     FROM garment_images
     WHERE garment_id = g.id AND order_index = 0 AND deleted_at IS NULL
     ORDER BY updated_at DESC, id DESC LIMIT 1) as photo_uri,
    g.status,
    b.name as box_name,
    i.name as inventory_name,
    i.id as inventory_id
  FROM garments g
  JOIN boxes b ON g.box_id = b.id
  JOIN inventories i ON b.inventory_id = i.id
`;

const SEARCH_QUERY = `
  SELECT g.id, g.box_id, g.op, g.style, g.color, g.status,
         b.name as box_name, i.name as inventory_name, i.id as inventory_id
  FROM garments g
  JOIN boxes b ON g.box_id = b.id
  JOIN inventories i ON b.inventory_id = i.id
`;

const extractOP = (text: string): string | null => {
  const explicit = text.match(/\b(?:op|o\/p)\s*[:#-]?\s*(\d{4,10})\b/i);
  const standalone = text.trim().match(/^(\d{4,10})$/);
  return explicit?.[1] || standalone?.[1] || null;
};

const normalizeColor = (value: string): string => {
  const color = value.trim().toUpperCase();
  // Los adjetivos del usuario suelen variar de género/número respecto del valor guardado.
  const roots = ['ROJ', 'NEGR', 'BLANC', 'AMARILL', 'VERD', 'AZUL', 'GRIS', 'MORAD', 'ROSAD'];
  return roots.find(root => color.startsWith(root)) || color;
};

const boxNumberMatches = (query: string, boxName: string): boolean => {
  const number = normalizeText(query);
  if (!/^\d+$/.test(number)) return true;
  return (boxName.match(/\d+/g) || []).some(part => Number(part) === Number(number));
};

const buildGarmentFilter = (query: InventoryQuery, boxId?: string) => {
  const where = ['g.deleted_at IS NULL', 'b.deleted_at IS NULL', 'i.deleted_at IS NULL'];
  const params: string[] = [];
  const labels: string[] = [];
  const add = (field: string, value: string | null | undefined, label: string, transform = (v: string) => v) => {
    if (!value?.trim()) return;
    where.push(`UPPER(${field}) LIKE ?`);
    params.push(`%${transform(value).toUpperCase()}%`);
    labels.push(`${label} ${value.trim()}`);
  };

  if (query.soloSinOp) {
    where.push("(g.op IS NULL OR TRIM(g.op) = '')");
    labels.push('sin OP');
  }
  add('REPLACE(g.op, " ", "")', query.op?.replace(/\s/g, ''), 'con OP');
  add('g.style', query.estilo, 'del estilo');
  add('g.color', query.color, 'de color', normalizeColor);
  if (boxId) {
    where.push('b.id = ?');
    params.push(boxId);
    if (query.caja) labels.push(`en la caja ${query.caja.trim()}`);
  } else {
    add('b.name', query.caja, 'en la caja');
  }
  add('i.name', query.lote, 'del lote');
  return { where: where.join(' AND '), params, description: labels.join(', ') };
};

/**
 * Consulta detallada de una caja por cercanía de nombre
 */
export const getBoxSummary = async (
  db: SQLiteDatabase,
  boxNameQuery: string,
  inventoryNameQuery?: string | null
): Promise<{
  text: string;
  matches: SearchResult[];
  boxMatch?: BoxMatchData;
  found: boolean;
  factsText?: string;
}> => {
  const allBoxes = await db.getAllAsync<{ id: string; name: string; inventory_id: string; inventory_name: string }>(
    `SELECT b.id, b.name, b.inventory_id, i.name as inventory_name
     FROM boxes b
     JOIN inventories i ON b.inventory_id = i.id
     WHERE b.deleted_at IS NULL AND i.deleted_at IS NULL`
  );

  if (allBoxes.length === 0) {
    return {
      text: 'No hay cajas activas registradas en el inventario.',
      matches: [],
      found: false,
    };
  }

  const candidates = allBoxes
    .filter(c => !inventoryNameQuery || c.inventory_name.toLocaleLowerCase().includes(inventoryNameQuery.toLocaleLowerCase()))
    .filter(c => boxNumberMatches(boxNameQuery, c.name))
    .map(c => ({ box: c, score: computeCajaProximityScore(boxNameQuery, c.name) }))
    .filter(c => c.score >= 40)
    .sort((a, b) => b.score - a.score);
  const box = candidates[0]?.box;

  if (!box) {
    return {
      text: `No encontré ninguna caja con nombre cercano a "${boxNameQuery}".`,
      matches: [],
      found: false,
    };
  }

  const equallyNamed = candidates.filter(c =>
    c.box.name.toLocaleLowerCase() === box.name.toLocaleLowerCase()
  );
  if (equallyNamed.length > 1) {
    return {
      text: `Encontré varias cajas llamadas "${box.name}". Indica el lote para elegir la correcta: ${equallyNamed.map(c => c.box.inventory_name).join(', ')}.`,
      matches: [],
      found: false,
    };
  }

  const counts = await db.getFirstAsync<{ total: number; activas: number; inactivas: number }>(
    `SELECT count(*) as total, COALESCE(sum(g.status = 1), 0) as activas,
            COALESCE(sum(g.status = 0), 0) as inactivas
     FROM garments g WHERE g.deleted_at IS NULL AND g.box_id = ?`,
    [box.id]
  );
  const garments = await db.getAllAsync<SearchResult>(
    `${BASE_QUERY} WHERE g.deleted_at IS NULL AND b.deleted_at IS NULL AND b.id = ?
     ORDER BY g.id DESC LIMIT ${MAX_CHAT_MATCHES}`,
    [box.id]
  );

  const total = counts?.total || 0;
  const activas = counts?.activas || 0;
  const inactivas = counts?.inactivas || 0;

  const boxMatch: BoxMatchData = {
    id: box.id,
    name: box.name,
    inventory_name: box.inventory_name,
    inventory_id: box.inventory_id,
    total_garments: total,
    active_count: activas,
    inactive_count: inactivas,
  };

  const text = [
    `📦 Caja: ${box.name} (${box.inventory_name})`,
    `📊 Total prendas: ${total} (${activas} activas, ${inactivas} inactivas)`,
    total > garments.length ? `Mostrando las primeras ${garments.length}; abre la caja para verlas todas.` : ''
  ].filter(Boolean).join('\n\n');

  return {
    text,
    matches: garments,
    boxMatch,
    found: true,
  };
};

const getGlobalGarmentMatches = async (db: SQLiteDatabase, message: string): Promise<SearchResult[]> => {
  const started = Date.now();
  const candidates = await db.getAllAsync<SearchResult>(
    `${SEARCH_QUERY}
     WHERE g.deleted_at IS NULL AND b.deleted_at IS NULL AND i.deleted_at IS NULL
     ORDER BY g.created_at DESC, g.id DESC`
  );
  const matches = rankGarmentCandidates(candidates, message);
  if (typeof __DEV__ !== 'undefined' && __DEV__ && Date.now() - started > 500) {
    console.log(`[Chatbot] Búsqueda local: ${Date.now() - started} ms, ${candidates.length} prendas revisadas.`);
  }
  return matches;
};

const searchGloballyByDescription = async (db: SQLiteDatabase, message: string) => {
  const ranked = await getGlobalGarmentMatches(db, message);
  const matches = ranked.slice(0, MAX_CHAT_MATCHES);
  if (!matches.length) return { text: '', matches };
  const detailed = await db.getAllAsync<SearchResult>(
    `${BASE_QUERY} WHERE g.id IN (${matches.map(() => '?').join(',')})
     AND g.deleted_at IS NULL AND b.deleted_at IS NULL AND i.deleted_at IS NULL`,
    matches.map(match => match.id)
  );
  const byId = new Map(detailed.map(item => [item.id, item]));
  const visibleMatches = matches.map(item => byId.get(item.id) || item);
  return {
    text: ranked.length === 1
      ? 'Encontré 1 posible coincidencia en el inventario. La ubicación aparece en la tarjeta.'
      : `Encontré ${ranked.length} posibles coincidencias en todos los lotes y cajas. ${ranked.length > matches.length ? `Muestro las primeras ${matches.length}. ` : ''}Revisa las tarjetas y su ubicación para identificar la prenda.`,
    matches: visibleMatches,
  };
};

/**
 * Ejecutor de consultas analíticas y de datos de inventario
 */
export const executeInventoryQuery = async (
  db: SQLiteDatabase,
  query: InventoryQuery,
  userMessage: string
): Promise<{ text: string; matches: SearchResult[]; boxMatch?: BoxMatchData }> => {
  const { accion, op, estilo, color, caja, lote, soloSinOp } = query;

  // Un modelo puede etiquetar como resumen una pregunta que sí trae filtros.
  if (accion === 'RESUMEN_GENERAL' && (op || estilo || color || caja || lote || soloSinOp)) {
    const isCount = /\b(cuantas?|cuantos?|total|cantidad|hay)\b/i.test(normalizeText(userMessage));
    return executeInventoryQuery(db, { ...query, accion: isCount ? 'CONTEO_ESPECIFICO' : 'BUSQUEDA_PUNTUAL' }, userMessage);
  }

  let boxId: string | undefined;
  if (caja && accion !== 'RESUMEN_GENERAL' && !(accion === 'BUSQUEDA_PUNTUAL' && !op && !estilo && !color && !soloSinOp)) {
    const boxes = await db.getAllAsync<{ id: string; name: string; inventory_name: string }>(
      `SELECT b.id, b.name, i.name as inventory_name FROM boxes b
       JOIN inventories i ON b.inventory_id = i.id
       WHERE b.deleted_at IS NULL AND i.deleted_at IS NULL`
    );
    const ranked = boxes
      .filter(b => !lote || normalizeText(b.inventory_name).includes(normalizeText(lote)))
      .filter(b => boxNumberMatches(caja, b.name))
      .map(b => ({ ...b, score: computeCajaProximityScore(caja, b.name) }))
      .filter(b => b.score >= 40)
      .sort((a, b) => b.score - a.score);
    if (!ranked.length) return { text: `No encontré la caja "${caja}" en el inventario actual.`, matches: [] };
    const tied = ranked.filter(b => b.score === ranked[0].score);
    if (tied.length > 1) {
      return {
        text: `Encontré varias cajas que coinciden con "${caja}". Indica el lote: ${tied.map(b => `${b.name} (${b.inventory_name})`).join(', ')}.`,
        matches: [],
      };
    }
    boxId = ranked[0].id;
  }

  // 1. Resumen General
  if (accion === 'RESUMEN_GENERAL') {
    const garmentCounts = await db.getFirstAsync<{ total: number; activas: number; inactivas: number }>(
      `SELECT count(*) as total,
              COALESCE(sum(status = 1), 0) as activas,
              COALESCE(sum(status = 0), 0) as inactivas
       FROM garments WHERE deleted_at IS NULL`
    );
    const boxCount = await db.getFirstAsync<{ total: number }>(
      `SELECT count(*) as total FROM boxes WHERE deleted_at IS NULL`
    );
    const invCount = await db.getFirstAsync<{ total: number }>(
      `SELECT count(*) as total FROM inventories WHERE deleted_at IS NULL`
    );
    const sinOpCount = await db.getFirstAsync<{ total: number }>(
      `SELECT count(*) as total FROM garments WHERE deleted_at IS NULL AND (op IS NULL OR TRIM(op) = '')`
    );

    const total = garmentCounts?.total || 0;
    const activas = garmentCounts?.activas || 0;
    const inactivas = garmentCounts?.inactivas || 0;
    const totalCajas = boxCount?.total || 0;
    const totalLotes = invCount?.total || 0;
    const sinOp = sinOpCount?.total || 0;

    const text = [
      `📊 Resumen general del inventario:`,
      `📦 Lotes registrados: ${totalLotes} | Cajas activas: ${totalCajas}`,
      `👕 Total de prendas: ${total} (${activas} activas, ${inactivas} inactivas)`,
      `⚠️ Prendas sin OP: ${sinOp}`
    ].join('\n\n');

    return { text, matches: [] };
  }

  // 2. Estado de una OP
  if (accion === 'ESTADO_OP') {
    const opClean = (op || extractOP(userMessage) || '').trim();
    if (!opClean) {
      return {
        text: 'Por favor indica el número de la OP que deseas consultar (ej. "¿cómo va la OP 4500?").',
        matches: []
      };
    }

    const filter = buildGarmentFilter({ ...query, op: opClean }, boxId);
    const counts = await db.getFirstAsync<{ total: number; activas: number; inactivas: number }>(
      `SELECT count(*) as total, COALESCE(sum(g.status = 1), 0) as activas,
              COALESCE(sum(g.status = 0), 0) as inactivas
       FROM garments g JOIN boxes b ON g.box_id = b.id
       JOIN inventories i ON b.inventory_id = i.id WHERE ${filter.where}`,
      filter.params
    );
    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE ${filter.where} ORDER BY g.created_at DESC, g.id DESC LIMIT ${MAX_CHAT_MATCHES}`,
      filter.params
    );

    if (rows.length === 0) {
      return {
        text: `No se encontró ninguna prenda registrada con la OP ${opClean} en el inventario actual.`,
        matches: []
      };
    }

    const total = counts?.total || 0;
    const activas = counts?.activas || 0;
    const inactivas = counts?.inactivas || 0;
    const uniqueBoxes = Array.from(new Set(rows.map(r => `${r.box_name} (${r.inventory_name})`).filter(Boolean)));

    const text = [
      `📋 Estado de la OP ${opClean}:`,
      `👕 Total prendas registradas: ${total} (${activas} activas, ${inactivas} inactivas)`,
      `📦 Ubicadas en: ${uniqueBoxes.join(', ') || 'Sin caja asignada'}`,
      total > rows.length ? `Mostrando ${rows.length} de ${total} prendas.` : 'Toca una tarjeta para abrir la prenda.'
    ].join('\n\n');

    return { text, matches: rows };
  }

  // 3. Conteo Específico
  if (accion === 'CONTEO_ESPECIFICO') {
    const filter = buildGarmentFilter(query, boxId);
    if (!filter.description) return executeInventoryQuery(db, { ...query, accion: 'RESUMEN_GENERAL' }, userMessage);

    const queryStr = `
      SELECT count(*) as total,
             COALESCE(sum(g.status = 1), 0) as activas,
             COALESCE(sum(g.status = 0), 0) as inactivas
      FROM garments g
      JOIN boxes b ON g.box_id = b.id
      JOIN inventories i ON b.inventory_id = i.id
      WHERE ${filter.where}
    `;

    const res = await db.getFirstAsync<{ total: number; activas: number; inactivas: number }>(queryStr, filter.params);
    const total = res?.total || 0;
    const activas = res?.activas || 0;
    const inactivas = res?.inactivas || 0;
    const criteriaDesc = filter.description;

    const text = total > 0
      ? `📊 Hay ${total} prenda${total > 1 ? 's' : ''} ${criteriaDesc} (${activas} activas, ${inactivas} inactivas).`
      : `No se encontraron prendas ${criteriaDesc} en el inventario actual.`;

    if (total === 0 && !caja && !op && !soloSinOp) {
      const alternatives = await getGlobalGarmentMatches(db, userMessage);
      if (alternatives.length) {
        return { text: `Encontré ${alternatives.length} posibles coincidencias con tu descripción.`, matches: [] };
      }
    }

    return { text, matches: [] };
  }

  // 4. Búsqueda Puntual (Verídica y sin rodeos)
  if (accion === 'BUSQUEDA_PUNTUAL') {
    if (caja && !op && !estilo && !color && !soloSinOp) {
      return getBoxSummary(db, caja, lote);
    }

    const filter = buildGarmentFilter(query, boxId);
    if (!filter.description) return searchLocal(db, userMessage);

    const counts = await db.getFirstAsync<{ total: number }>(
      `SELECT count(*) as total FROM garments g JOIN boxes b ON g.box_id = b.id
       JOIN inventories i ON b.inventory_id = i.id WHERE ${filter.where}`,
      filter.params
    );

    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE ${filter.where} ORDER BY g.created_at DESC, g.id DESC LIMIT ${MAX_CHAT_MATCHES}`,
      filter.params
    );

    if (rows.length === 0) {
      // Reintenta globalmente si el modelo interpretó mal la descripción y no se pidió caja.
      if (!caja) {
        const fallback = await searchGloballyByDescription(db, userMessage);
        if (fallback.matches.length) return fallback;
      }
      return {
        text: `No encontré prendas ${filter.description} en el inventario actual.`,
        matches: []
      };
    }

    const total = counts?.total || 0;
    const text = total === 1
      ? `Encontré 1 prenda ${filter.description}. Está en la caja "${rows[0].box_name}" del lote "${rows[0].inventory_name}". Toca la tarjeta para abrirla.`
      : `Encontré ${total} prendas ${filter.description}. ${total > rows.length ? `Muestro las primeras ${rows.length}. ` : ''}Revisa las tarjetas para elegir la prenda exacta; puede haber varias iguales.`;

    return { text, matches: rows };
  }

  // Resumen general por defecto
  return executeInventoryQuery(db, { accion: 'RESUMEN_GENERAL', op: null, estilo: null, color: null, caja: null, soloSinOp: false }, userMessage);
};

/**
 * Búsqueda local de respaldo offline (sin conexión)
 */
export const searchLocal = async (
  db: SQLiteDatabase,
  message: string
): Promise<{ text: string; matches: SearchResult[]; boxMatch?: BoxMatchData }> => {
  const input = message.trim();
  const lower = input.toLowerCase();

  if (!input) {
    return { text: '¿En qué puedo ayudarte hoy?', matches: [] };
  }

  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|ayuda|gracias)[!.\s]*$/i.test(normalizeText(input))) {
    return { text: 'Hola, puedo ayudarte a buscar prendas por OP, estilo o color y mostrarte en qué caja están.', matches: [] };
  }

  // 1. Procedimientos frecuentes offline
  if (lower.includes('apartado') || lower.includes('seccion') || lower.includes('menu')) {
    return {
      text: 'Garment Manager cuenta con 5 apartados: Home (resumen diario), Lotes (gestión de cajas y lotes), Buscar (buscador con filtros), Asistente (ayuda operativa y métricas) y Ajustes.',
      matches: []
    };
  }

  if (lower.includes('registrar') || lower.includes('crear prenda') || lower.includes('nueva prenda') || lower.includes('escanear')) {
    return {
      text: 'Para registrar prendas: ingresa a un Lote, abre la Caja de destino y presiona el botón "+" o el escáner de cámara OCR.',
      matches: []
    };
  }

  if (lower.includes('mover') || lower.includes('cambiar de caja')) {
    return {
      text: 'Para mover una prenda a otra caja: mantén presionada la tarjeta de la prenda (pulsación larga) en el detalle de la caja.',
      matches: []
    };
  }

  if (lower.includes('falla') || lower.includes('merma') || lower.includes('defecto') || lower.includes('rechazo')) {
    return {
      text: 'Si una prenda tiene fallas, cámbiale el estado a "Inactivo" y muévela a la caja designada para Mermas o Rechazos.',
      matches: []
    };
  }

  // 2. La descripción se busca en todas las prendas; la ubicación es opcional.
  const cajaMatch = /\bcaja\s+(\d+)\b/i.exec(input)
    || /\bcaja\s+(.+?)(?=\s+(?:del?|con|y)\s+(?:color|estilo|op|lote)\b|[?.!,;]|$)/i.exec(input);
  const caja = cajaMatch?.[1]?.trim() || null;
  const op = extractOP(input);
  const isCount = /\b(cuantas?|cuantos?|total|numero de|cantidad de|hay)\b/i.test(normalizeText(input));
  const remainingTerms = garmentSearchTerms(input);
  const boxWords = normalizeText(caja || '').split(' ');

  if (/\bresumen\b/.test(normalizeText(input)) && !remainingTerms.length) {
    return executeInventoryQuery(db, { accion: 'RESUMEN_GENERAL', op: null, estilo: null, color: null, caja: null, soloSinOp: false }, input);
  }

  if (!isCount) {
    if (caja && remainingTerms.length > 0 && remainingTerms.every(term => boxWords.includes(term))) {
      return getBoxSummary(db, caja);
    }
    if (op && !caja && remainingTerms.length === 1) {
      return executeInventoryQuery(db, { accion: 'ESTADO_OP', op, estilo: null, color: null, caja: null, soloSinOp: false }, input);
    }
    const globalSearch = await searchGloballyByDescription(db, input);
    if (globalSearch.matches.length) return globalSearch;
    return { text: 'No encontré prendas que coincidan con esa descripción en el inventario actual.', matches: [] };
  }

  if (/\bsin\s+(?:op|o\/p)\b/i.test(normalizeText(input))) {
    return executeInventoryQuery(db, { accion: 'CONTEO_ESPECIFICO', op: null, estilo: null, color: null, caja, soloSinOp: true }, input);
  }

  if (caja) {
    const box = await getBoxSummary(db, caja);
    if (!box.found) return box;
    if (remainingTerms.every(term => boxWords.includes(term))) {
      return { text: box.text, matches: [], boxMatch: box.boxMatch };
    }
    const candidates = await db.getAllAsync<SearchResult>(
      `${SEARCH_QUERY} WHERE g.deleted_at IS NULL AND b.deleted_at IS NULL
       AND i.deleted_at IS NULL AND b.id = ?`,
      [box.boxMatch!.id]
    );
    const matches = rankGarmentCandidates(candidates, input);
    return { text: `Hay ${matches.length} prendas en la caja ${caja} que coinciden con tu descripción.`, matches: [] };
  }

  if (op) {
    const filter = buildGarmentFilter({ accion: 'ESTADO_OP', op, estilo: null, color: null, caja: null, soloSinOp: false });
    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE ${filter.where}`, filter.params
    );
    const matches = remainingTerms.length > 1 ? rankGarmentCandidates(rows, input) : rows;
    return { text: `Hay ${matches.length} prendas que coinciden con la OP ${op} y tu descripción.`, matches: [] };
  }

  if (!remainingTerms.length) {
    return executeInventoryQuery(db, { accion: 'RESUMEN_GENERAL', op: null, estilo: null, color: null, caja: null, soloSinOp: false }, input);
  }

  const matches = await getGlobalGarmentMatches(db, input);
  return { text: `Hay ${matches.length} prendas que coinciden con tu descripción.`, matches: [] };
};

/**
 * Fachada principal del servicio Chatbot
 */
export const ChatbotService = {
  getSessions: (db: SQLiteDatabase, userId?: string | null): Promise<ChatSession[]> =>
    ChatRepository.getSessions(db, userId),

  adoptOrphanSessions: (db: SQLiteDatabase, userId: string): Promise<void> =>
    ChatRepository.adoptOrphanSessions(db, userId),

  cleanupSoftDeleted: (db: SQLiteDatabase): Promise<void> =>
    ChatRepository.cleanupSoftDeleted(db),

  createSession: (db: SQLiteDatabase, title?: string, userId?: string | null): Promise<string> =>
    ChatRepository.createSession(db, title, userId),

  updateSessionTitle: (db: SQLiteDatabase, sessionId: string, newTitle: string): Promise<void> =>
    ChatRepository.updateSessionTitle(db, sessionId, newTitle),

  deleteSession: (db: SQLiteDatabase, sessionId: string, userId?: string | null): Promise<void> =>
    ChatRepository.deleteSession(db, sessionId, userId),

  getHistoryBySession: (db: SQLiteDatabase, sessionId: string): Promise<ChatMessage[]> =>
    ChatRepository.getHistoryBySession(db, sessionId),

  saveMessage: (db: SQLiteDatabase, message: ChatMessage, sessionId: string): Promise<void> =>
    ChatRepository.saveMessage(db, message, sessionId),

  clearHistory: (db: SQLiteDatabase, userId?: string | null): Promise<void> =>
    ChatRepository.clearHistory(db, userId),

  getActiveModelName: async (db: SQLiteDatabase): Promise<string> => {
    const lastModel = getLastSuccessfulModel();
    if (lastModel) return lastModel;

    let apiKey = '';
    try {
      apiKey = await SettingsService.getSetting(db, 'groq_api_key', '');
    } catch (_) {}

    if (!apiKey || apiKey.trim() === '') {
      apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
    }

    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
    if (!cleanKey) return 'Motor Local';

    return 'openai/gpt-oss-20b';
  },

  searchAndRespond: async (
    db: SQLiteDatabase,
    message: string,
    sessionId: string
  ): Promise<{ text: string; matches: SearchResult[]; boxMatch?: BoxMatchData; engineUsed: 'ia' | 'local'; modelName?: string }> => {
    const history = await ChatRepository.getHistoryBySession(db, sessionId);
    const started = Date.now();
    const classification = await askGroqToClassify(db, message, history.slice(0, 10));
    if (typeof __DEV__ !== 'undefined' && __DEV__ && Date.now() - started > 1000) {
      console.log(`[Chatbot] Clasificación IA: ${Date.now() - started} ms.`);
    }

    if (classification) {
      // Caso 1: Procedimiento operativo o duda de la app (Respuesta directa < 300ms)
      const inventoryIntent = /\b(busca|buscar|encuentra|encontrar|donde|ubicacion|cuantas?|cuantos?|cantidad|total|hay|muestrame|mostrar)\b/i
        .test(normalizeText(message)) && !/\b(como|registrar|crear|mover|editar|eliminar|funciona)\b/i.test(normalizeText(message));
      if (classification.tipo === 'PROCEDIMIENTO' && !inventoryIntent) {
        const reply = classification.respuestaDirecta || 'Puedo resolver tus dudas sobre los apartados de la app o procedimientos textiles del taller.';
        return {
          text: cleanAsterisks(reply),
          matches: [],
          engineUsed: 'ia',
          modelName: classification.modelName
        };
      }

      // Caso 2: Consulta analítica o datos del inventario (SQLite rápido < 5ms)
      if (classification.tipo === 'DATOS_INVENTARIO' && classification.consulta) {
        const invRes = await executeInventoryQuery(db, classification.consulta, message);
        return {
          ...invRes,
          text: cleanAsterisks(invRes.text),
          engineUsed: 'ia',
          modelName: classification.modelName
        };
      }
    }

    // Fallback Local offline
    const localRes = await searchLocal(db, message);
    return {
      ...localRes,
      text: cleanAsterisks(localRes.text),
      engineUsed: 'local',
      modelName: 'Motor Local'
    };
  }
};
