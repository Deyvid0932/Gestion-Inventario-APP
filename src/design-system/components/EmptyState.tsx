import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { spacing } from '../tokens/spacing';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'cube-outline',
  title,
  subtitle,
  children,
}) => {
  const currentTheme = useAppStore(state => state.currentTheme);

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color={currentTheme.primary + '40'} style={{ marginBottom: spacing.md }} />
      <Text style={[styles.title, { color: currentTheme.text }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>{subtitle}</Text>}
      {children && <View style={{ marginTop: spacing.lg }}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
});
