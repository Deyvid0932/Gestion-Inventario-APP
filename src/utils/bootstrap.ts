
import { Text, TextInput } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Evitar crashes por hot reload en desarrollo
if (typeof (global as any).ErrorUtils !== 'undefined') {
  const originalHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    if (error?.message?.includes('reload') || error?.toString()?.includes('reload')) {
      return;
    }
    if (originalHandler) originalHandler(error, isFatal);
  });
}

// Control de escala de fuentes
const configureFontLimits = () => {
  if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
  (Text as any).defaultProps.maxFontSizeMultiplier = 1.35;

  if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
  (TextInput as any).defaultProps.maxFontSizeMultiplier = 1.35;
};

configureFontLimits();