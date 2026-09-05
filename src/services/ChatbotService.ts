import { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '../database/supabase';
import { SearchResult } from '../utils/nlpEngine';
import { ChatSession } from '../types';
import { SettingsService } from './SettingsService';

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  matches?: SearchResult[];
  engineUsed?: 'ia' | 'local';
  timestamp: number;
}

const BASE_QUERY = `
  SELECT 
    p.id,
    p.cajaId as cajaId,
    p.op,
    p.estilo,
    p.color,
    p.fotoUri,
    p.fotoUri2,
    p.estado,
    c.nombre as cajaNombre,
    i.nombre as inventarioNombre
  FROM prendas p
  JOIN cajas c ON p.cajaId = c.id
  JOIN inventarios i ON c.inventarioId = i.id
`;

const extractOP = (text: string): string | null => {
  const match = text.match(/\b(?:op|o\/p)?\s*[:#-]?\s*(\d{4,10})\b/i);
  return match ? match[1] : null;
};

const executeSearch = async (
  db: SQLiteDatabase,
  tipo: string,
  valor: string,
  terminos?: string[]
): Promise<{ text: string; matches: SearchResult[] }> => {
  if (tipo === 'OP') {
    const opVal = valor.replace(/\D/g, '') || valor;
    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE (REPLACE(p.op, ' ', '') LIKE ? OR p.op LIKE ?) LIMIT 20`,
      [`%${opVal}%`, `%${opVal}%`]
    );
    if (rows.length === 0) return { text: `No se encontraron prendas para la OP "${valor}".`, matches: [] };
    return { text: `Encontré ${rows.length} prendas para la OP "${valor}":`, matches: rows };
  }

  if (tipo === 'COLOR') {
    const searchTerms = Array.from(
      new Set(
        [valor, ...(terminos || [])]
          .filter(Boolean)
          .map(t => t.trim().toUpperCase())
      )
    );

    const placeholders = searchTerms.map(() => 'UPPER(p.color) LIKE ?').join(' OR ');
    const params = searchTerms.map(t => `%${t}%`);
  
    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE (${placeholders}) LIMIT 20`,
      params
    );
    if (rows.length === 0) return { text: `No se encontraron prendas del color "${valor}".`, matches: [] };
    return { text: `Encontré ${rows.length} prendas del color "${valor}":`, matches: rows };
  }

  if (tipo === 'ESTILO') {
    const cleanStyle = valor.trim().toUpperCase();
    const noSpaces = cleanStyle.replace(/[\s\-_]/g, '');

    const rows = await db.getAllAsync<SearchResult>(
      `${BASE_QUERY} WHERE (
        REPLACE(REPLACE(REPLACE(UPPER(p.estilo), ' ', ''), '-', ''), '_', '') LIKE ?
        OR UPPER(p.estilo) LIKE ?
      ) LIMIT 20`,
      [`%${noSpaces}%`, `%${cleanStyle}%`]
    );

    if (rows.length === 0) {
      const fallbackRows = await db.getAllAsync<SearchResult>(
        `${BASE_QUERY} WHERE (
          REPLACE(p.op, ' ', '') LIKE ?
          OR UPPER(p.color) LIKE ?
          OR UPPER(p.estilo) LIKE ?
        ) LIMIT 20`,
        [`%${noSpaces}%`, `%${cleanStyle}%`, `%${cleanStyle}%`]
      );
      if (fallbackRows.length > 0) {
        return { text: `Encontré ${fallbackRows.length} prendas que coinciden con "${valor}":`, matches: fallbackRows };
      }
      return { text: `No se encontraron prendas con el estilo "${valor}".`, matches: [] };
    }
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

const searchLocal = async (db: SQLiteDatabase, message: string): Promise<{ text: string; matches: SearchResult[] }> => {
  const input = message.trim();
  if (!input) {
    return { text: '¿Qué estilo, OP o color deseas buscar?', matches: [] };
  }

  const op = extractOP(input);
  if (op && (/^\d{4,10}$/.test(input) || /op/i.test(input))) {
    return executeSearch(db, 'OP', op);
  }

  const cleanUpper = input.toUpperCase();
  const colorRows = await db.getAllAsync<SearchResult>(
    `${BASE_QUERY} WHERE UPPER(p.color) LIKE ? LIMIT 20`,
    [`%${cleanUpper}%`]
  );
  if (colorRows.length > 0) {
    return { text: `Encontré ${colorRows.length} prendas del color "${input}":`, matches: colorRows };
  }

  return executeSearch(db, 'ESTILO', input);
};

let cachedGroqModels: string[] = [];
let lastGroqModelsFetch = 0;

const getActiveGroqModels = async (cleanKey: string): Promise<string[]> => {
  const now = Date.now();
  if (cachedGroqModels.length > 0 && now - lastGroqModelsFetch < 1000 * 60 * 30) {
    return cachedGroqModels;
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        Accept: 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data)) {
        const available = data.data
          .map((m: any) => m.id)
          .filter((id: string) => !id.includes('whisper') && !id.includes('safeguard') && !id.includes('guard'));

        if (available.length > 0) {
          cachedGroqModels = available;
          lastGroqModelsFetch = now;
          return cachedGroqModels;
        }
      }
    }
  } catch (_) {}

  return [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
    'qwen-2.5-32b'
  ];
};

const askGroqToClassify = async (
  db: SQLiteDatabase,
  message: string,
  history: ChatMessage[]
): Promise<{ tipo: string; valor: string; terminos?: string[] } | null> => {
  let apiKey = '';
  try {
    apiKey = await SettingsService.getSetting(db, 'groq_api_key', '');
  } catch (_) {}

  if (!apiKey || apiKey.trim() === '') {
    apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
  }

  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) return null;

  const systemContent = `Eres el Asistente Inteligente de Inventario para Topytop Kith.
Tu objetivo es responder de manera amable, coherente, precisa y útil.

Debes responder SIEMPRE en formato JSON válido con esta estructura:
{
  "tipo": "SALUDO" | "CONVERSACION" | "OP" | "ESTILO" | "COLOR" | "CAJA" | "INVENTARIO",
  "valor": "tu respuesta conversacional elocuente O el término exacto a buscar",
  "terminos": ["sinonimo1", "sinonimo2"]
}

Reglas de clasificación:
1. "OP": Si el usuario busca o escribe un número de orden u OP (ej: "3324738", "OP 12345"). En "valor" pon los dígitos.
2. "ESTILO": Si el usuario busca un código de estilo o prenda textil (ej: "KHM 030 039", "KHK 001", "PO-100"). En "valor" pon el código.
3. "COLOR": Si el usuario busca prendas por color (ej: "black", "negro", "azul"). En "valor" pon el color y en "terminos" sus traducciones.
4. "CAJA": Si el usuario pregunta por una caja (ej: "Caja 1"). En "valor" pon el nombre de la caja.
5. "INVENTARIO": Si pide un resumen del inventario. En "valor" pon "general".
6. "SALUDO": Si el usuario saluda (ej: "Hola", "Buenos días", "Alo"). En "valor" da un saludo cordial invitando a consultar el inventario.
7. "CONVERSACION": Para cualquier otra frase, comentario, charla o pregunta libre (ej: "Perú es clave", "¿Cómo estás?", etc.). En "valor" genera una respuesta coherente, inteligente y contextual.`;

  // Historial previo en formato nativo de chat de OpenAI/Groq
  const previousTurns = history
    .filter(h => h.text !== message)
    .slice(0, 6)
    .reverse()
    .map(h => ({
      role: (h.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: h.text
    }));

  const messagesPayload = [
    { role: 'system' as const, content: systemContent },
    ...previousTurns,
    { role: 'user' as const, content: message }
  ];

  const models = await getActiveGroqModels(cleanKey);

  for (const modelName of models) {
    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${cleanKey}`
          },
          body: JSON.stringify({
            model: modelName,
            messages: messagesPayload,
            temperature: 0.6,
            max_tokens: 500
          })
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        //console.error(`[Groq] ${modelName} HTTP ${response.status}:`, responseText);
        continue;
      }

      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        console.error(`[Groq] ${modelName} JSON parse falló. Respuesta cruda:`, responseText);
        continue;
      }

      const rawText = data.choices?.[0]?.message?.content?.trim() || '';
      console.log(`[Groq] ${modelName} respuesta del modelo:`, rawText);

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
       // console.error(`[Groq] ${modelName} No encontró JSON en la respuesta:`, rawText);
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const parsedValor = parsed.valor ?? parsed.mensaje ?? parsed.response ?? parsed.respuesta ?? parsed.text ?? parsed.texto ?? parsed.extraido ?? message;
      const parsedTipo = (parsed.tipo ?? parsed.type ?? (parsed.op ? 'OP' : parsed.color ? 'COLOR' : parsed.estilo ? 'ESTILO' : 'LIBRE')).toUpperCase();
      const parsedTerminos = Array.isArray(parsed.terminos) ? parsed.terminos : undefined;

      return {
        tipo: parsedTipo,
        valor: String(parsedValor || message),
        terminos: parsedTerminos
      };

    } catch (err) {
    console.error(`[Groq] ${modelName} excepción de red:`, err);
    }
  }

  console.error('[Groq] Los 5 modelos fallaron, usando motor local');

  return null;
};

export const ChatbotService = {
  getSessions: async (db: SQLiteDatabase, userId?: string | null): Promise<ChatSession[]> => {
    try {
      if (userId) {
        await db.runAsync(
          `UPDATE chat_sessions SET user_id = ?, sync_status = 'PENDING' WHERE user_id IS NULL OR user_id = ''`,
          [userId]
        );
        return await db.getAllAsync<ChatSession>(
          'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updatedAt DESC',
          [userId]
        );
      } else {
        return await db.getAllAsync<ChatSession>(
          'SELECT * FROM chat_sessions WHERE (user_id IS NULL OR user_id = "") ORDER BY updatedAt DESC'
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

  deleteSession: async (db: SQLiteDatabase, sessionId: string, _userId?: string | null): Promise<void> => {
    try {
      await db.runAsync('DELETE FROM chat_history WHERE sessionId = ?', [sessionId]);
      await db.runAsync('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);

      await db.runAsync(
        "INSERT OR REPLACE INTO pending_deletions (id, tableName, recordId, createdAt) VALUES (?, 'chat_sessions', ?, ?)",
        [Date.now().toString() + '_' + sessionId, sessionId, new Date().toISOString()]
      ).catch(() => {});

      try { await supabase.from('chat_messages').delete().eq('session_id', sessionId); } catch (_) {}
      try { await supabase.from('chat_sessions').delete().eq('id', sessionId); } catch (_) {}
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
        'SELECT * FROM chat_history WHERE sessionId = ? ORDER BY timestamp DESC LIMIT 100',
        [sessionId]
      );
      return history.map(row => {
        let parsedMatches;
        if (row.matches_json) {
          try {
            parsedMatches = typeof row.matches_json === 'string' ? JSON.parse(row.matches_json) : row.matches_json;
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

  clearHistory: async (db: SQLiteDatabase, userId?: string | null): Promise<void> => {
    try {
      if (userId) {
        await supabase.from('chat_messages').delete().neq('id', '');
        await supabase.from('chat_sessions').delete().neq('id', '');
      }
      await db.runAsync('DELETE FROM chat_history');
      await db.runAsync('DELETE FROM chat_sessions');
    } catch (e) {
      console.error('Error clearing history', e);
    }
  },

  searchAndRespond: async (db: SQLiteDatabase, message: string, sessionId: string): Promise<{ text: string, matches: SearchResult[], engineUsed: 'ia' | 'local' }> => {
    const history = await ChatbotService.getHistoryBySession(db, sessionId);
    const classification = await askGroqToClassify(db, message, history.slice(0, 10));

    if (classification) {
      if (classification.tipo === 'SALUDO') {
        const greeting = (classification.valor && classification.valor !== message && classification.valor.trim() !== '')
          ? classification.valor
          : '¡Hola! 👋 Soy tu asistente de inventario Topytop Kith. Puedes buscar por estilo, OP o color. ¿Qué necesitas?';
        return { text: greeting, matches: [], engineUsed: 'ia' };
      }

      if (classification.tipo === 'LIBRE' || classification.tipo === 'CONVERSACION') {
        return { text: classification.valor, matches: [], engineUsed: 'ia' };
      }

      const searchRes = await executeSearch(db, classification.tipo, classification.valor, classification.terminos);
      return { ...searchRes, engineUsed: 'ia' };
    }

    const localRes = await searchLocal(db, message);
    return { ...localRes, engineUsed: 'local' };
  }
};
