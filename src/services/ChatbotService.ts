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
    const results = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE UPPER(trim(p.op)) = ?`, [op]
    );
    if (results.length > 0) {
      return { text: `✅ Se encontró la prenda con OP ${op}:`, matches: results };
    }
    return { text: `❌ No se encontró ninguna prenda con OP "${op}".`, matches: [] };
  }

  // 2. Color (máx 5)
  const color = extractColor(input);
  if (color) {
    const results = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE UPPER(trim(p.color)) LIKE ? LIMIT 5`, [`%${color}%`]
    );
    if (results.length > 0) {
      return { text: `🎨 Encontré ${results.length} prenda(s) de color "${color}" (máx. 5):`, matches: results };
    }
    return { text: `❌ No se encontraron prendas de color "${color}".`, matches: [] };
  }

  const estilo = input.toUpperCase().trim();
  const exactResults = await db.getAllAsync<SearchResult>(
    `${BASE_QUERY} WHERE UPPER(trim(p.estilo)) = ?`, [estilo]
  );
  if (exactResults.length > 0) {
    return { text: `✅ Se encontraron ${exactResults.length} prenda(s) con estilo "${estilo}":`, matches: exactResults };
  }

  const partialResults = await db.getAllAsync<SearchResult>(
    `${BASE_QUERY} WHERE UPPER(p.estilo) LIKE ? LIMIT 15`, [`%${estilo}%`]
  );
  if (partialResults.length > 0) {
    return { text: `🔍 No encontré coincidencia exacta para "${estilo}", pero encontré ${partialResults.length} resultado(s) similares:`, matches: partialResults };
  }

  const generalResults = await db.getAllAsync<SearchResult>(
    `${BASE_QUERY} WHERE UPPER(p.estilo) LIKE ? OR UPPER(p.op) LIKE ? OR UPPER(p.color) LIKE ? LIMIT 10`,
    [`%${estilo}%`, `%${estilo}%`, `%${estilo}%`]
  );
  if (generalResults.length > 0) {
    return { text: `🔍 Resultados relacionados con "${input}":`, matches: generalResults };
  }

  return { text: `❌ No se encontró nada para "${input}". Intenta con otro estilo, OP o color.`, matches: [] };
};

const executeSearch = async (
  db: SQLiteDatabase,
  tipo: string,
  valor: string
): Promise<{ text: string; matches: SearchResult[] }> => {
  const term = valor.toUpperCase().trim();

  if (tipo === 'OP') {
    const results = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE UPPER(trim(p.op)) = ?`, [term]
    );
    if (results.length > 0) return { text: `✅ Se encontró la prenda con OP ${term}:`, matches: results };
    return { text: `❌ No se encontró ninguna prenda con OP "${term}".`, matches: [] };
  }

  if (tipo === 'COLOR') {
    const results = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE UPPER(trim(p.color)) LIKE ? LIMIT 5`, [`%${term}%`]
    );
    if (results.length > 0) return { text: `🎨 Encontré ${results.length} prenda(s) de color "${term}" (máx. 5):`, matches: results };
    return { text: `❌ No se encontraron prendas de color "${term}".`, matches: [] };
  }

  if (tipo === 'ESTILO') {
    const exact = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE UPPER(trim(p.estilo)) = ?`, [term]
    );
    if (exact.length > 0) return { text: `✅ Se encontraron ${exact.length} prenda(s) con estilo "${term}":`, matches: exact };

    const partial = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE UPPER(p.estilo) LIKE ? LIMIT 15`, [`%${term}%`]
    );
    if (partial.length > 0) return { text: `🔍 Resultados similares a "${term}":`, matches: partial };
    return { text: `❌ No se encontró ninguna prenda con estilo "${term}".`, matches: [] };
  }

  if (tipo === 'CAJA') {
    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT count(*) as total FROM prendas p JOIN cajas c ON p.cajaId = c.id WHERE UPPER(trim(c.nombre)) LIKE ?`,
      [`%${term}%`]
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
- OP: el usuario menciona un número de OP: código respondes .
- COLOR: el usuario busca por un color específico.
- ESTILO: el usuario busca por nombre que empieza con KH asumes que es estilo de prenda .
- CAJA: el usuario pregunta cuántas prendas hay en una caja específica.
- INVENTARIO: el usuario pide un resumen general del inventario.
- SALUDO: el usuario solo saluda (hola, buenos días, etc).
- LIBRE: cualquier otra cosa que NO sea una búsqueda en la base de datos: preguntas generales, charla casual, dudas sobre cómo usar la app, sugerencias, quejas, agradecimientos, preguntas sobre ti mismo, etc.

Si el tipo es LIBRE, responde directamente la conversación en el campo "valor" (breve, directo, en español). Si es cualquier otro tipo, en "valor" pon el término extraído para buscar en la base de datos.

Responde ÚNICAMENTE con un objeto JSON con este formato exacto, sin explicaciones ni bloques de código markdown. Ejemplos:
{"tipo": "ESTILO", "valor": "CAMISA001"}
{"tipo": "LIBRE", "valor": "¡De nada! Si necesitas algo más, aquí estoy."}`;

    // console.log('[Groq] Enviando solicitud al modelo llama-3.3-70b-versatile.');
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

    if (!response.ok || data.error) {
      console.error('[Groq] Error de API:', JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        error: data.error || data
      }, null, 2));
      return null;
    }

    const rawText = data.choices?.[0]?.message?.content || '';
    //console.log("📥 Texto crudo recibido de Groq:", rawText);

    if (!rawText.trim()) {
      return { tipo: 'LIBRE', valor: 'No pude interpretar tu mensaje. ¿Puedes reformularlo?' };
    }

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
  getSessions: async (db: SQLiteDatabase): Promise<ChatSession[]> => {
    try {
      return await db.getAllAsync<ChatSession>('SELECT * FROM chat_sessions ORDER BY updatedAt DESC');
    } catch (e) {
      console.error('Error fetching chat sessions', e);
      return [];
    }
  },

  createSession: async (db: SQLiteDatabase, title: string = 'Nueva sesión'): Promise<string> => {
    try {
      const id = Date.now().toString();
      await db.runAsync(
        'INSERT INTO chat_sessions (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
        [id, title, Date.now(), Date.now()]
      );
      return id;
    } catch (e) {
      console.error('Error creating chat session', e);
      return Date.now().toString();
    }
  },

  deleteSession: async (db: SQLiteDatabase, sessionId: string): Promise<void> => {
    try {
      await db.runAsync('DELETE FROM chat_history WHERE sessionId = ?', [sessionId]);
      await db.runAsync('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);
    } catch (e) {
      console.error('Error deleting chat session', e);
    }
  },

  updateSessionTitle: async (db: SQLiteDatabase, sessionId: string, title: string): Promise<void> => {
    try {
      await db.runAsync('UPDATE chat_sessions SET title = ?, updatedAt = ? WHERE id = ?', [title, Date.now(), sessionId]);
    } catch (e) {
      console.error('Error updating session title', e);
    }
  },

  getHistoryBySession: async (db: SQLiteDatabase, sessionId: string): Promise<ChatMessage[]> => {
    try {
      const history = await db.getAllAsync<{ id: string, sender: string, text: string, matches_json: string, engineUsed?: string, timestamp: number }>(
        'SELECT * FROM chat_history WHERE sessionId = ? ORDER BY timestamp DESC LIMIT 50',
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
      const matchesStr = msg.matches ? JSON.stringify(msg.matches) : null;
      await db.runAsync(
        'INSERT INTO chat_history (id, sender, text, matches_json, timestamp, sessionId, engineUsed) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [msg.id, msg.sender, msg.text, matchesStr, msg.timestamp, sessionId, msg.engineUsed || null]
      );
      await db.runAsync('UPDATE chat_sessions SET updatedAt = ? WHERE id = ?', [Date.now(), sessionId]);
    } catch (e) {
      console.error('Error saving chat message', e);
    }
  },

  clearHistory: async (db: SQLiteDatabase): Promise<void> => {
    await db.runAsync('DELETE FROM chat_history');
    await db.runAsync('DELETE FROM chat_sessions');
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
