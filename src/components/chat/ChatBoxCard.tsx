import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { clayStyles, ThemeType } from '../../styles/theme';
import { BoxMatchData } from '../../services/chat/chatRepository';

interface ChatBoxCardProps {
  box: BoxMatchData;
  theme: ThemeType;
  onOpenBox: (boxId: string, boxName: string) => void;
}

export const ChatBoxCard = React.memo<ChatBoxCardProps>(({
  box,
  theme,
  onOpenBox,
}) => {
  return (
    <Animated.View
      key={box.id}
      entering={FadeIn.duration(300)}
      style={[
        styles.cajaCard,
        clayStyles,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.borderShadow || '#000',
        },
      ]}
    >
      <View style={styles.cajaCardHeader}>
        <View style={[styles.cajaIconCircle, { backgroundColor: theme.primary + '18' }]}>
          <Ionicons name="cube" size={20} color={theme.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.cajaCardTitle, { color: theme.text }]} numberOfLines={1}>
            {box.name}
          </Text>
          <Text style={[styles.cajaCardSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            Lote: {box.inventory_name}
          </Text>
        </View>
      </View>

      <View style={styles.cajaMetricsRow}>
        <View style={[styles.metricPill, { backgroundColor: theme.background }]}>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{box.total_garments}</Text>
        </View>
        <View style={[styles.metricPill, { backgroundColor: '#10B98118' }]}>
          <Text style={[styles.metricLabel, { color: '#10B981' }]}>Activas</Text>
          <Text style={[styles.metricValue, { color: '#10B981' }]}>{box.active_count}</Text>
        </View>
        <View style={[styles.metricPill, { backgroundColor: '#64748B18' }]}>
          <Text style={[styles.metricLabel, { color: '#64748B' }]}>Inactivas</Text>
          <Text style={[styles.metricValue, { color: '#64748B' }]}>{box.inactive_count}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.openCajaButton, { backgroundColor: theme.primary }]}
        onPress={() => onOpenBox(box.id, box.name)}
        activeOpacity={0.8}
      >
        <Text style={styles.openCajaButtonText}>Ver Contenido</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  cajaCard: {
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  cajaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cajaIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajaCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cajaCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  cajaMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  metricPill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  openCajaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  openCajaButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
