import { ExtractedGarmentOCR } from '../../utils/ocrParser';

export interface RawGarmentAI {
  op?: string;
  style?: string;
  color?: string;
}

// Modelos oficiales de visión de Google AI priorizados por máxima velocidad y menor latencia
const PRIMARY_VISION_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

let cachedWorkingModel: string = 'gemini-flash-lite-latest';
let cachedDiscoveredModels: string[] | null = null;

const getApiKey = (): string => {
  return (process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_CAMERA || '').trim();
};

/**
 * Consulta la lista de modelos de Google únicamente si todos los modelos primarios fallan (Lazy Fallback)
 */
async function getFallbackDiscoveredModels(apiKey: string): Promise<string[]> {
  if (cachedDiscoveredModels && cachedDiscoveredModels.length > 0) {
    return cachedDiscoveredModels;
  }

  const excludedKeywords = ['tts', 'embedding', 'audio', 'realtime', 'imagen', 'custom', 'transcribe', 'robotics', 'clip', 'banana', 'deep-research', 'gemma', 'lyria'];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const visionModels: string[] = data.models
          .filter((m: any) => {
            const name = (m.name || '').toLowerCase();
            const supportsGenerate = m.supportedGenerationMethods?.includes('generateContent');
            const isExcluded = excludedKeywords.some(kw => name.includes(kw));
            return supportsGenerate && !isExcluded;
          })
          .map((m: any) => m.name?.replace(/^models\//, ''))
          .filter(Boolean)
          .sort((a: string, b: string) => {
            const aScore = a.includes('lite') ? 3 : a.includes('flash') ? 2 : 1;
            const bScore = b.includes('lite') ? 3 : b.includes('flash') ? 2 : 1;
            return bScore - aScore;
          });

        if (visionModels.length > 0) {
          cachedDiscoveredModels = visionModels;
          return visionModels;
        }
      }
    }
  } catch (e) {
    console.warn('[GeminiVisionService] ⚠️ Error al autodescubrir modelos:', e);
  }

  return PRIMARY_VISION_MODELS;
}

export const GeminiVisionService = {
  /**
   * Verifica si la API key de Gemini está presente en el entorno.
   */
  isConfigured: (): boolean => {
    const key = getApiKey();
    const configured = key.length > 0;
    console.log(`[GeminiVisionService] 🔑 isConfigured: ${configured ? 'SÍ (Key detectada: ' + key.substring(0, 8) + '...)' : 'NO (Sin API Key configurada)'}`);
    return configured;
  },

  /**
   * Envía la imagen a Gemini Vision para extraer prendas manuscritas/impresas.
   */
  recognizeGarments: async (base64Image: string, boxId: string): Promise<ExtractedGarmentOCR[]> => {
    const apiKey = getApiKey();

    if (!apiKey) {
      console.error('[GeminiVisionService] ❌ Error: API Key de Gemini no configurada');
      throw new Error('API Key de Gemini no configurada');
    }

    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    console.log(`[GeminiVisionService] 📸 Imagen lista (base64: ${cleanBase64.length} chars) para caja: ${boxId}`);

    const promptText = `Eres un asistente especializado en digitalización de inventario textil para Garment Manager.
Tu objetivo es leer etiquetas manuscritas o impresas de prendas de ropa a partir de la foto proporcionada.

Para cada prenda identificada en la etiqueta, extrae:
1. "op": El número de orden de producción (número de 4 a 10 dígitos). Si no existe o no es legible, devuelve "".
2. "style": Código de estilo (generalmente inicia con 'KH', ej: 'KHA 035 122', 'KHM 012 30', 'KHP...'). Si en la parte numérica hay letras parecidas (como O/Q en vez de 0, o I/L en vez de 1), corrígelas a números.
3. "color": Nombre del color de la prenda (ej: "NEGRO", "BLANCO", "AZUL", "ROJO", "GRIS", etc.). Si no tiene o no es legible, devuelve "S/C".

Debes responder ÚNICAMENTE un array JSON válido con los elementos en el orden de arriba hacia abajo como aparecen en la etiqueta. No agregues texto introductorio, ni bloques markdown (\`\`\`json):
[
  { "op": "12345", "style": "KHA 035 122", "color": "AZUL" }
]
Si no se detecta ninguna prenda o la imagen está vacía/ilegible, responde: []`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    // Priorizar directamente el modelo funcional en caché sin hacer llamadas HTTP intermedias
    const modelsToTry: string[] = [cachedWorkingModel];
    PRIMARY_VISION_MODELS.forEach(m => {
      if (!modelsToTry.includes(m)) {
        modelsToTry.push(m);
      }
    });

    let lastError: any = null;

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      try {
        console.log(`[GeminiVisionService] ⚡ [${i + 1}/${modelsToTry.length}] Contactando directamente a: ${model}...`);
        const startTime = Date.now();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const elapsedMs = Date.now() - startTime;
        console.log(`[GeminiVisionService] 📥 ${model} respondió en ${elapsedMs}ms con status: ${response.status}`);

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[GeminiVisionService] ⚠️ Modelo ${model} respondió con error (${response.status}):`, errText.substring(0, 180));
          lastError = new Error(`Gemini API error (${response.status}): ${errText}`);
          continue; // Probar inmediatamente el siguiente modelo primario
        }

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        console.log(`[GeminiVisionService] ✅ ¡ÉXITO! Modelo ${model} completó reconocimiento en ${elapsedMs}ms.`);

        // Guardar el modelo exitoso como preferido
        cachedWorkingModel = model;

        if (!rawContent || rawContent.trim() === '') {
          console.warn('[GeminiVisionService] ⚠️ La respuesta de Gemini vino vacía.');
          return [];
        }

        // Limpiar posibles bloques ```json si el modelo los incluyó
        const sanitized = rawContent.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const parsed: RawGarmentAI[] = JSON.parse(sanitized);

        if (!Array.isArray(parsed)) {
          console.warn('[GeminiVisionService] ⚠️ La respuesta de Gemini no es un array:', sanitized);
          return [];
        }

        const validGarments: ExtractedGarmentOCR[] = parsed
          .filter(item => item && (item.style || item.op))
          .map((item, index) => {
            const rawStyle = (item.style || '').trim().toUpperCase();
            const cleanOp = (item.op || '').trim();
            const rawColor = (item.color || 'S/C').trim().toUpperCase();

            return {
              id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
              box_id: boxId,
              op: cleanOp,
              style: rawStyle,
              color: rawColor,
              status: 1,
              created_at: new Date().toISOString(),
            };
          });

        console.log(`[GeminiVisionService] 🎯 Prendas estructuradas y listas: ${validGarments.length}`);
        return validGarments;
      } catch (callErr: any) {
        console.warn(`[GeminiVisionService] ⚠️ Excepción al consultar ${model}:`, callErr.message || callErr);
        lastError = callErr;
      }
    }

    // Si los primarios fallaron, como último recurso intentar autodescubrimiento perezoso
    try {
      console.log('[GeminiVisionService] 🔄 Modelos primarios no disponibles. Intentando descubrimiento dinámico de respaldo...');
      const discovered = await getFallbackDiscoveredModels(apiKey);
      for (const model of discovered) {
        if (modelsToTry.includes(model)) continue;
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          if (response.ok) {
            const data = await response.json();
            const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawContent) {
              cachedWorkingModel = model;
              const sanitized = rawContent.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
              const parsed: RawGarmentAI[] = JSON.parse(sanitized);
              return (Array.isArray(parsed) ? parsed : []).map((item, index) => ({
                id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
                box_id: boxId,
                op: (item.op || '').trim(),
                style: (item.style || '').trim().toUpperCase(),
                color: (item.color || 'S/C').trim().toUpperCase(),
                status: 1,
                created_at: new Date().toISOString(),
              }));
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    throw lastError || new Error('No se pudo procesar la imagen con ningún modelo de Gemini Vision');
  },
};
