
const palette = {
  white: '#FFFFFF',
  black: '#000000',
  grayLight: '#F4F4F5', // Zinc 100
  grayDark: '#18181B', // Zinc 900
  primaryLight: '#18181B', // Zinc 900 for elegant black primary
  primaryDark: '#FAFAFA', // Zinc 50 for bright white primary in dark mode
  textSecondary: '#71717A', // Zinc 500
  borderLight: '#E4E4E7', // Zinc 200
  borderDark: '#27272A', // Zinc 800
};

export const theme = {
  light: {
    background: palette.grayLight,
    card: palette.white,
    text: palette.black,
    textSecondary: palette.textSecondary,
    border: palette.borderLight,
    primary: palette.primaryLight,
    primaryText: palette.white,
  },
  dark: {
    background: palette.black,
    card: palette.grayDark,
    text: palette.white,
    textSecondary: palette.textSecondary,
    border: palette.borderDark,
    primary: palette.primaryDark,
    primaryText: palette.black,
  }
};

export type ThemeType = typeof theme.light;