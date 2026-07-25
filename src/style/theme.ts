const palette = {
  white: '#FFFFFF',
  black: '#000000',
  success: '#4ade80',
};

export type ColorSchemeType = 'morado' | 'dorado' | 'celeste' | 'verde' | 'rosado' | 'rojo';

export const SCHEME_COLORS: Record<ColorSchemeType, string> = {
  morado: '#8b6fd8',
  dorado: '#eab308',
  celeste: '#06b6d4',
  verde: '#10b981',
  rosado: '#ec4899',
  rojo: '#ef4444',
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
  },
  verde: {
    light: {
      background: '#f0fdf4',
      card: '#ffffff',
      text: palette.black,
      textSecondary: '#65a30d',
      border: '#00000010',
      borderShadow: '#dcfce7',
      primary: '#059669',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: '#062c22',
      card: '#0f3d30',
      text: palette.white,
      textSecondary: '#a7f3d0',
      border: '#ffffff10',
      borderShadow: '#022c22',
      primary: '#10b981',
      primaryText: palette.white,
      success: palette.success,
    }
  },
  rosado: {
    light: {
      background: '#fdf2f8',
      card: '#ffffff',
      text: palette.black,
      textSecondary: '#9d174d',
      border: '#00000010',
      borderShadow: '#fce7f3',
      primary: '#db2777',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: '#2b1424',
      card: '#421d37',
      text: palette.white,
      textSecondary: '#fbcfe8',
      border: '#ffffff10',
      borderShadow: '#1f0b1a',
      primary: '#ec4899',
      primaryText: palette.white,
      success: palette.success,
    }
  },
  rojo: {
    light: {
      background: '#fef2f2',
      card: '#ffffff',
      text: palette.black,
      textSecondary: '#b91c1c',
      border: '#00000010',
      borderShadow: '#fee2e2',
      primary: '#dc2626',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: '#2c0b0e',
      card: '#451117',
      text: palette.white,
      textSecondary: '#fca5a5',
      border: '#ffffff10',
      borderShadow: '#1f0507',
      primary: '#ef4444',
      primaryText: palette.white,
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

export const typography = {
  caption: 11,
  bodySmall: 13,
  body: 15,
  subtitle: 17,
  title: 20,
  header: 24,
};

export type ThemeType = typeof theme.light;