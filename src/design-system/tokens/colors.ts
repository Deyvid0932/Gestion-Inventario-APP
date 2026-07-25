import { ColorSchemeType, schemes } from '../../style/theme';

export const getDesignSystemColors = (colorScheme: ColorSchemeType = 'morado', mode: 'light' | 'dark' = 'light') => {
  const currentTheme = schemes[colorScheme]?.[mode] || schemes.morado[mode];
  return {
    ...currentTheme,
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    overlay: 'rgba(0, 0, 0, 0.5)',
  };
};
