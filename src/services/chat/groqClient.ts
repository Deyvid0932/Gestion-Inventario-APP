import { SQLiteDatabase } from 'expo-sqlite';
import { SettingsService } from '../device/SettingsService';
import { cleanAsterisks } from '../../utils/fuzzyMatching';

export const CLASSIFICATION_SYSTEM_PROMPT = `
Eres Topytop IA, copiloto operativo de Garment Manager.
Tu función es guiar al usuario sobre el uso de la app/taller o extraer parámetros para consultar la base de datos local SQLite.

Debes responder ÚNICAMENTE un objeto JSON válido con esta estructura, sin bloques markdown (\`\`\`json), sin prefacios:

{
  "tipo": "PROCEDIMIENTO" | "DATOS_INVENTARIO",
  "respuestaDirecta": string | null,
  "consulta": {
    "accion": "RESUMEN_GENERAL" | "ESTADO_OP" | "CONTEO_ESPECIFICO" | "BUSQUEDA_PUNTUAL" | null,
    "op": string | null,
    "estilo": string | null,
    "color": string | null,
    "caja": string | null,
    "lote": string | null,
    "soloSinOp": boolean
  }
}

---
REGLAS PARA "tipo": "PROCEDIMIENTO"
Usa este tipo si preguntan cómo funciona la app, qué apartados existen, o reglas del taller.
Genera la respuesta en "respuestaDirecta" (máximo 2 oraciones directas y claras).

Mapa de apartados de Garment Manager:
- Home: Resumen general del inventario, accesos directos y métricas clave del día.
- Lotes: Gestión de lotes de producción y cajas donde se agrupan las prendas.
- Buscar: Buscador instantáneo con filtros por pestañas (Activos, Inactivos, Alarmas) por OP, estilo o color.
- Asistente: Chat operativo para resolver dudas de la app, procedimientos textiles y métricas analíticas.
- Ajustes: Configuración de la app, gestión de permisos y sincronización.

Procedimientos clave:
- Crear o registrar prendas: Entra a un Lote -> abre una Caja -> usa el botón '+' o el escáner de cámara.
- Mover prendas de caja: Mantén presionada la tarjeta de la prenda (pulsación larga).
- Prendas con fallas: Márcalas en estado 'Inactivo' y envíalas a la caja de Mermas/Rechazos.
- Roles: Admin y Editor tienen control de edición y borrado; Viewer solo lectura.

Si preguntan algo ajeno a Garment Manager o taller textil:
Responde "Solo respondo dudas sobre el uso de Garment Manager y control de inventario textil."
"consulta" debe ser null.

---
REGLAS PARA "tipo": "DATOS_INVENTARIO"
Usa este tipo para conteos, estado de OPs o búsqueda de prendas.
"respuestaDirecta" debe ser null. Llena el objeto "consulta" con:
- RESUMEN_GENERAL: totales globales ("¿cuántas prendas hay?", "resumen de cajas").
- ESTADO_OP: avance de una orden ("¿cómo va la OP 4500?").
- CONTEO_ESPECIFICO: prendas con condiciones ("¿cuántas negras hay?", "¿hay prendas sin OP?").
- BUSQUEDA_PUNTUAL: ubicación de prendas específicas ("dónde está khm 035 122").
Extrae TODOS los filtros mencionados (OP, estilo, color, caja y lote), incluso si aparecen juntos.
La caja y el lote son opcionales: busca por OP, estilo, color o descripción en todo el inventario aunque el usuario no conozca la ubicación. Nunca exijas que diga la caja para encontrar una prenda.
"¿Cuántas prendas rojas hay en la caja 3?" es CONTEO_ESPECIFICO, no RESUMEN_GENERAL.
"Busca las prendas rojas de la caja 3" es BUSQUEDA_PUNTUAL.
Si piden solo una caja, usa BUSQUEDA_PUNTUAL con caja; si también mencionan lote, extráelo.
Para preguntas sobre datos del inventario nunca inventes una respuestaDirecta: SQLite dará los resultados reales.
`;

export interface InventoryQuery {
  accion: 'RESUMEN_GENERAL' | 'ESTADO_OP' | 'CONTEO_ESPECIFICO' | 'BUSQUEDA_PUNTUAL' | null;
  op: string | null;
  estilo: string | null;
  color: string | null;
  caja: string | null;
  lote?: string | null;
  soloSinOp: boolean;
}

export interface GroqClassificationResult {
  tipo: 'PROCEDIMIENTO' | 'DATOS_INVENTARIO';
  respuestaDirecta: string | null;
  consulta: InventoryQuery | null;
  modelName: string;
}

// Caché en memoria para clasificaciones frecuentes con TTL de 5 minutos
interface CachedClassification {
  result: GroqClassificationResult;
  expiresAt: number;
}
const classificationCache = new Map<string, CachedClassification>();
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedGroqModels: string[] = [];
let lastGroqModelsFetch = 0;
let lastSuccessfulModel = '';
let remoteRetryAfter = 0;

const CLASSIFICATION_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];

const fetchTextWithin = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(url, { ...init, signal: controller.signal }).then(async response => ({
        response,
        body: await response.text(),
      })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Tiempo de espera agotado'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const getLastSuccessfulModel = (): string => lastSuccessfulModel;

export const getActiveGroqModels = async (cleanKey: string): Promise<string[]> => {
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
          const priority = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
          const sorted = [
            ...priority.filter((p: string) => available.includes(p)),
            ...available.filter((a: string) => !priority.includes(a))
          ];
          cachedGroqModels = sorted;
          lastGroqModelsFetch = now;
          return cachedGroqModels;
        }
      }
    }
  } catch (_) {}

  return [
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b'
  ];
};

/**
 * Fase 1: Clasificación de intención con Groq (con soporte de caché en memoria de 5 min)
 */
export const askGroqToClassify = async (
  db: SQLiteDatabase,
  message: string,
  history: any[] = []
): Promise<GroqClassificationResult | null> => {
  let apiKey = '';
  try {
    apiKey = await SettingsService.getSetting(db, 'groq_api_key', '');
  } catch (_) {}

  if (!apiKey || apiKey.trim() === '') {
    apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
  }

  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) return null;
  if (Date.now() < remoteRetryAfter) return null;

  const previousTurns = history
    .filter((h, index) => !(index === 0 && h.sender === 'user' && h.text === message))
    .slice(0, 4)
    .reverse()
    .map(h => ({
      role: (h.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: h.text
    }));

  // La misma frase puede referirse a otra prenda según la conversación anterior.
  const normalizedKey = JSON.stringify([message.trim().toLowerCase(), previousTurns]);
  const cached = classificationCache.get(normalizedKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.result;

  const messagesPayload = [
    { role: 'system' as const, content: CLASSIFICATION_SYSTEM_PROMPT.trim() },
    ...previousTurns,
    { role: 'user' as const, content: message }
  ];

  // Clasificar no necesita consultar /models: el descubrimiento añadía una ida
  // a la red antes de cada primera respuesta y podía probar modelos sin límite.
  for (const [index, modelName] of CLASSIFICATION_MODELS.entries()) {
    try {
      const { response, body: responseText } = await fetchTextWithin(
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
            temperature: 0.2,
            max_completion_tokens: 512,
            reasoning_effort: 'low',
            response_format: { type: 'json_object' }
          })
        },
        index === 0 ? 4500 : 3500
      );

      if (!response.ok) {
        console.warn(`[Groq] Clasificación con ${modelName}: HTTP ${response.status}`);
        continue;
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        continue;
      }

      let rawText = data.choices?.[0]?.message?.content?.trim() || '';
      rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      rawText = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        continue;
      }

      const tipo: 'PROCEDIMIENTO' | 'DATOS_INVENTARIO' =
        parsed.tipo === 'PROCEDIMIENTO' ? 'PROCEDIMIENTO' : 'DATOS_INVENTARIO';

      let consulta: InventoryQuery | null = null;
      if (tipo === 'DATOS_INVENTARIO' && parsed.consulta) {
        consulta = {
          accion: parsed.consulta.accion || 'RESUMEN_GENERAL',
          op: parsed.consulta.op || null,
          estilo: parsed.consulta.estilo || null,
          color: parsed.consulta.color || null,
          caja: parsed.consulta.caja || null,
          lote: parsed.consulta.lote || null,
          soloSinOp: Boolean(parsed.consulta.soloSinOp)
        };
      }

      lastSuccessfulModel = modelName;
      remoteRetryAfter = 0;
      const finalResult: GroqClassificationResult = {
        tipo,
        respuestaDirecta: parsed.respuestaDirecta || null,
        consulta,
        modelName
      };

      // Guardar en caché por 5 minutos
      classificationCache.set(normalizedKey, {
        result: finalResult,
        expiresAt: now + CACHE_TTL_MS
      });

      return finalResult;
    } catch (err) {
      const timedOut = err instanceof Error && err.message === 'Tiempo de espera agotado';
      const reason = timedOut ? 'agotó el tiempo de espera' : 'falló la conexión';
      console.warn(`[Groq] ${modelName} ${reason}; ${timedOut ? 'usando respaldo local' : 'probando otro modelo'}.`);
      // Si la red ya agotó el tiempo, un modelo más grande solo añadiría espera.
      if (timedOut) break;
    }
  }

  // Si la red o ambos modelos fallan, los próximos mensajes usan el respaldo
  // local sin repetir inmediatamente la espera completa.
  remoteRetryAfter = Date.now() + 15_000;
  return null;
};

/**
 * Fase de Síntesis Ligera (Ultra concisa y sin alucinaciones)
 */
export const synthesizeWithGroq = async (
  cleanKey: string,
  modelName: string,
  userMessage: string,
  factsText: string
): Promise<string | null> => {
  try {
    const systemPrompt = `Eres Topytop IA, Asistente Operativo Textil.
Sintetiza la respuesta en 1 o 2 oraciones concisas y amables usando EXCLUSIVAMENTE los datos del inventario provistos.
Prohibido inventar datos, números o códigos. No uses asteriscos (*) ni michis (#).`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Pregunta: "${userMessage}"\nDatos reales:\n${factsText}\nRespuesta:` }
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return cleanAsterisks(content);
    }
  } catch (_) {}
  return null;
};
