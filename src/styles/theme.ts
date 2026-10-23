const palette = {
  white: '#FFFFFF',
  black: '#000000',
  success: '#10b981',
  darkBg: '#090A0F',
  darkCard: '#161821',
  darkBorder: '#FFFFFF14',
  darkTextSec: '#94A3B8',
};

export type ColorSchemeType = 'morado' | 'dorado' | 'celeste' | 'verde' | 'rosado' | 'rojo';

export const SCHEME_COLORS: Record<ColorSchemeType, string> = {
  morado: '#8B5CF6',
  dorado: '#eab308',
  celeste: '#0284C7',
  verde: '#059669',
  rosado: '#DB2777',
  rojo: '#DC2626',
};

export const schemes = {
  morado: {
    light: {
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      borderShadow: '#E2E8F060',
      primary: '#8B5CF6',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: palette.darkBg,
      card: palette.darkCard,
      text: palette.white,
      textSecondary: palette.darkTextSec,
      border: palette.darkBorder,
      borderShadow: '#00000080',
      primary: '#A78BFA',
      primaryText: palette.white,
      success: palette.success,
    }
  },
  dorado: {
    light: {
      background: '#FDFBF7',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#78716C',
      border: '#E7E5E4',
      borderShadow: '#E7E5E460',
      primary: '#eab308',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: palette.darkBg,
      card: palette.darkCard,
      text: palette.white,
      textSecondary: palette.darkTextSec,
      border: palette.darkBorder,
      borderShadow: '#00000080',
      primary: '#FBBF24',
      primaryText: '#0F172A',
      success: palette.success,
    }
  },
  celeste: {
    light: {
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      borderShadow: '#E2E8F060',
      primary: '#0284C7',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: palette.darkBg,
      card: palette.darkCard,
      text: palette.white,
      textSecondary: palette.darkTextSec,
      border: palette.darkBorder,
      borderShadow: '#00000080',
      primary: '#38BDF8',
      primaryText: '#0F172A',
      success: palette.success,
    }
  },
  verde: {
    light: {
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      borderShadow: '#E2E8F060',
      primary: '#059669',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: palette.darkBg,
      card: palette.darkCard,
      text: palette.white,
      textSecondary: palette.darkTextSec,
      border: palette.darkBorder,
      borderShadow: '#00000080',
      primary: '#34D399',
      primaryText: '#0F172A',
      success: palette.success,
    }
  },
  rosado: {
    light: {
      background: '#FDF8FA',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#64748B',
      border: '#FCE7F3',
      borderShadow: '#FCE7F360',
      primary: '#DB2777',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: palette.darkBg,
      card: palette.darkCard,
      text: palette.white,
      textSecondary: palette.darkTextSec,
      border: palette.darkBorder,
      borderShadow: '#00000080',
      primary: '#F472B6',
      primaryText: palette.white,
      success: palette.success,
    }
  },
  rojo: {
    light: {
      background: '#FDF8F8',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#64748B',
      border: '#FEE2E2',
      borderShadow: '#FEE2E260',
      primary: '#DC2626',
      primaryText: palette.white,
      success: palette.success,
    },
    dark: {
      background: palette.darkBg,
      card: palette.darkCard,
      text: palette.white,
      textSecondary: palette.darkTextSec,
      border: palette.darkBorder,
      borderShadow: '#00000080',
      primary: '#F87171',
      primaryText: palette.white,
      success: palette.success,
    }
  }
};

export const theme = schemes.morado;

export const getTheme = (colorScheme: ColorSchemeType = 'celeste', mode: 'light' | 'dark' = 'light') => {
  return schemes[colorScheme]?.[mode] || schemes.morado[mode];
};

export const clayStyles = {
  borderRadius: 20,
  borderWidth: 1,
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
  padding: 16,
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