import React, { memo, useCallback, useRef, useEffect } from 'react';
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
import { InventarioStats } from '../types';
import { clayStyles } from '../style/theme';

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

interface InventarioCardProps {
  item: InventarioStats;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  theme: any;
  drag?: () => void;
  isActive?: boolean;
  canEdit?: boolean;
}

const InventarioCard = memo(({
  item,
  onPress,
  onEdit,
  onDelete,
  theme,
  drag,
  isActive = false,
  canEdit = true,
}: InventarioCardProps) => {
  const swipeableRef = useRef<Swipeable>(null);
  const scale = useSharedValue(1);
  const elevationAnim = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      scale.value = withSpring(1.04, SPRING_CONFIG);
      elevationAnim.value = withSpring(1, SPRING_CONFIG);
    } else {
      scale.value = withSpring(1, SPRING_CONFIG);
      elevationAnim.value = withSpring(0, SPRING_CONFIG);
    }
  }, [isActive, scale, elevationAnim]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: 0.08 + elevationAnim.value * 0.18,
    shadowRadius: 4 + elevationAnim.value * 12,
    ...(Platform.OS === 'android' ? { elevation: 2 + elevationAnim.value * 8 } : {}),
  }));

  const total = item.totalPrendas || 0;
  const escaneadas = item.prendasEscaneadas || 0;
  const progressPercent = total > 0 ? (escaneadas / total) * 100 : 0;

  const getProgressColor = () => {
    if (progressPercent === 100) return '#2ecc71';
    if (progressPercent > 50) return theme.primary;
    if (progressPercent > 20) return '#f39c12';
    return '#e74c3c';
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
            style={[styles.actionButton, { backgroundColor: '#f3dd12' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onEdit();
            }}
          >
            <Ionicons name="pencil-outline" size={24} color="#FFF" />
          </RectButton>
        </Animated.View>
        <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
            onPress={() => {
              Alert.alert(
                "Eliminar Lote",
                `¿Estás seguro de que deseas eliminar el lote "${item.nombre}"? Esta acción borrará todas las cajas y prendas dentro de él.`,
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
                        onDelete();
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
  }, [onEdit, onDelete, item.nombre, canEdit]);

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
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={150}
        style={[
          styles.card,
          clayStyles,
          {
            backgroundColor: theme.card,
            borderColor: isActive ? theme.primary : theme.border,
            shadowColor: theme.borderShadow || '#000',
          }
        ]}
      >
        <View style={styles.cardMain}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{item.nombre}</Text>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                {new Date(item.fechaCreacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
          {canEdit && (
            <View style={styles.swipeHintBadge}>
              <Ionicons name="chevron-back" size={14} color={theme.textSecondary} />
            </View>
          )}
        </View>

        <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.descripcion || 'Sin descripción adicional'}
        </Text>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Progreso de Escaneo</Text>
            <Text style={[styles.progressValue, { color: progressColor }]}>
              {item.prendasEscaneadas} / {item.totalPrendas}
            </Text>
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
    </Reanimated.View>
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
    prev.item.nombre === next.item.nombre &&
    prev.item.descripcion === next.item.descripcion &&
    prev.item.totalPrendas === next.item.totalPrendas &&
    prev.item.prendasEscaneadas === next.item.prendasEscaneadas &&
    prev.isActive === next.isActive &&
    prev.theme === next.theme;
});

const styles = StyleSheet.create({
  card: {
    padding: 18,
    // Claymorphism properties applied via spread from clayStyles
  },
  cardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },

  cardDesc: {
    fontSize: 14,
    marginBottom: 18,
    lineHeight: 20,
  },
  progressSection: {
    marginTop: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  swipeActionsContainer: {
    width: 160,
    flexDirection: 'row',
    height: '100%',
  },
  swipeHintBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(142, 142, 147, 0.15)',
    marginLeft: 8,
  },
});

export default InventarioCard;
