
const palette = {
  white: '#FFFFFF',
  black: '#000000',
  grayLight: '#F2F2F7',
  grayDark: '#1C1C1E',
  greenPrimary: '#2e9acc',
  textSecondary: '#8E8E93',
  borderLight: '#E5E5EA',
  borderDark: '#38383A',
};

export const theme = {
  light: {
    background: palette.grayLight,
    card: palette.white,
    text: palette.black,
    textSecondary: palette.textSecondary,
    border: palette.borderLight,
    primary: palette.greenPrimary,
  },
  dark: {
    background: palette.black,
    card: palette.grayDark,
    text: palette.white,
    textSecondary: palette.textSecondary,
    border: palette.borderDark,
    primary: palette.greenPrimary,
  }
};

export type ThemeType = typeof theme.light;