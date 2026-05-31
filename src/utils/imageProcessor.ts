import * as ImageManipulator from 'expo-image-manipulator';

export const resizeForOCR = async (uri: string) => {
  return await ImageManipulator.manipulateAsync(
    uri,
    [
      { resize: { width: 1200 } }, 
    ], 
    { 
      compress: 0.9, 
      format: ImageManipulator.SaveFormat.JPEG,
      
    }
  );
};