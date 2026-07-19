import { SQLiteDatabase } from 'expo-sqlite';
import { SearchResult, extractSearchTerms, rankResults } from '../utils/nlpEngine';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  matches?: SearchResult[];
  timestamp: number;
}

export const ChatbotService = {
  getHistory: async (db: SQLiteDatabase): Promise<ChatMessage[]> => {
    try {
      const history = await db.getAllAsync<{ id: string, sender: string, text: string, matches_json: string, timestamp: number }>(
        'SELECT * FROM chat_history ORDER BY timestamp DESC LIMIT 50'
      );
      
      return history.map(row => ({
        id: row.id,
        sender: row.sender as 'user' | 'bot',
        text: row.text,
        matches: row.matches_json ? JSON.parse(row.matches_json) : undefined,
        timestamp: row.timestamp
      }));
    } catch (e) {
      console.error('Error fetching chat history', e);
      return [];
    }
  },

  clearHistory: async (db: SQLiteDatabase): Promise<void> => {
    await db.runAsync('DELETE FROM chat_history');
  },

  saveMessage: async (db: SQLiteDatabase, msg: ChatMessage): Promise<void> => {
    try {
      const matchesStr = msg.matches ? JSON.stringify(msg.matches) : null;
      await db.runAsync(
        'INSERT INTO chat_history (id, sender, text, matches_json, timestamp) VALUES (?, ?, ?, ?, ?)',
        [msg.id, msg.sender, msg.text, matchesStr, msg.timestamp]
      );
    } catch (e) {
      console.error('Error saving chat message', e);
    }
  },

  searchAndRespond: async (db: SQLiteDatabase, message: string): Promise<{ text: string, matches: SearchResult[] }> => {
    
    // 1. Manejo de saludos o mensajes cortos
    const lowerMessage = message.toLowerCase().trim();
    if (['hola', 'hey', 'buenas', 'saludos'].includes(lowerMessage)) {
      return {
        text: "¡Hola! Soy tu asistente de inventario. Dime qué prenda buscas (ej. 'dónde está la estilo KHM ...').",
        matches: []
      };
    }

    // 2. Extraer keywords
    const terms = extractSearchTerms(message);
    if (terms.length === 0) {
      return { 
        text: "No entendí muy bien qué buscas. Intenta decirme el OP, estilo o color.",
        matches: []
      };
    }

    // 3. Buscar todo y aplicar Levenshtein
    const candidates = await db.getAllAsync<SearchResult>(`
      SELECT 
        p.id, p.op, p.estilo, p.color, p.estado, p.fotoUri, p.cajaId,
        c.nombre as cajaNombre,
        i.nombre as inventarioNombre,
        i.id as inventarioId
      FROM prendas p
      JOIN cajas c ON p.cajaId = c.id
      JOIN inventarios i ON c.inventarioId = i.id
    `);

    const topMatches = rankResults(candidates, terms);

    if (topMatches.length === 0) {
      return {
        text: "Mmm... no encontré ninguna coincidencia en la base de datos para tu búsqueda.",
        matches: []
      };
    }

    // 4. Llamada a Gemini usando Fetch (seguro para React Native)
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return {
        text: "¡Encontré estas prendas! (Gemini API Key no detectada)",
        matches: topMatches
      };
    }

    try {
      const contextData = topMatches.map((m, i) => 
        `[#${i+1}] OP: ${m.op || 'Sin OP'}, Estilo: ${m.estilo}, Color: ${m.color}, Ubicación: Caja '${m.cajaNombre}' en Lote '${m.inventarioNombre}'`
      ).join('\n');

      const prompt = `
Eres un asistente de inventario amable.
Pregunta del usuario: "${message}"

Hemos encontrado estas prendas en la base de datos (Top 5 más cercanas):
${contextData}

Responde de forma MUY breve (1-2 frases). 
- Si hay una sola prenda en la lista, di que encontraste la coincidencia exacta y dónde está.
- Si hay varias prendas, di que no encontraste una coincidencia exacta pero que estas son las opciones más similares o cercanas.
- No listes las prendas con viñetas, yo mostraré tarjetas interactivas debajo de tu respuesta.
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 150
          }
        })
      });

      const data = await response.json();
      const botText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      return {
        text: botText || "¡Encontré estas prendas!",
        matches: topMatches
      };

    } catch (e) {
      console.error("Gemini API Error:", e);
      return {
        text: "¡Aquí están las coincidencias! (Hubo un problema de conexión con el bot)",
        matches: topMatches
      };
    }
  }
};
