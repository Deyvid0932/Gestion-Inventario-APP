import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Medidas base estándar de diseño (iPhone SE / Android medio: 375 x 812)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Escala horizontal proporcional al ancho de la pantalla.
 * Ideal para: width, marginHorizontal, paddingHorizontal.
 */
export const scale = (size: number): number => {
  return (SCREEN_WIDTH / guidelineBaseWidth) * size;
};

/**
 * Escala vertical proporcional al alto de la pantalla.
 * Ideal para: height, marginVertical, paddingVertical.
 */
export const verticalScale = (size: number): number => {
  return (SCREEN_HEIGHT / guidelineBaseHeight) * size;
};

/**
 * Escala moderada. Permite ajustar un elemento proporcionalmente sin que crezca demasiado en pantallas grandes.
 * Ideal para: fontSize, borderRadius, padding general.
 * @param factor Valor entre 0 y 1 (por defecto 0.5) que controla la agresividad del escalado.
 */
export const moderateScale = (size: number, factor = 0.5): number => {
  return Math.round(size + (scale(size) - size) * factor);
};

/**
 * Utilitario para saber si el dispositivo es una pantalla pequeña (ej. < 360px de ancho)
 */
export const isSmallScreen = SCREEN_WIDTH < 360;

/**
 * Utilitario para saber si el dispositivo es una Tablet (ej. >= 600px de ancho)
 */
export const isTablet = SCREEN_WIDTH >= 600;
