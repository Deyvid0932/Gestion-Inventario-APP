import React, { memo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { InventarioStats } from '../types';
import { clayStyles } from '../style/theme';
import { AppCard } from '../design-system/components/AppCard';
import { StatusBadge } from '../design-system/components/StatusBadge';

interface InventarioCardProps {
  item: InventarioStats;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  theme: any;
}

const InventarioCard = memo(({
  item,
  onPress,
  onEdit,
  onDelete,
  theme
}: InventarioCardProps) => {
  const swipeableRef = useRef<Swipeable>(null);

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
  }, [onEdit, onDelete, item.nombre]);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={3}
      rightThreshold={30}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        delayPressIn={0}
        pressRetentionOffset={{ top: 20, left: 20, right: 20, bottom: 20 }}
        style={{ marginBottom: 20 }}
        onPress={onPress}
      >
        <AppCard style={[styles.card, clayStyles]}>
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
          <StatusBadge active={item.estado === 'Activo'} activeText="Activo" inactiveText={item.estado} />
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
        </AppCard>
      </TouchableOpacity>
    </Swipeable>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
    prev.item.estado === next.item.estado &&
    (prev.item as any).updated_at === (next.item as any).updated_at &&
    prev.theme === next.theme;
});

const styles = StyleSheet.create({
  card: {
    padding: 0,
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
    paddingBottom: 16, // match card marginBottom
  },
});

export default InventarioCard;
