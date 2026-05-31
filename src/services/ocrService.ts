import TextRecognition from '@react-native-ml-kit/text-recognition';

export const recognizeImageText = async (imageUri: string) => {
    try {
        const result = await TextRecognition.recognize(imageUri);
        return result.text || "";
    } catch (error) {
        console.error("Error en ML Kit Nativo:", error);
        return "";
    }
};