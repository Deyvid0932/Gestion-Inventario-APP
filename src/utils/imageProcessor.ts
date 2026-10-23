import * as ImageManipulator from 'expo-image-manipulator';

export const resizeForOCR = async (uri: string) => {
  return await ImageManipulator.manipulateAsync(
    uri,
    [
      { resize: { width: 800 } }, 
    ], 
    { 
      compress: 0.70, 
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
};
