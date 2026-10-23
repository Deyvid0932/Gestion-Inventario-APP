import { ExtractedGarmentOCR } from '../../utils/ocrParser';
import { processOCRText } from '../../utils/ocrParser';

const TEXT_MODEL = 'gemini-3.5-flash-lite';
const REQUEST_TIMEOUT_MS = 3000;

const getApiKey = (): string => {
  return (process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_CAMERA || '').trim();
};

const SYSTEM_PROMPT = `Extrae prendas del texto OCR de inventario textil.
Devuelve solo JSON con este formato: [{"op":"","style":"","color":""}].
Reglas: op tiene 4-10 dígitos o queda vacío; style empieza con KH; corrige O/Q→0 e I/L→1 en números; color va en mayúsculas o "S/C". Conserva el orden del texto. Si no hay prendas, devuelve [].`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      op: { type: 'STRING' },
      style: { type: 'STRING' },
      color: { type: 'STRING' },
    },
    required: ['op', 'style', 'color'],
  },
};

/**
 * Servicio de respaldo para lecturas ambiguas: recibe únicamente texto de ML Kit,
 * nunca la fotografía, y limita la espera de red a tres segundos.
 */
export const GeminiTextOCRService = {
  isConfigured: (): boolean => {
    return getApiKey().length > 0;
  },

  /**
   * Envía el texto extraído por ML Kit a Gemini (solo texto, sin imagen)
   * para estructurarlo en JSON de prendas.
   */
  extractGarmentsFromText: async (
    rawText: string,
    boxId: string
  ): Promise<ExtractedGarmentOCR[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('[GeminiTextOCRService] API Key de Gemini no configurada');
    if (!rawText || rawText.trim().length === 0) return [];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      console.log(`[GeminiTextOCRService] ⚡ Consultando ${TEXT_MODEL} (solo texto, límite ${REQUEST_TIMEOUT_MS}ms)...`);
      const startTime = Date.now();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${SYSTEM_PROMPT}\n\nTEXTO OCR:\n${rawText.trim()}`,
            }],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            maxOutputTokens: 512,
            thinkingConfig: { thinkingLevel: 'minimal' },
          },
        }),
        signal: controller.signal,
      });

      const elapsed = Date.now() - startTime;
      console.log(`[GeminiTextOCRService] 📥 ${TEXT_MODEL} respondió en ${elapsed}ms (status ${response.status})`);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini error ${response.status}: ${errText.substring(0, 120)}`);
      }

      const data = await response.json();
      const rawContent: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawContent.trim()) return [];

      const sanitized = rawContent.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(sanitized);
      if (!Array.isArray(parsed)) return [];

      const now = new Date().toISOString();
      return parsed
        .filter((item: any) => item && (item.style || item.op))
        .map((item: any, index: number) => ({
          id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
          box_id: boxId,
          op: (item.op || '').trim(),
          style: (item.style || '').trim().toUpperCase(),
          color: (item.color || 'S/C').trim().toUpperCase(),
          status: 1,
          created_at: now,
        }));
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Fallback offline: parser de regex local sin necesidad de internet.
   */
  fallbackLocalParser: (rawText: string, boxId: string): ExtractedGarmentOCR[] => {
    return processOCRText(rawText, boxId);
  },
};
