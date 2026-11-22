import { SQLiteDatabase } from 'expo-sqlite';
import { SettingsService } from '../device/SettingsService';
import { cleanAsterisks } from '../../utils/fuzzyMatching';

export const CLASSIFICATION_SYSTEM_PROMPT = `
Eres Topytop IA, asistente inteligente y copiloto operativo de Garment Manager y control de inventario textil de Topytop.
Tu función es responder con inteligencia, naturalidad y empatía a las consultas del usuario, guiarlo sobre el uso de la app o taller textil, o extraer parámetros para consultar la base de datos local SQLite.

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
Usa este tipo para:
1. Preguntas sobre el uso de Garment Manager y sus apartados:
   - Home: Resumen general del inventario, accesos directos y métricas clave del día.
   - Lotes: Gestión de lotes de producción y cajas de almacén.
   - Buscar: Buscador instantáneo con filtros por pestañas (Activos, Inactivos, Alarmas) por OP, estilo o color.
   - Asistente: Chat operativo con IA para dudas, procedimientos textiles y análisis.
   - Ajustes: Configuración de la app, temas, permisos y sincronización.
2. Procedimientos operativos del taller:
   - Registrar prendas: Entra a un Lote -> abre una Caja -> usa el botón 'Nuevo' o el escáner OCR de cámara.
   - Mover prendas de caja: Mantén presionada la tarjeta de la prenda (pulsación larga).
   - Prendas con fallas: Márcalas en estado 'Inactivo' y trasládalas a la caja de Mermas/Rechazos.
   - Exportar Excel o generar PDF: Selecciona prendas con toque largo o checkbox y usa los botones de la barra superior.
   - Roles: Admin y Editor tienen control de edición y borrado; Viewer solo lectura.
3. Consultas sobre procesos textiles, calidad o laboratorio:
   - Ensayos físicos (ASTM D3776 densidad, peso BW/AW, pilling, abrasión).
   - Solideces (AATCC TM61 lavado, AATCC TM8 frote, transpiración, luz, pH).
   - Cambio dimensional y lavado (AATCC TM124 apariencia después del lavado, ciclos).
   - Estampado, telas, confección y acabados.
4. Saludos, agradecimientos, conversación natural y preguntas al azar/cotidianas:
   - Responde SIEMPRE de forma inteligente, cálida, concisa (1 a 3 oraciones) y con tono profesional como Topytop IA.
   - NUNCA respondas con frases robóticas de rechazo ("Solo respondo dudas de inventario..."). Responde amablemente y ofrece tu ayuda.

"consulta" debe ser null.

---
REGLAS PARA "tipo": "DATOS_INVENTARIO"
Usa este tipo EXCLUSIVAMENTE cuando el usuario solicita consultar datos reales del inventario actual en SQLite:
"respuestaDirecta" debe ser null. Llena el objeto "consulta" con:
- RESUMEN_GENERAL: totales globales ("¿cuántas prendas hay?", "resumen de cajas", "total del inventario").
- ESTADO_OP: avance o ubicación de una orden ("¿cómo va la OP 316316?").
- CONTEO_ESPECIFICO: prendas con condiciones ("¿cuántas prendas negras hay?", "¿hay prendas sin OP?").
- BUSQUEDA_PUNTUAL: ubicación de prendas específicas ("dónde está la prenda TH6682", "busca la OP 316316").
Extrae los filtros mencionados: OP, estilo, color, caja y lote.
Nunca inventes una respuestaDirecta para datos de inventario: SQLite proveerá los datos verídicos.
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

interface CachedClassification {
  result: GroqClassificationResult;
  expiresAt: number;
}
const classificationCache = new Map<string, CachedClassification>();
const CACHE_TTL_MS = 5 * 60 * 1000;

let lastSuccessfulModel = '';
let remoteRetryAfter = 0;
let dynamicGroqModelsCache: string[] | null = null;

const CLASSIFICATION_MODELS = [
  'deepseek-r1-distill-llama-70b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
];

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

/**
 * Descubre modelos de texto activos directamente desde la API de Groq si los predeterminados cambian.
 */
const discoverActiveGroqModels = async (cleanKey: string): Promise<string[]> => {
  if (dynamicGroqModelsCache && dynamicGroqModelsCache.length > 0) {
    return dynamicGroqModelsCache;
  }
  try {
    const { response, body } = await fetchTextWithin(
      'https://api.groq.com/openai/v1/models',
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${cleanKey}`,
        },
      },
      3000
    );
    if (!response.ok) return [];
    const parsed = JSON.parse(body);
    const list: string[] = (parsed?.data || [])
      .filter((m: any) => m?.id && m?.active !== false)
      .map((m: any) => String(m.id))
      .filter(
        (id: string) =>
          !id.includes('whisper') &&
          !id.includes('tts') &&
          !id.includes('guard') &&
          !id.includes('vision') &&
          !id.includes('playai')
      );
    if (list.length > 0) {
      dynamicGroqModelsCache = list;
    }
    return list;
  } catch {
    return [];
  }
};

const tryClassifyWithModel = async (
  cleanKey: string,
  modelName: string,
  messagesPayload: any[],
  timeoutMs: number
): Promise<GroqClassificationResult | null> => {
  const isReasoningModel = modelName.includes('deepseek-r1') || modelName.includes('qwq');
  const bodyPayload: any = {
    model: modelName,
    messages: messagesPayload,
    temperature: 0.3,
    max_tokens: 512,
    ...(isReasoningModel ? {} : { response_format: { type: 'json_object' } }),
  };

  const { response, body: responseText } = await fetchTextWithin(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${cleanKey}`,
      },
      body: JSON.stringify(bodyPayload),
    },
    timeoutMs
  );

  if (!response.ok) {
    console.warn(`[Groq] Clasificación con ${modelName}: HTTP ${response.status}`);
    return null;
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    return null;
  }

  let rawText = data.choices?.[0]?.message?.content?.trim() || '';
  rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  rawText = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
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
      soloSinOp: Boolean(parsed.consulta.soloSinOp),
    };
  }

  return {
    tipo,
    respuestaDirecta: parsed.respuestaDirecta || null,
    consulta,
    modelName,
  };
};

/**
 * Fase 1: Clasificación de intención con Groq usando los modelos disponibles
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

  const previousTurns = history
    .filter((h, index) => !(index === 0 && h.sender === 'user' && h.text === message))
    .slice(0, 4)
    .reverse()
    .map(h => ({
      role: (h.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: h.text,
    }));

  const normalizedKey = JSON.stringify([message.trim().toLowerCase(), previousTurns]);
  const cached = classificationCache.get(normalizedKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.result;

  if (cleanKey && now >= remoteRetryAfter) {
    const messagesPayload = [
      { role: 'system' as const, content: CLASSIFICATION_SYSTEM_PROMPT.trim() },
      ...previousTurns,
      { role: 'user' as const, content: message },
    ];

    const triedModels = new Set<string>();

    for (const [index, modelName] of CLASSIFICATION_MODELS.entries()) {
      triedModels.add(modelName);
      try {
        const finalResult = await tryClassifyWithModel(
          cleanKey,
          modelName,
          messagesPayload,
          index === 0 ? 4500 : 3500
        );
        if (finalResult) {
          lastSuccessfulModel = modelName;
          remoteRetryAfter = 0;
          classificationCache.set(normalizedKey, {
            result: finalResult,
            expiresAt: now + CACHE_TTL_MS,
          });
          return finalResult;
        }
      } catch (err) {
        const timedOut = err instanceof Error && err.message === 'Tiempo de espera agotado';
        const reason = timedOut ? 'agotó el tiempo de espera' : 'falló la conexión';
        console.warn(`[Groq] ${modelName} ${reason}.`);
        if (timedOut) {
          remoteRetryAfter = Date.now() + 15_000;
          return null;
        }
      }
    }

    // Si los modelos prioritarios no estuvieron disponibles, consultar modelos activos en Groq
    const discovered = await discoverActiveGroqModels(cleanKey);
    for (const modelName of discovered) {
      if (triedModels.has(modelName)) continue;
      try {
        const finalResult = await tryClassifyWithModel(cleanKey, modelName, messagesPayload, 3500);
        if (finalResult) {
          lastSuccessfulModel = modelName;
          remoteRetryAfter = 0;
          classificationCache.set(normalizedKey, {
            result: finalResult,
            expiresAt: now + CACHE_TTL_MS,
          });
          return finalResult;
        }
      } catch {
        break;
      }
    }
  }

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
          { role: 'user', content: `Pregunta: "${userMessage}"\nDatos reales:\n${factsText}\nRespuesta:` },
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      let content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        return cleanAsterisks(content);
      }
    }
  } catch (_) {}
  return null;
};
