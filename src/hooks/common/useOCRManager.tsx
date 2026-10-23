import TextRecognition from "@react-native-ml-kit/text-recognition";
import { resizeForOCR } from "../../utils/imageProcessor";
import { ExtractedGarmentOCR } from "../../utils/ocrParser";
import { GeminiTextOCRService } from "../../services/ai/GeminiTextOCRService";
import { useState } from "react";

export interface OCRProcessResult {
  garments: ExtractedGarmentOCR[];
  source: 'gemini' | 'mlkit';
}

/**
 * Pipeline de OCR híbrido:
 * 1. ML Kit lee el texto en el dispositivo, sin subir la imagen.
 * 2. El parser local resuelve inmediatamente las etiquetas claras.
 * 3. Solo los resultados ambiguos envían el texto a Gemini Flash-Lite.
 * 4. Si la red falla o supera 3 segundos, se conserva el resultado local.
 */
export const useOCRManager = () => {
  const [loading, setLoading] = useState(false);
  const [scanSource, setScanSource] = useState<'gemini' | 'mlkit' | null>(null);

  const processImage = async (cameraUri: string, boxId: string): Promise<OCRProcessResult> => {
    setLoading(true);
    setScanSource(null);
    console.log('\n================== [useOCRManager] INICIO DE ESCANEO OCR ==================');
    console.log(`[useOCRManager] 📸 Caja ID objetivo: ${boxId}`);

    try {
      const preprocessingStart = Date.now();
      const cleanPhoto = await resizeForOCR(cameraUri);
      const preprocessingElapsed = Date.now() - preprocessingStart;
      console.log(`[useOCRManager] 🖼️ Imagen lista: ${cleanPhoto.width}x${cleanPhoto.height} en ${preprocessingElapsed}ms`);

      // PASO 1: ML Kit lee el texto en el dispositivo (~150ms, 100% offline)
      console.log('[useOCRManager] ⚡ [Paso 1] ML Kit leyendo texto en el dispositivo...');
      const mlkitStart = Date.now();
      const ocrResult = await TextRecognition.recognize(cleanPhoto.uri);
      const mlkitElapsed = Date.now() - mlkitStart;
      const rawText = ocrResult?.text || '';
      console.log(`[useOCRManager] 📱 ML Kit terminó en ${mlkitElapsed}ms — Texto extraído: "${rawText.substring(0, 100)}${rawText.length > 100 ? '...' : ''}"`);

      if (!rawText.trim()) {
        console.warn('[useOCRManager] ⚠️ No se detectó texto en la imagen.');
        console.log('================== [useOCRManager] FIN (SIN TEXTO) ==================\n');
        return { garments: [], source: 'mlkit' };
      }

      // PASO 2: Resolver localmente primero. Las etiquetas claras no necesitan red.
      const localGarments = GeminiTextOCRService.fallbackLocalParser(rawText, boxId);
      const probableStyleCount = rawText.match(/KH[A-Z]*/gi)?.length || 0;
      const isHighConfidenceLocalResult = localGarments.length > 0 && localGarments.every(item => {
        const validStyle = /^KH[A-Z]*\s+\d{3}\s+\d{2,3}$/.test(item.style.trim());
        const validColor = item.color.trim() !== '' && item.color !== 'S/C' && item.color.length <= 45;
        return validStyle && validColor;
      }) && localGarments.length >= probableStyleCount;

      if (isHighConfidenceLocalResult) {
        const total = preprocessingElapsed + mlkitElapsed;
        console.log(`[useOCRManager] ⚡ Parser local confiable: ${localGarments.length} prendas; Gemini omitido.`);
        console.log(`[useOCRManager] ⏱️ TIEMPO TOTAL LOCAL: ${total}ms`);
        console.log('================== [useOCRManager] FIN (LOCAL RÁPIDO) ==================\n');
        setScanSource('mlkit');
        return { garments: localGarments, source: 'mlkit' };
      }

      // PASO 3: Solo las lecturas ambiguas usan Gemini (texto, nunca la imagen).
      const isGeminiAvailable = GeminiTextOCRService.isConfigured();
      if (isGeminiAvailable) {
        try {
          console.log('[useOCRManager] 🤖 [Paso 2] Gemini estructurando texto con IA (sin subir foto)...');
          const geminiStart = Date.now();
          const aiGarments = await GeminiTextOCRService.extractGarmentsFromText(rawText, boxId);
          const geminiElapsed = Date.now() - geminiStart;

          if (aiGarments.length > 0) {
            const total = preprocessingElapsed + mlkitElapsed + geminiElapsed;
            console.log(`[useOCRManager] 🎉 ¡ÉXITO! Gemini estructuró ${aiGarments.length} prendas en ${geminiElapsed}ms.`);
            console.log(`[useOCRManager] ⏱️ TIEMPO TOTAL: ${preprocessingElapsed}ms (imagen) + ${mlkitElapsed}ms (ML Kit) + ${geminiElapsed}ms (Gemini) = ${total}ms`);
            console.log('================== [useOCRManager] FIN (GEMINI HÍBRIDO) ==================\n');
            setScanSource('gemini');
            return { garments: aiGarments, source: 'gemini' };
          } else {
            console.warn('[useOCRManager] ⚠️ Gemini devolvió 0 prendas. Activando parser local...');
          }
        } catch (geminiError: any) {
          console.warn('[useOCRManager] ⚠️ Gemini falló (sin red o error):', geminiError?.message || geminiError);
          console.log('[useOCRManager] 🔄 Activando parser local como fallback offline...');
        }
      } else {
        console.log('[useOCRManager] ℹ️ Gemini no configurado. Usando parser local.');
      }

      // PASO 4: Reutilizar el resultado local ya calculado, sin trabajo duplicado.
      console.log('[useOCRManager] 📋 [Paso 4 Fallback] Usando resultado local existente...');
      console.log(`[useOCRManager] 🏁 Parser local extrajo ${localGarments.length} prendas.`);
      console.log('================== [useOCRManager] FIN (PARSER LOCAL) ==================\n');
      setScanSource('mlkit');
      return { garments: localGarments, source: 'mlkit' };

    } catch (e) {
      console.error("❌ Error en el pipeline OCR:", e);
      console.log('================== [useOCRManager] FIN (ERROR) ==================\n');
      return { garments: [], source: 'mlkit' };
    } finally {
      setLoading(false);
    }
  };

  return { processImage, loading, scanSource };
};
