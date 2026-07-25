import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius } from '../tokens/radius';
import { spacing } from '../tokens/spacing';

interface StatusBadgeProps {
  active: boolean;
  activeText?: string;
  inactiveText?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  active,
  activeText = 'Activo',
  inactiveText = 'Inactivo',
}) => {
  const color = active ? '#10B981' : '#EF4444';
  const bgColor = active ? '#10B98118' : '#EF444418';

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor: color + '40' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{active ? activeText : inactiveText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
