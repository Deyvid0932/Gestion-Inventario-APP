
const palette = {
  white: '#FFFFFF',
  black: '#000000',
  
  // Light Mode (Equivalente Suave Pastel)
  lightBg: '#f6f5fa',
  lightCard: '#ffffff',
  lightPrimary: '#9b84e2',
  lightTextSecondary: '#8d85a6',
  lightBorder: '#00000010', // Sombra suave sutil

  // Dark Mode (Dark Claymorphism Especificado)
  darkBg: '#1a162b', // Morado muy oscuro
  darkCard: '#2d264d', // Morado pastel oscuro
  darkPrimary: '#8b6fd8', // Morado pastel vibrante
  darkTextSecondary: '#a89ebf', // Lavanda grisáceo
  darkBorder: '#ffffff10', // Borde translúcido plastilina
  darkBorderShadow: '#130f20', // Sombra del fondo pero más oscura
  
  // Estados
  success: '#4ade80',
};

export const theme = {
  light: {
    background: palette.lightBg,
    card: palette.lightCard,
    text: palette.black,
    textSecondary: palette.lightTextSecondary,
    border: palette.lightBorder,
    borderShadow: '#e2e0ed', 
    primary: palette.lightPrimary,
    primaryText: palette.white,
    success: palette.success,
  },
  dark: {
    background: palette.darkBg,
    card: palette.darkCard,
    text: palette.white,
    textSecondary: palette.darkTextSecondary,
    border: palette.darkBorder,
    borderShadow: palette.darkBorderShadow,
    primary: palette.darkPrimary,
    primaryText: palette.white,
    success: palette.success,
  }
};

// Utilidades compartidas para el efecto Claymorphism
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