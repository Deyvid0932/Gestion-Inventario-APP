import { SQLiteDatabase } from 'expo-sqlite';
import { SearchResult } from '../utils/nlpEngine';
import { ChatSession } from '../types';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  matches?: SearchResult[];
  timestamp: number;
  engineUsed?: 'ia' | 'local';
}

const BASE_QUERY = `
  SELECT p.id, p.op, p.estilo, p.color, p.estado, p.fotoUri, p.cajaId,
  c.nombre as cajaNombre, i.nombre as inventarioNombre, i.id as inventarioId
  FROM prendas p
  JOIN cajas c ON p.cajaId = c.id
  JOIN inventarios i ON c.inventarioId = i.id
`;

const extractOP = (text: string): string | null => {
  const cleaned = text.toUpperCase().trim();
  const opMatch = cleaned.match(/^OP\s*(\d+)$/i);
  if (opMatch) return opMatch[1];
  if (/^\d{3,}$/.test(cleaned)) return cleaned;
  return null;
};

const COLORES_CONOCIDOS = [
  'ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'NEGRO', 'BLANCO', 'GRIS', 'NARANJA',
  'MORADO', 'ROSA', 'CELESTE', 'TURQUESA', 'BEIGE', 'CREMA', 'MARRON',
  'CAFE', 'CORAL', 'SALMON', 'LILA', 'FUCSIA', 'DORADO', 'PLATEADO',
  'BURGUNDY', 'VINO', 'OLIVO', 'AQUA', 'NAVY', 'RED', 'BLUE', 'GREEN',
  'BLACK', 'WHITE', 'PINK', 'PURPLE', 'ORANGE', 'YELLOW', 'BROWN', 'GREY'
];

const extractColor = (text: string): string | null => {
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
  const colorMatch = cleaned.match(/COLOR\s+(\w+)/);
  if (colorMatch) return colorMatch[1];
  if (COLORES_CONOCIDOS.includes(cleaned)) return cleaned;
  const words = cleaned.split(/\s+/);
  for (const word of words) {
    if (COLORES_CONOCIDOS.includes(word)) return word;
  }
  return null;
};

const searchLocal = async (
  db: SQLiteDatabase,
  message: string
): Promise<{ text: string; matches: SearchResult[] }> => {
  const input = message.trim();
  if (!input) {
    return { text: '¿Qué estilo, OP o color deseas buscar?', matches: [] };
  }

  // 1. OP (única)
  const op = extractOP(input);
  if (op) {
    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE p.op LIKE ? LIMIT 20`,
      [`%${op}%`]
    );

    if (rows.length === 0) {
      return { text: `No se encontraron prendas con la OP "${op}".`, matches: [] };
    }
    return {
      text: `Se encontraron ${rows.length} prendas asociadas a la OP "${op}":`,
      matches: rows
    };
  }

  // 2. Color
  const color = extractColor(input);
  if (color) {
    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE UPPER(p.color) LIKE ? LIMIT 20`,
      [`%${color}%`]
    );

    if (rows.length === 0) {
      return { text: `No se encontraron prendas con el color "${color}".`, matches: [] };
    }
    return {
      text: `Se encontraron ${rows.length} prendas del color "${color}":`,
      matches: rows
    };
  }

  // 3. Estilo por defecto
  const rows = await db.getAllAsync<SearchResult>(
    `${BASE_QUERY} WHERE UPPER(p.estilo) LIKE ? LIMIT 20`,
    [`%${input.toUpperCase()}%`]
  );

  if (rows.length === 0) {
    return { text: `No encontré coincidencias para "${input}". Intenta buscando por estilo (ej: KHM 030 001), OP o color.`, matches: [] };
  }
  return {
    text: `Se encontraron ${rows.length} prendas asociadas al estilo "${input}":`,
    matches: rows
  };
};

const executeSearch = async (
  db: SQLiteDatabase,
  tipo: string,
  valor: string
): Promise<{ text: string; matches: SearchResult[] }> => {
  if (tipo === 'OP') {
    const opVal = valor.replace(/\D/g, '') || valor;
    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE p.op LIKE ? LIMIT 20`,
      [`%${opVal}%`]
    );
    if (rows.length === 0) return { text: `No se encontraron prendas para la OP "${valor}".`, matches: [] };
    return { text: `Encontré ${rows.length} prendas para la OP "${valor}":`, matches: rows };
  }

  if (tipo === 'COLOR') {
    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE UPPER(p.color) LIKE ? LIMIT 20`,
      [`%${valor.toUpperCase()}%`]
    );
    if (rows.length === 0) return { text: `No se encontraron prendas del color "${valor}".`, matches: [] };
    return { text: `Encontré ${rows.length} prendas del color "${valor}":`, matches: rows };
  }

  if (tipo === 'ESTILO') {
    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE UPPER(p.estilo) LIKE ? LIMIT 20`,
      [`%${valor.toUpperCase()}%`]
    );
    if (rows.length === 0) return { text: `No se encontraron prendas con el estilo "${valor}".`, matches: [] };
    return { text: `Encontré ${rows.length} prendas para el estilo "${valor}":`, matches: rows };
  }

  if (tipo === 'CAJA') {
    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT count(*) as total FROM prendas p JOIN cajas c ON p.cajaId = c.id WHERE UPPER(c.nombre) LIKE ?`,
      [`%${valor.toUpperCase()}%`]
    );
    return { text: `📦 La ${valor} actualmente tiene ${result?.total || 0} prendas.`, matches: [] };
  }

  if (tipo === 'INVENTARIO') {
    const totalCajas = await db.getFirstAsync<{ total: number }>(`SELECT count(*) as total FROM cajas`);
    const detalle = await db.getAllAsync<{ nombre: string, cantidad: number }>(
      `SELECT c.nombre, count(p.id) as cantidad FROM cajas c LEFT JOIN prendas p ON p.cajaId = c.id GROUP BY c.id ORDER BY c.nombre`
    );
    const lista = detalle.map(c => `• ${c.nombre}: ${c.cantidad} prendas`).join('\n');
    return { text: `📊 Resumen del inventario:\n\nTotal de cajas: ${totalCajas?.total || 0}\n\n${lista}`, matches: [] };
  }
  return executeSearch(db, 'ESTILO', valor);
};


const askGroqToClassify = async (
  message: string,
  history: ChatMessage[]
): Promise<{ tipo: string; valor: string } | null> => {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[Groq] Falta EXPO_PUBLIC_GROQ_API_KEY. Se usará el motor local.');
    return null;
  }

  try {
    const conversationContext = history
      .slice()
      .reverse()
      .map(item => `${item.sender === 'user' ? 'Usuario' : 'Asistente'}: ${item.text}`)
      .join('\n');

    const prompt = `Contexto reciente de la conversación:
${conversationContext || '(No hay mensajes anteriores)'}

Analiza la siguiente frase nueva de un usuario de una app de inventario de ropa: "${message}"

Clasifícala en uno de estos tipos:
- OP: el usuario busca explícitamente por número de OP (ej: "OP 101", "op 5") o escribe exclusivamente un número sin letras (ej: "123").
- ESTILO: el usuario busca por un estilo de prenda. IMPORTANTE: Los estilos en esta app suelen ser códigos alfanuméricos como "khm 030 001", "KHM 030", "KH 12", "polo slim". Si la consulta contiene letras (como KHM, POLO, CAMISA, etc.), SIEMPRE debes clasificarla como ESTILO, NUNCA como OP.
- COLOR: el usuario busca por un color específico (ej: "rojo", "azul", "negro").
- CAJA: el usuario pregunta cuántas prendas hay en una caja específica.
- INVENTARIO: el usuario pide un resumen general del inventario.
- SALUDO: el usuario solo saluda (hola, buenos días, etc).
- LIBRE: cualquier otra cosa que NO sea una búsqueda en la base de datos.

Si el tipo es LIBRE, responde directamente la conversación en el campo "valor" (breve, directo, en español). Si es cualquier otro tipo, en "valor" pon el término extraído para buscar en la base de datos.

Responde ÚNICAMENTE con un objeto JSON con este formato exacto, sin explicaciones ni bloques de código markdown. Ejemplos:
{"tipo": "ESTILO", "valor": "CAMISA001"}
{"tipo": "LIBRE", "valor": "¡De nada! Si necesitas algo más, aquí estoy."}`;

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 600
        })
      }
    );

    const responseText = await response.text();
    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('[Groq] La respuesta no es JSON:', responseText);
      return null;
    }

    const rawText = data.choices?.[0]?.message?.content?.trim() || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      tipo: (parsed.tipo || 'LIBRE').toUpperCase(),
      valor: String(parsed.valor || message)
    };

  } catch (e) {
    console.error('❌ ERROR CRÍTICO DE PARSEO:', (e as Error).message);
    return null;
  }
};


export const ChatbotService = {
  getSessions: async (db: SQLiteDatabase, userId?: string | null): Promise<ChatSession[]> => {
    try {
      if (userId) {
        // Adoptar cualquier sesión de invitado huérfana al usuario actual
        await db.runAsync(
          `UPDATE chat_sessions SET user_id = ?, sync_status = 'PENDING' WHERE user_id IS NULL OR user_id = ''`,
          [userId]
        );
        return await db.getAllAsync<ChatSession>(
          'SELECT * FROM chat_sessions WHERE deleted_at IS NULL AND user_id = ? ORDER BY updatedAt DESC',
          [userId]
        );
      } else {
        return await db.getAllAsync<ChatSession>(
          'SELECT * FROM chat_sessions WHERE deleted_at IS NULL AND (user_id IS NULL OR user_id = "") ORDER BY updatedAt DESC'
        );
      }
    } catch (e) {
      console.error('Error fetching chat sessions', e);
      return [];
    }
  },

  createSession: async (db: SQLiteDatabase, title: string = 'Nueva conversación', userId?: string | null): Promise<string> => {
    try {
      const id = Date.now().toString();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO chat_sessions (id, user_id, title, createdAt, updatedAt, updated_at, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
        [id, userId || null, title, Date.now(), Date.now(), now]
      );
      return id;
    } catch (e) {
      console.error('Error creating chat session', e);
      return Date.now().toString();
    }
  },

  deleteSession: async (db: SQLiteDatabase, sessionId: string): Promise<void> => {
    try {
      const now = new Date().toISOString();
      await db.runAsync('UPDATE chat_history SET deleted_at = ?, sync_status = "PENDING" WHERE sessionId = ?', [now, sessionId]);
      await db.runAsync('UPDATE chat_sessions SET deleted_at = ?, sync_status = "PENDING" WHERE id = ?', [now, sessionId]);
    } catch (e) {
      console.error('Error deleting chat session', e);
    }
  },

  updateSessionTitle: async (db: SQLiteDatabase, sessionId: string, title: string): Promise<void> => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        'UPDATE chat_sessions SET title = ?, updatedAt = ?, updated_at = ?, sync_status = "PENDING" WHERE id = ?',
        [title, Date.now(), now, sessionId]
      );
    } catch (e) {
      console.error('Error updating session title', e);
    }
  },

  getHistoryBySession: async (db: SQLiteDatabase, sessionId: string): Promise<ChatMessage[]> => {
    try {
      const history = await db.getAllAsync<{ id: string, sender: string, text: string, matches_json: string, engineUsed?: string, timestamp: number }>(
        'SELECT * FROM chat_history WHERE sessionId = ? AND deleted_at IS NULL ORDER BY timestamp DESC LIMIT 100',
        [sessionId]
      );
      return history.map(row => {
        let parsedMatches;
        if (row.matches_json) {
          try {
            parsedMatches = JSON.parse(row.matches_json);
          } catch (_) { }
        }
        const engineUsed = (row.engineUsed as 'ia' | 'local' | undefined) || (row.sender === 'bot' ? 'ia' : undefined);
        return {
          id: row.id,
          sender: row.sender as 'user' | 'bot',
          text: row.text,
          matches: parsedMatches,
          engineUsed,
          timestamp: row.timestamp
        };
      });
    } catch (e) {
      console.error('Error fetching chat history by session', e);
      return [];
    }
  },

  saveMessage: async (db: SQLiteDatabase, msg: ChatMessage, sessionId: string): Promise<void> => {
    try {
      const now = new Date().toISOString();
      const matchesStr = msg.matches ? JSON.stringify(msg.matches) : null;
      await db.runAsync(
        `INSERT INTO chat_history (id, sender, text, matches_json, timestamp, sessionId, engineUsed, updated_at, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [msg.id, msg.sender, msg.text, matchesStr, msg.timestamp, sessionId, msg.engineUsed || null, now]
      );
      await db.runAsync(
        `UPDATE chat_sessions SET updatedAt = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [Date.now(), now, sessionId]
      );
    } catch (e) {
      console.error('Error saving chat message', e);
    }
  },

  clearHistory: async (db: SQLiteDatabase): Promise<void> => {
    const now = new Date().toISOString();
    await db.runAsync('UPDATE chat_history SET deleted_at = ?, sync_status = "PENDING"', [now]);
    await db.runAsync('UPDATE chat_sessions SET deleted_at = ?, sync_status = "PENDING"', [now]);
  },

  searchAndRespond: async (db: SQLiteDatabase, message: string, sessionId: string): Promise<{ text: string, matches: SearchResult[], engineUsed: 'ia' | 'local' }> => {
    const history = await ChatbotService.getHistoryBySession(db, sessionId);
    const classification = await askGroqToClassify(message, history.slice(0, 10));

    if (classification) {
      if (classification.tipo === 'SALUDO') {
        return { text: '¡Hola! 👋 Soy tu asistente de inventario Topytop Kith. Puedes buscar por estilo, OP o color. ¿Qué necesitas?', matches: [], engineUsed: 'ia' };
      }

      if (classification.tipo === 'LIBRE' || classification.tipo === 'CONVERSACION') {
        return { text: classification.valor, matches: [], engineUsed: 'ia' };
      }

      const searchRes = await executeSearch(db, classification.tipo, classification.valor);
      return { ...searchRes, engineUsed: 'ia' };
    }

    const localRes = await searchLocal(db, message);
    return { ...localRes, engineUsed: 'local' };
  }
};
