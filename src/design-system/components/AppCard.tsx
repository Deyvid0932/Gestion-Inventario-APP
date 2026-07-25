import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useAppStore } from '../../store/useAppStore';
import { radius } from '../tokens/radius';
import { spacing } from '../tokens/spacing';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: 'default' | 'outlined' | 'elevated';
}

export const AppCard: React.FC<AppCardProps> = ({ children, style, variant = 'default' }) => {
  const currentTheme = useAppStore(state => state.currentTheme);

  const cardStyle: ViewStyle = {
    backgroundColor: currentTheme.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: variant === 'outlined' ? currentTheme.primary + '30' : currentTheme.border,
    shadowColor: currentTheme.borderShadow || '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: variant === 'elevated' ? 6 : 3,
  };

  return <View style={[cardStyle, style]}>{children}</View>;
};
