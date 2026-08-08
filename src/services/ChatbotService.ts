import { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '../database/supabase';
import { SearchResult } from '../utils/nlpEngine';
import { ChatSession } from '../types';

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
  const match = text.match(/\b(?:op|o\/p|orden|order)?\s*[:#-]?\s*(\d{5,8})\b/i);
  return match ? match[1] : null;
};

const extractColor = (text: string): string | null => {
  const colors = [
    'NEGRO', 'BLANCO', 'ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'GRIS',
    'MARRON', 'ROSADO', 'PURPURA', 'CELESTE', 'BEIGE', 'MARINO',
    'NAVY', 'BLACK', 'WHITE', 'RED', 'BLUE', 'GREEN'
  ];

  const upper = text.toUpperCase();
  for (const c of colors) {
    if (upper.includes(c)) return c;
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
  if (!apiKey) return null;

  const prompt = `
Eres la IA clasificadora de intenciones para Topytop Kith.
Clasifica la consulta del usuario.
Historial reciente:
${history.map(h => `${h.sender}: ${h.text}`).join('\n')}

Usuario: "${message}"

Responde UNICAMENTE en JSON con formato:
{"tipo": "SALUDO" | "CONVERSACION" | "LIBRE" | "OP" | "COLOR" | "ESTILO" | "CAJA" | "INVENTARIO", "valor": "extraido_o_respuesta"}
`;

  try {
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
