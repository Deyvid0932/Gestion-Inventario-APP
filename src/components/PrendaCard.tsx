import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated as RNAnimated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  interpolateColor,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Prenda } from '../types';
import { getColorHex } from '../utils/colorUtils';
import { clayStyles } from '../style/theme';
import { moderateScale } from '../utils/responsive';
import { StatusBadge } from '../design-system/components/StatusBadge';


interface PrendaCardProps {
  item: Prenda & { cajaNombre?: string; inventarioNombre?: string };
  theme: any;
  isSelected: boolean;
  isHighlighted: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  onToggleStatus?: () => void;
  historyMode?: boolean;
  onImagePress: (uri: string | null | undefined) => void;
}

export const PrendaCard = React.memo(({
  item,
  theme,
  isSelected,
  onPress,
  onLongPress,
  onDelete,
  onMove,
  onToggleStatus,
  isHighlighted,
  historyMode = false,
  onImagePress,
}: PrendaCardProps) => {
  const swipeableRef = React.useRef<Swipeable>(null);
  const colorHex = getColorHex(item.color);
  const estado = item.estado;

  const highlightOpacity = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      highlightOpacity.value = withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 1500 })
      );
    }
  }, [isHighlighted]);

  const animatedStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      highlightOpacity.value,
      [0, 1],
      [isSelected ? theme.background : theme.card, theme.primary + '15']
    );

    const animatedBorderColor = interpolateColor(
      highlightOpacity.value,
      [0, 1],
      [isSelected ? theme.text : theme.border, theme.primary]
    );

    return {
      backgroundColor: withTiming(bgColor, { duration: 250 }),
      elevation: clayStyles.elevation,
      borderColor: animatedBorderColor,
      borderWidth: clayStyles.borderWidth,
      shadowColor: theme.borderShadow || '#000',
      shadowOpacity: clayStyles.shadowOpacity,
      shadowRadius: clayStyles.shadowRadius,
      shadowOffset: clayStyles.shadowOffset,
      borderRadius: clayStyles.borderRadius,
      transform: [{ scale: 1 + (highlightOpacity.value * 0.02) }]
    };
  });

  const containerWidth = 160;

  const renderRightActions = useCallback((
    progress: RNAnimated.AnimatedInterpolation<number>
  ) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [containerWidth, 0]
    });

    return (
      <View style={[styles.swipeActionsContainer, { width: containerWidth }]}>
        {onMove && (
          <RNAnimated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
            <RectButton
              style={[styles.actionButton, { backgroundColor: '#f39c12' }]}
              onPress={() => {
                swipeableRef.current?.close();
                onMove();
              }}
            >
              <Ionicons name="arrow-redo-outline" size={24} color="#FFF" />
            </RectButton>
          </RNAnimated.View>
        )}
        {onDelete && (
          <RNAnimated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
            <RectButton
              style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
              onPress={() => {
                swipeableRef.current?.close();
                onDelete();
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#FFF" />
            </RectButton>
          </RNAnimated.View>
        )}
      </View>
    );
  }, [onMove, onDelete]);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2.5}
      rightThreshold={40}
    >
      <TouchableOpacity
        activeOpacity={1}
        delayPressIn={0}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <Animated.View style={[
          styles.shadowWrapper,
          animatedStyle,
          historyMode && styles.historyCard
        ]}>
          <View style={styles.innerCard}>
            <View style={[styles.colorBar, { backgroundColor: colorHex }]} />
            <View style={styles.itemContent}>
              {/* Fila 1 (Superior): Estilo + Estado */}
              <View style={styles.itemHeader}>
                <View style={[styles.compactBadge, { borderWidth: 1, borderColor: theme.border, alignSelf: 'center' }]}>
                  <Text style={[styles.itemStyle, { color: theme.text, fontSize: historyMode ? 14 : 17 }]} numberOfLines={1} allowFontScaling={true}>
                    {item.estilo}
                  </Text>
                </View>

                {!historyMode && onToggleStatus && (
                  <TouchableOpacity onPress={onToggleStatus} activeOpacity={0.8}>
                    <StatusBadge active={estado === 1} activeText="Activo" inactiveText="Inactivo" />
                  </TouchableOpacity>
                )}
                {historyMode && (
                  <View style={[styles.colorSwatch, { backgroundColor: colorHex, borderColor: theme.border }]} />
                )}
              </View>

              {/* Fila 2 (Centro): OP + Color */}
              {!historyMode && (
                <View style={styles.infoRow}>
                  <View style={styles.infoGroup}>
                    <Ionicons name="pricetag-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.infoText, { color: theme.textSecondary }]} allowFontScaling={true}>
                      {item.op || 'Sin OP'}
                    </Text>
                  </View>
                  <View style={styles.infoGroup}>
                    <Ionicons name="color-palette-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.infoText, { color: theme.textSecondary }]} allowFontScaling={true}>
                      {item.color}
                    </Text>
                  </View>
                </View>
              )}

              {/* Fila 3 (Pie Inferior): Alarma (Izquierda) + Fotos (Derecha) */}
              <View style={styles.itemFooter}>
                {historyMode ? (
                  <Text style={[styles.locationText, { color: theme.textSecondary }]} allowFontScaling={true}>
                    {item.inventarioNombre} • {item.cajaNombre} • {item.color}
                  </Text>
                ) : (
                  <>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      {item.alarmaFechaHora ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAB30815', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' }}>
                          <Ionicons name="time-outline" size={12} color="#EAB308" style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#EAB308' }} allowFontScaling={true}>
                            {new Date(item.alarmaFechaHora).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} {new Date(item.alarmaFechaHora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.border + '40', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' }}>
                          <Ionicons name="calendar-outline" size={11} color={theme.textSecondary} style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textSecondary }} allowFontScaling={true}>
                            {new Date(item.fechaCreacion || Date.now()).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {item.fotoUri && (
                        <TouchableOpacity
                          onPress={() => onImagePress(item.fotoUri)}
                          activeOpacity={0.85}
                          style={[styles.thumbnailContainer, { borderColor: theme.border, marginRight: item.fotoUri2 ? 6 : 0 }]}
                          accessibilityLabel="Ver primera fotografía"
                        >
                          <Image
                            source={{ uri: item.fotoUri }}
                            style={styles.thumbnail}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={200}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </View>
            </View>
            {isSelected && (
              <View style={[styles.selectionCheck, { backgroundColor: theme.text }]}>
                <Ionicons name="checkmark" size={14} color={theme.card} />
              </View>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Swipeable>
  );
}, (prev, next) => {
  return prev.isSelected === next.isSelected &&
    prev.item.id === next.item.id &&
    prev.item.estado === next.item.estado &&
    (prev.item as any).updated_at === (next.item as any).updated_at &&
    prev.isHighlighted === next.isHighlighted &&
    prev.theme === next.theme;
});

const styles = StyleSheet.create({
  shadowWrapper: {
    height: 126,
    marginBottom: 16,
    justifyContent: 'center',
    // Estilos manejados por animatedStyle
  },
  innerCard: {
    flexDirection: 'row',
    borderRadius: 24, // Ligeramente menor que el padre
    overflow: 'hidden',
    flex: 1,
  },
  colorBar: {
    width: 6,
    height: '100%',
  },
  historyCard: { marginBottom: 15 },
  itemContent: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'space-between' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, justifyContent: 'center' },
  itemStyle: { fontWeight: '800', includeFontPadding: false },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 5 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  colorSwatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 22 },
  infoGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 13, fontWeight: '600', includeFontPadding: false },
  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  locationText: { fontSize: 11, fontWeight: '500', fontStyle: 'italic' },
  selectionCheck: { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  swipeActionsContainer: {
    width: 80,
    flexDirection: 'row',
    height: '100%',
    paddingBottom: 12, // match card marginBottom
  },
  actionButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  thumbnailContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  thumbnail: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
});