import TextRecognition from "@react-native-ml-kit/text-recognition";
import { resizeForOCR } from "../utils/imageProcessor";
import { processOCRText } from "../utils/ocrParser";
import { useState } from "react";

export const useOCRManager = () => {
  const [loading, setLoading] = useState(false);

  const processImage = async (cameraUri: string, cajaId: string) => {
    setLoading(true);
    try {
      const cleanPhoto = await resizeForOCR(cameraUri);

      const result = await TextRecognition.recognize(cleanPhoto.uri);
      
      if (!result.text || result.text.trim() === "") return [];

      // Ordenamos los bloques por su posición vertical (top) para asegurar que se procesen de arriba a abajo
      // independientemente del orden en que ML Kit los detecte.
      const sortedText = result.blocks
        .sort((a, b) => (a.frame?.top || 0) - (b.frame?.top || 0))
        .map(block => block.text)
        .join('\n');

      const structuredData = processOCRText(sortedText, cajaId);

      return structuredData; 
    } catch (e) {
      console.error("Error en el pipeline:", e);
      return []; 
    } finally {
      setLoading(false);
    }
  };

  return { processImage, loading };
};