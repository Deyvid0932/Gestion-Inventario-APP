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

      // ML Kit ya nos devuelve result.text con el orden natural de lectura de la imagen
      const structuredData = processOCRText(result.text, cajaId);

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