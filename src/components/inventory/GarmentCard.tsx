import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated as RNAnimated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, RectButton, TouchableOpacity } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  interpolateColor,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Garment } from '../../types';
import { getColorHex } from '../../utils/colorUtils';
import { R2Service } from '../../services';

interface GarmentCardProps {
  item: Garment & { box_name?: string; inventory_name?: string; cajaNombre?: string; inventarioNombre?: string };
  theme: any;
  isSelected: boolean;
  isHighlighted: boolean;
  onPress: (item: Garment) => void;
  onLongPress?: (item: Garment) => void;
  onEdit?: (item: Garment) => void;
  onDelete?: (item: Garment) => void;
  onMove?: (item: Garment) => void;
  onToggleStatus?: (item: Garment) => void;
  historyMode?: boolean;
  canEdit?: boolean;
  onImagePress: (uri: string | null | undefined) => void;
}

const resolvedUriCache = new Map<string, string>();

const formatUri = (uri?: string | null) => {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('file://')) {
    return `file://${trimmed}`;
  }
  return trimmed;
};

const getImmediateUri = (uri?: string | null) => {
  if (!uri) return null;
  if (resolvedUriCache.has(uri)) {
    return resolvedUriCache.get(uri)!;
  }
  return formatUri(uri);
};

export const GarmentCard = React.memo(({
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
  canEdit = true,
  onImagePress,
}: GarmentCardProps) => {
  const photo1 = item.photo_uri || (item as any).fotoUri;
  const photo2 = item.photo_uri_2 || (item as any).fotoUri2;
  const key1 = (item as any).r2Key || (item as any).primary_storage_key || (item as any).storage_key;
  const key2 = (item as any).r2Key2 || (item as any).secondary_storage_key;

  const [displayUri1, setDisplayUri1] = React.useState<string | null>(formatUri(photo1));
  const [displayUri2, setDisplayUri2] = React.useState<string | null>(formatUri(photo2));

  useEffect(() => {
    let isMounted = true;

    const resolveImages = async () => {
      const u1 = formatUri(photo1);
      const u2 = formatUri(photo2);

      const r1 = await R2Service.getResolvedImageUri(u1, key1);
      const r2 = await R2Service.getResolvedImageUri(u2, key2);

      if (isMounted) {
        setDisplayUri1(formatUri(r1 || u1));
        setDisplayUri2(formatUri(r2 || u2));
      }
    };

    resolveImages();
    return () => {
      isMounted = false;
    };
  }, [photo1, photo2, key1, key2]);

  const swipeableRef = React.useRef<Swipeable>(null);
  const colorHex = getColorHex(item.color);
  const estado = item.status ?? (item as any).estado ?? 1;

  const highlightOpacity = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      highlightOpacity.value = withSequence(
        withTiming(1, { duration: 450 }),
        withTiming(0, { duration: 800 })
      );
    }
  }, [isHighlighted, highlightOpacity]);

  const animatedStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      highlightOpacity.value,
      [0, 1],
      [isSelected ? theme.primary + '12' : theme.card, theme.primary + '15']
    );

    const animatedBorderColor = interpolateColor(
      highlightOpacity.value,
      [0, 1],
      [isSelected ? theme.primary : theme.border, theme.primary]
    );

    return {
      backgroundColor: withTiming(bgColor, { duration: 250 }),
      elevation: Platform.OS === 'android' ? 1 : 2,
      borderColor: animatedBorderColor,
      borderWidth: 1,
      shadowColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.12)' : '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      borderRadius: 18,
      transform: [{ scale: 1 + (highlightOpacity.value * 0.02) }]
    };
  });

  const containerWidth = 160;

  const renderRightActions = useCallback((
    progress: RNAnimated.AnimatedInterpolation<number>
  ) => {
    if (!canEdit) return null;
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
                onMove(item);
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
                onDelete(item);
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#FFF" />
            </RectButton>
          </RNAnimated.View>
        )}
      </View>
    );
  }, [onMove, onDelete, canEdit, item]);

  const handlePress = React.useCallback(() => {
    onPress(item);
  }, [onPress, item]);

  const handleLongPress = React.useCallback(() => {
    swipeableRef.current?.close();
    if (onLongPress) {
      onLongPress(item);
    }
  }, [onLongPress, item]);

  const handleToggle = React.useCallback(() => {
    if (onToggleStatus) {
      onToggleStatus(item);
    }
  }, [onToggleStatus, item]);

  const itemStyleName = item.style || '';
  const itemAlarmDate = item.alarm_datetime || '';
  const itemCreatedAt = item.created_at || '';
  const itemShippingAt = item.shipping_at ? new Date(item.shipping_at) : null;
  const shippingLabel = itemShippingAt && Number.isFinite(itemShippingAt.getTime())
    ? `${itemShippingAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} | ${itemShippingAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
    : null;
  const boxTitle = item.box_name || '';
  const invTitle = item.inventory_name || '';

  const isDark = theme.text === '#FFFFFF' || theme.card === '#161821' || (theme.background && theme.background !== '#F8FAFC' && theme.background !== '#FDFBF7');

  const statusBg = estado === 1
    ? (isDark ? 'rgba(34, 197, 94, 0.16)' : '#E8F5E9')
    : (isDark ? 'rgba(148, 163, 184, 0.12)' : '#8E8E9320');

  const statusBorder = estado === 1
    ? (isDark ? 'rgba(74, 222, 128, 0.28)' : 'transparent')
    : (isDark ? 'rgba(148, 163, 184, 0.20)' : 'transparent');

  const statusTextColor = estado === 1
    ? (isDark ? '#4ADE80' : '#16A34A')
    : (isDark ? '#94A3B8' : '#8E8E93');

  const cardContent = (
    <TouchableOpacity
      activeOpacity={1}
      delayPressIn={0}
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      <Animated.View style={[
        styles.shadowWrapper,
        animatedStyle,
        historyMode && styles.historyCard
      ]}>
        <View style={styles.innerCard}>
          <View style={[styles.colorBar, { backgroundColor: colorHex }]} />
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <View style={[styles.compactBadge, { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, alignSelf: 'center' }]}>
                <Text style={[styles.itemStyle, { color: theme.text, fontSize: historyMode ? 14 : 16 }]} numberOfLines={1} allowFontScaling={true}>
                  {itemStyleName}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {!historyMode && onToggleStatus && (
                  <TouchableOpacity
                    onPress={handleToggle}
                    activeOpacity={0.8}
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusBg,
                        borderColor: statusBorder,
                        borderWidth: isDark ? 1 : 0,
                      }
                    ]}
                    accessibilityLabel={`Estado: ${estado === 1 ? 'Activo' : 'Inactivo'}`}
                    accessibilityRole="button"
                  >
                    <View style={[styles.statusIndicator, { backgroundColor: statusTextColor }]} />
                    <Text style={[styles.statusText, { color: statusTextColor }]} allowFontScaling={true}>
                      {estado === 1 ? 'ACTIVO' : 'INACTIVO'}
                    </Text>
                  </TouchableOpacity>
                )}
                {canEdit && !historyMode && (
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
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.locationText, { color: theme.textSecondary }]} allowFontScaling={true}>
                    {invTitle} • {boxTitle} • {item.color}
                  </Text>
                  {shippingLabel && (
                    <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700', marginTop: 3 }} numberOfLines={1} allowFontScaling>
                      ✓✓ Enviado · {shippingLabel}
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    {itemAlarmDate ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9C3', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' }}>
                        <Ionicons name="time-outline" size={13} color="#CA8A04" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#854D0E' }} allowFontScaling={true}>
                          {new Date(itemAlarmDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} {new Date(itemAlarmDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}>
                        <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 12, fontWeight: '500', color: theme.textSecondary }} allowFontScaling={true}>
                          {new Date(itemCreatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </Text>
                      </View>
                    )}
                    {shippingLabel && (
                      <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700', marginTop: 3 }} numberOfLines={1} allowFontScaling>
                        ✓✓ Enviado · {shippingLabel}
                      </Text>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {displayUri1 && (
                      <TouchableOpacity
                        onPress={() => onImagePress(displayUri1)}
                        activeOpacity={0.85}
                        style={[styles.thumbnailContainer, { borderColor: theme.border, marginRight: displayUri2 ? 6 : 0 }]}
                        accessibilityLabel="Ver primera fotografía"
                      >
                        <Image
                          source={{ uri: displayUri1 }}
                          style={styles.thumbnail}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={200}
                        />
                      </TouchableOpacity>
                    )}
                    {displayUri2 && (
                      <TouchableOpacity
                        onPress={() => onImagePress(displayUri2)}
                        activeOpacity={0.85}
                        style={[styles.thumbnailContainer, { borderColor: theme.border }]}
                        accessibilityLabel="Ver segunda fotografía"
                      >
                        <Image
                          source={{ uri: displayUri2 }}
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
            <View style={[styles.selectionCheck, { backgroundColor: theme.primary }]}>
              <Ionicons name="checkmark" size={14} color={theme.primaryText || '#FFFFFF'} />
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );

  if (!canEdit) {
    return (
      <View style={{ marginBottom: 12 }}>
        {cardContent}
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 12 }}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        friction={1.8}
        rightThreshold={40}
        overshootRight={false}
      >
        {cardContent}
      </Swipeable>
    </View>
  );
}, (prev, next) => {
  return prev.isSelected === next.isSelected &&
    prev.item.id === next.item.id &&
    prev.isHighlighted === next.isHighlighted &&
    (prev.item.status ?? (prev.item as any).estado) === (next.item.status ?? (next.item as any).estado) &&
    (prev.item.style ?? (prev.item as any).estilo) === (next.item.style ?? (next.item as any).estilo) &&
    prev.item.color === next.item.color &&
    prev.item.op === next.item.op &&
    (prev.item.photo_uri ?? (prev.item as any).fotoUri) === (next.item.photo_uri ?? (next.item as any).fotoUri) &&
    (prev.item.photo_uri_2 ?? (prev.item as any).fotoUri2) === (next.item.photo_uri_2 ?? (next.item as any).fotoUri2) &&
    prev.item.shipping_at === next.item.shipping_at &&
    (prev.item.alarm_datetime ?? (prev.item as any).alarmaFechaHora) === (next.item.alarm_datetime ?? (next.item as any).alarmaFechaHora) &&
    prev.theme === next.theme &&
    prev.historyMode === next.historyMode;
});

export const PrendaCard = GarmentCard;

const styles = StyleSheet.create({
  shadowWrapper: {
    minHeight: 114,
    justifyContent: 'center',
  },
  innerCard: {
    flexDirection: 'row',
    borderRadius: 18,
    overflow: 'hidden',
    flex: 1,
  },
  colorBar: {
    width: 5,
    height: '100%',
  },
  historyCard: {},
  itemContent: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'space-between' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, justifyContent: 'center' },
  itemStyle: { fontWeight: '800', letterSpacing: 0.5, includeFontPadding: false },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 5 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
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
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  swipeHintBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});

export default GarmentCard;
