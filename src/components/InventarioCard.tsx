import React, { memo, useRef } from 'react';
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
    if (progressPercent === 100) return '#2ecc71'; // Verde éxito
    if (progressPercent > 50) return theme.primary; // Color primario
    if (progressPercent > 20) return '#f39c12'; // Naranja
    return '#e74c3c'; // Rojo
  };

  const progressColor = getProgressColor();

  const renderRightActions = (progress: any) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [160, 0],
    });

    return (
      <View style={styles.swipeActionsContainer}>
        <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#3498db' }]}
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
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={3}
      rightThreshold={30}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        delayPressIn={0}
        pressRetentionOffset={{ top: 20, left: 20, right: 20, bottom: 20 }}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={onPress}
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
          <View style={[styles.statusBadge, { backgroundColor: item.estado === 'Activo' ? '#2ecc7120' : theme.border }]}>
            <Text style={[styles.statusText, { color: item.estado === 'Activo' ? '#2ecc71' : theme.textSecondary }]}>
              {item.estado}
            </Text>
          </View>
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
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  cardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
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
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 4,
  },
  swipeActionsContainer: {
    width: 160,
    flexDirection: 'row',
    marginBottom: 16,
    overflow: 'hidden', // 👈 ¡ESTA ES LA MAGIA!
    borderRadius: 20, // 👈 Agrégale esto para que el corte sea redondeado
  },
});

export default InventarioCard;
