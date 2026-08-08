import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { clayStyles } from '../style/theme';

interface EmptyStateProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
  currentTheme: any;
  delay?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName,
  title,
  description,
  buttonLabel,
  onButtonPress,
  currentTheme,
  delay = 300,
}) => {
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).springify()}
      style={[
        styles.emptyContainer,
        clayStyles,
        {
          backgroundColor: currentTheme.card,
          borderColor: currentTheme.border,
        },
      ]}
    >
      <View style={[styles.emptyIconCircle, { backgroundColor: currentTheme.background }]}>
        <Ionicons name={iconName} size={48} color={currentTheme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: currentTheme.textSecondary }]}>
        {description}
      </Text>
      {buttonLabel && onButtonPress && (
        <TouchableOpacity
          style={[styles.emptyButton, { backgroundColor: currentTheme.primary }]}
          onPress={onButtonPress}
        >
          <Ionicons name="add-outline" size={20} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.emptyButtonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    borderWidth: 1,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: '80%',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
