import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { clayStyles, ThemeType } from '../../styles/theme';
import { SearchResult } from '../../utils/nlpEngine';

interface ChatGarmentCardProps {
  match: SearchResult;
  theme: ThemeType;
  onPressItem: (match: SearchResult) => void;
}

export const ChatGarmentCard = React.memo<ChatGarmentCardProps>(({
  match,
  theme,
  onPressItem,
}) => {
  return (
    <Animated.View
      key={match.id}
      entering={FadeIn.duration(300)}
      style={[
        styles.resultCard,
        clayStyles,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.borderShadow || '#000',
        },
      ]}
    >
      <View style={styles.cardRow}>
        <Ionicons name="shirt-outline" size={18} color={theme.primary} style={{ marginRight: 6 }} />
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
          {match.style} - {match.color}
        </Text>
      </View>

      <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
        OP: {match.op || 'Sin OP'}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={[styles.statusBadge, { backgroundColor: match.status === 1 ? '#10B98118' : '#64748B18' }]}>
          <View style={[styles.statusDot, { backgroundColor: match.status === 1 ? '#10B981' : '#64748B' }]} />
          <Text style={[styles.statusBadgeText, { color: match.status === 1 ? '#10B981' : '#64748B' }]}>
            {match.status === 1 ? 'Activo' : 'Inactivo'}
          </Text>
        </View>
      </View>

      {match.box_name && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name="cube-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
          <Text style={[styles.cardLocation, { color: theme.textSecondary }]}>
            Ubicación: {match.inventory_name} → {match.box_name}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: theme.primary }]}
        onPress={() => onPressItem(match)}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>Ver en caja</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  resultCard: {
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardLocation: {
    fontSize: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
