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

const MONTHS_SHORT_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const formatShortDate = (dateInput: string | Date): string => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (!Number.isFinite(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT_ES[d.getMonth()]}`;
};

const formatShortTime = (dateInput: string | Date): string => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (!Number.isFinite(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatUri = (uri?: string | null) => {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('file://')) {
    return `file://${trimmed}`;
  }
  return trimmed;
};

const getCacheKey = (uri?: string | null, storageKey?: string | null) =>
  `${uri || ''}::${storageKey || ''}`;

const getImmediateUri = (uri?: string | null, storageKey?: string | null) => {
  const formatted = formatUri(uri);
  if (!formatted && !storageKey) return null;
  const key = getCacheKey(formatted, storageKey);
  if (resolvedUriCache.has(key)) {
    return resolvedUriCache.get(key)!;
  }
  return formatted;
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

  const [displayUri1, setDisplayUri1] = React.useState<string | null>(() => getImmediateUri(photo1, key1));
  const [displayUri2, setDisplayUri2] = React.useState<string | null>(() => getImmediateUri(photo2, key2));

  useEffect(() => {
    let isMounted = true;
    const u1 = formatUri(photo1);
    const u2 = formatUri(photo2);
    const k1 = getCacheKey(u1, key1);
    const k2 = getCacheKey(u2, key2);

    const cached1 = (!u1 && !key1) ? null : resolvedUriCache.get(k1);
    const cached2 = (!u2 && !key2) ? null : resolvedUriCache.get(k2);

    if (cached1 !== undefined && cached2 !== undefined) {
      if (cached1 !== displayUri1) setDisplayUri1(cached1);
      if (cached2 !== displayUri2) setDisplayUri2(cached2);
      return;
    }

    const resolveImages = async () => {
      const [r1, r2] = await Promise.all([
        cached1 !== undefined ? Promise.resolve(cached1) : R2Service.getResolvedImageUri(u1, key1),
        cached2 !== undefined ? Promise.resolve(cached2) : R2Service.getResolvedImageUri(u2, key2),
      ]);

      const final1 = formatUri(r1 || u1);
      const final2 = formatUri(r2 || u2);

      if (final1) resolvedUriCache.set(k1, final1);
      if (final2) resolvedUriCache.set(k2, final2);

      if (isMounted) {
        setDisplayUri1(prev => (prev === final1 ? prev : final1));
        setDisplayUri2(prev => (prev === final2 ? prev : final2));
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
        withTiming(1, { duration: 400 }),
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 800 })
      );
    } else {
      highlightOpacity.value = 0;
    }
  }, [isHighlighted, highlightOpacity]);

  const animatedStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      highlightOpacity.value,
      [0, 1],
      [theme.card, theme.primary + '32']
    );

    const animatedBorderColor = interpolateColor(
      highlightOpacity.value,
      [0, 1],
      [isSelected ? theme.primary : theme.border, theme.primary]
    );

    return {
      backgroundColor: bgColor,
      elevation: Platform.OS === 'android' ? 1 : 2,
      borderColor: isSelected ? theme.primary : animatedBorderColor,
      borderWidth: isSelected ? 1.5 : 1 + (highlightOpacity.value * 1.5),
      shadowColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.12)' : '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      borderRadius: 18,
      transform: [{ scale: 1 + (highlightOpacity.value * 0.025) }]
    };
  }, [isSelected, theme.primary, theme.card, theme.border]);

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
    ? `${formatShortDate(itemShippingAt)} | ${formatShortTime(itemShippingAt)}`
    : null;
  const shippingTextNode = shippingLabel ? (
    <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700', marginTop: 3 }} numberOfLines={1} allowFontScaling>
      ✓✓ Enviado · {shippingLabel}
    </Text>
  ) : null;
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
              <View style={styles.compactBadge}>
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

            {/* Fila 3 (Pie Inferior): Alarma/Fecha + Enviado abajo (Izquierda) + Fotos (Derecha) */}
            <View style={styles.itemFooter}>
              {historyMode ? (
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={1} allowFontScaling={true}>
                    {invTitle} • {boxTitle} • {item.color}
                  </Text>
                  {shippingTextNode}
                </View>
              ) : (
                <>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      {itemAlarmDate ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#FEF9C3', paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 6 }}>
                          <Ionicons name="time-outline" size={12} color="#CA8A04" style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#854D0E' }} allowFontScaling={true}>
                            {formatShortDate(itemAlarmDate)} {formatShortTime(itemAlarmDate)}
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}>
                          <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 12, fontWeight: '500', color: theme.textSecondary }} allowFontScaling={true}>
                            {formatShortDate(itemCreatedAt)}
                          </Text>
                        </View>
                      )}
                      {!!item.size && (
                        <View style={styles.infoGroup}>
                          <Ionicons name="brush-outline" size={13} color={theme.textSecondary} />
                          <Text style={{ fontSize: 12, fontWeight: '500', color: theme.textSecondary }} numberOfLines={1} allowFontScaling={true}>
                            {item.size}
                          </Text>
                        </View>
                      )}
                    </View>
                    {shippingTextNode}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {displayUri1 && (
                      <TouchableOpacity
                        onPress={() => onImagePress(displayUri1)}
                        activeOpacity={0.85}
                        style={[styles.thumbnailContainer, { borderColor: theme.border, marginRight: displayUri2 ? 4 : 0 }]}
                        accessibilityLabel="Ver primera fotografía"
                      >
                        <Image
                          source={{ uri: displayUri1 }}
                          recyclingKey={displayUri1}
                          style={styles.thumbnail}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={0}
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
                          recyclingKey={displayUri2}
                          style={styles.thumbnail}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={0}
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
      <View style={{ marginBottom: 8 }}>
        {cardContent}
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 8 }}>
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
    prev.canEdit === next.canEdit &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onDelete === next.onDelete &&
    prev.onMove === next.onMove &&
    prev.onToggleStatus === next.onToggleStatus &&
    prev.onImagePress === next.onImagePress &&
    (prev.item.status ?? (prev.item as any).estado) === (next.item.status ?? (next.item as any).estado) &&
    (prev.item.style ?? (prev.item as any).estilo) === (next.item.style ?? (next.item as any).estilo) &&
    prev.item.color === next.item.color &&
    prev.item.op === next.item.op &&
    (prev.item.photo_uri ?? (prev.item as any).fotoUri) === (next.item.photo_uri ?? (next.item as any).fotoUri) &&
    (prev.item.photo_uri_2 ?? (prev.item as any).fotoUri2) === (next.item.photo_uri_2 ?? (next.item as any).fotoUri2) &&
    ((prev.item as any).r2Key ?? (prev.item as any).primary_storage_key ?? (prev.item as any).storage_key) === ((next.item as any).r2Key ?? (next.item as any).primary_storage_key ?? (next.item as any).storage_key) &&
    ((prev.item as any).r2Key2 ?? (prev.item as any).secondary_storage_key) === ((next.item as any).r2Key2 ?? (next.item as any).secondary_storage_key) &&
    prev.item.shipping_at === next.item.shipping_at &&
    prev.item.created_at === next.item.created_at &&
    prev.item.box_name === next.item.box_name &&
    prev.item.inventory_name === next.item.inventory_name &&
    (prev.item.alarm_datetime ?? (prev.item as any).alarmaFechaHora) === (next.item.alarm_datetime ?? (next.item as any).alarmaFechaHora) &&
    prev.theme === next.theme &&
    prev.historyMode === next.historyMode;
});

export const PrendaCard = GarmentCard;

const styles = StyleSheet.create({
  shadowWrapper: {
    minHeight: 106,
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
  itemContent: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactBadge: { paddingVertical: 2, justifyContent: 'center' },
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
  selectionCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
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
