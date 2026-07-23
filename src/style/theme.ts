const palette = {
  white: '#FFFFFF',
  black: '#000000',
  success: '#4ade80',
};

export type ColorSchemeType = 'morado' | 'dorado' | 'celeste';

export const SCHEME_COLORS: Record<ColorSchemeType, string> = {
  morado: '#8b6fd8',
  dorado: '#eab308',
  celeste: '#06b6d4',
};

export const schemes = {
  morado: {
    light: {
      background: '#f6f5fa',
      card: '#ffffff',
      text: palette.black,
      textSecondary: '#8d85a6',
      border: '#00000010',
      borderShadow: '#e2e0ed',
      primary: '#9b84e2',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: '#1a162b',
      card: '#2d264d',
      text: palette.white,
      textSecondary: '#a89ebf',
      border: '#ffffff10',
      borderShadow: '#130f20',
      primary: '#8b6fd8',
      primaryText: palette.white,
      success: palette.success,
    }
  },
  dorado: {
    light: {
      background: '#faf8f0',
      card: '#ffffff',
      text: palette.black,
      textSecondary: '#948b6e',
      border: '#00000010',
      borderShadow: '#ede8d5',
      primary: '#ca8a04',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: '#1a1912',
      card: '#2d2a1f',
      text: palette.white,
      textSecondary: '#b8af91',
      border: '#ffffff10',
      borderShadow: '#14130d',
      primary: '#eab308',
      primaryText: palette.black,
      success: palette.success,
    }
  },
  celeste: {
    light: {
      background: '#f0f8fa',
      card: '#ffffff',
      text: palette.black,
      textSecondary: '#6e8d94',
      border: '#00000010',
      borderShadow: '#d5e6ed',
      primary: '#0891b2',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: '#0f1a2b',
      card: '#1e2d3d',
      text: palette.white,
      textSecondary: '#91abb8',
      border: '#ffffff10',
      borderShadow: '#0a121f',
      primary: '#06b6d4',
      primaryText: palette.black,
      success: palette.success,
    }
  }
};

export const theme = schemes.morado;

export const getTheme = (colorScheme: ColorSchemeType = 'morado', mode: 'light' | 'dark' = 'light') => {
  return schemes[colorScheme]?.[mode] || schemes.morado[mode];
};

export const clayStyles = {
  borderRadius: 28, 
  borderWidth: 1, 
  shadowOpacity: 0.15,
  shadowRadius: 12,
  shadowOffset: { width: 4, height: 8 },
  elevation: 8,
  padding: 20, 
};

export type ThemeType = typeof theme.light;