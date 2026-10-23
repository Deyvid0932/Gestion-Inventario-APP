import React, { memo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Alert,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, RectButton, TouchableOpacity } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { InventoryStats } from '../../types';

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const formatInventoryDate = (dateString?: string | null) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = d.getDate();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
};

interface InventoryCardProps {
  item: InventoryStats;
  onPress: (id: string, name: string) => void;
  onEdit: (id: string, name: string, description: string) => void;
  onDelete: (id: string) => void;
  theme: any;
  drag?: () => void;
  isActive?: boolean;
  canEdit?: boolean;
}

export const InventoryCard = memo(({
  item,
  onPress,
  onEdit,
  onDelete,
  theme,
  drag,
  isActive = false,
  canEdit = true,
}: InventoryCardProps) => {
  const swipeableRef = useRef<Swipeable>(null);
  const scale = useSharedValue(1);

  const itemName = item.name || (item as any).nombre || '';
  const itemDesc = item.description || (item as any).descripcion || '';
  const itemDate = item.created_at || (item as any).fechaCreacion || new Date().toISOString();
  const total = item.totalGarments ?? (item as any).totalPrendas ?? 0;
  const escaneadas = item.scannedGarments ?? (item as any).prendasEscaneadas ?? 0;
  const progressPercent = total > 0 ? (escaneadas / total) * 100 : 0;

  useEffect(() => {
    if (isActive) {
      scale.value = withSpring(1.04, SPRING_CONFIG);
    } else {
      scale.value = withSpring(1, SPRING_CONFIG);
    }
  }, [isActive, scale]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getProgressColor = () => {
    if (total === 0 || escaneadas === 0) return '#EF4444';
    if (progressPercent >= 100 || escaneadas >= total) return '#059669';
    if (progressPercent >= 50) return theme.primary;
    return '#F59E0B';
  };

  const progressColor = getProgressColor();

  const renderRightActions = useCallback((progress: any) => {
    if (!canEdit) return null;
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [160, 0],
    });

    return (
      <View style={styles.swipeActionsContainer}>
        <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#FACC15' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onEdit(item.id, itemName, itemDesc);
            }}
          >
            <Ionicons name="pencil-outline" size={24} color="#FFF" />
          </RectButton>
        </Animated.View>
        <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
            onPress={() => {
              Alert.alert(
                "Eliminar Lote",
                `¿Estás seguro de que deseas eliminar el lote "${itemName}"? Esta acción borrará todas las cajas y prendas dentro de él.`,
                [
                  {
                    text: "Cancelar",
                    style: "cancel",
                    onPress: () => {
                      swipeableRef.current?.close();
                    }
                  },
                  {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: () => {
                      swipeableRef.current?.close();
                      setTimeout(() => {
                        onDelete(item.id);
                      }, 300);
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={24} color="#FFF" />
          </RectButton>
        </Animated.View>
      </View>
    );
  }, [onEdit, onDelete, item.id, itemName, itemDesc, canEdit]);

  const handleLongPress = useCallback(() => {
    swipeableRef.current?.close();
    if (canEdit && drag) {
      Vibration.vibrate(35);
      drag();
    }
  }, [canEdit, drag]);

  const cardContent = (
    <Reanimated.View style={animatedCardStyle}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPress(item.id, itemName)}
        onLongPress={handleLongPress}
        delayLongPress={150}
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: isActive ? theme.primary : theme.border,
            borderWidth: 1,
            borderRadius: 18,
            shadowColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.12)' : '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
            elevation: isActive ? 4 : (Platform.OS === 'android' ? 1 : 2),
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {itemName}
          </Text>
          {canEdit && (
            <View
              style={[
                styles.swipeHintBadge,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)'
                }
              ]}
            >
              <Ionicons name="chevron-back" size={12} color={theme.textSecondary} />
            </View>
          )}
        </View>

        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {formatInventoryDate(itemDate)}
          </Text>
        </View>

        <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={1}>
          {itemDesc || 'Sin descripción adicional'}
        </Text>

        <View style={styles.progressSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
              Progreso de escaneo
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.progressValue, { color: progressColor }]}>
                {`${Math.round(progressPercent)}%`}
              </Text>
              <Text style={[styles.progressValue, { color: theme.textSecondary }]}>
                {` • ${escaneadas}/${total}`}
              </Text>
            </View>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: progressColor,
                  width: `${progressPercent}%`
                }
              ]}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Reanimated.View >
  );

  if (!canEdit) {
    return (
      <View style={{ marginBottom: 16 }}>
        {cardContent}
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        friction={1.8}
        rightThreshold={30}
        overshootRight={false}
      >
        {cardContent}
      </Swipeable>
    </View>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
    (prev.item.name || (prev.item as any).nombre) === (next.item.name || (next.item as any).nombre) &&
    (prev.item.description || (prev.item as any).descripcion) === (next.item.description || (next.item as any).descripcion) &&
    (prev.item.totalGarments ?? (prev.item as any).totalPrendas) === (next.item.totalGarments ?? (next.item as any).totalPrendas) &&
    (prev.item.scannedGarments ?? (prev.item as any).prendasEscaneadas) === (next.item.scannedGarments ?? (next.item as any).prendasEscaneadas) &&
    prev.isActive === next.isActive &&
    prev.canEdit === next.canEdit &&
    prev.theme === next.theme;
});

export const InventarioCard = InventoryCard;

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
  },
  swipeHintBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '400',
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  progressSection: {
    marginTop: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    marginHorizontal: 4,
  },
  swipeActionsContainer: {
    width: 160,
    flexDirection: 'row',
    height: '100%',
  },
});

export default InventoryCard;
