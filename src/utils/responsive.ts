import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

export const scale = (size: number): number => {
  return (SCREEN_WIDTH / guidelineBaseWidth) * size;
};


export const verticalScale = (size: number): number => {
  return (SCREEN_HEIGHT / guidelineBaseHeight) * size;
};

export const moderateScale = (size: number, factor = 0.5): number => {
  return Math.round(size + (scale(size) - size) * factor);
};

export const isSmallScreen = SCREEN_WIDTH < 360;

export const isTablet = SCREEN_WIDTH >= 600;
