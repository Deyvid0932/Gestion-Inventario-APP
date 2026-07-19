import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity, Image,
  Animated as RNAnimated,
} from 'react-native';
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
      elevation: 0,
      borderColor: animatedBorderColor,
      borderWidth: 1,
      transform: [{ scale: 1 + (highlightOpacity.value * 0.02) }]
    };
  });

  const containerWidth = 160;

  const renderRightActions = (
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
  };

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
              <View style={styles.itemHeader}>
                <View style={styles.titleRow}>
                  <View style={[styles.compactBadge, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}>
                    <Text style={[styles.itemStyle, { color: theme.text, fontSize: historyMode ? 14 : 17 }]} numberOfLines={1}>
                      {item.estilo}
                    </Text>
                  </View>
                </View>
                {!historyMode && onToggleStatus && (
                  <TouchableOpacity
                    onPress={onToggleStatus}
                    activeOpacity={0.8}
                    style={[styles.statusBadge, { backgroundColor: estado === 1 ? '#2ecc7120' : '#8E8E9320' }]}
                  >
                    <View style={[styles.statusIndicator, { backgroundColor: estado === 1 ? '#2ecc71' : '#8E8E93' }]} />
                    <Text style={[styles.statusText, { color: estado === 1 ? '#2ecc71' : '#8E8E93' }]}>
                      {estado === 1 ? 'Activo' : 'Inactivo'}
                    </Text>
                  </TouchableOpacity>
                )}
                {historyMode && (
                  <View style={[styles.colorSwatch, { backgroundColor: colorHex, borderColor: theme.border }]} />
                )}
              </View>
              <View style={styles.itemFooter}>
                {historyMode ? (
                  <Text style={[styles.locationText, { color: theme.textSecondary }]}>
                    {item.inventarioNombre} • {item.cajaNombre} • {item.color}
                  </Text>
                ) : (
                  <>
                    <View style={styles.infoRow}>
                      <View style={styles.infoGroup}>
                        <Ionicons name="pricetag-outline" size={14} color={theme.textSecondary} />
                        <Text style={[styles.infoText, { color: theme.textSecondary }]}>{item.op || 'Sin OP'}</Text>
                      </View>
                      <View style={styles.infoGroup}>
                        <Ionicons name="color-palette-outline" size={14} color={theme.textSecondary} />
                        <Text style={[styles.infoText, { color: theme.textSecondary }]}>{item.color}</Text>
                      </View>
                    </View>

                    {item.fotoUri && (
                      <TouchableOpacity
                        onPress={() => onImagePress(item.fotoUri)}
                        activeOpacity={0.85}
                        style={[styles.thumbnailContainer, { borderColor: theme.border }]}
                      >
                        <Image
                          source={{ uri: item.fotoUri }}
                          style={styles.thumbnail}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    )}
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
    prev.isHighlighted === next.isHighlighted &&
    prev.item.estado === next.item.estado &&
    prev.item.estilo === next.item.estilo &&
    prev.item.color === next.item.color &&
    prev.item.op === next.item.op &&
    prev.item.fotoUri === next.item.fotoUri &&
    prev.theme === next.theme &&
    prev.historyMode === next.historyMode;
});

const styles = StyleSheet.create({
  shadowWrapper: {
    minHeight: 96,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    borderWidth: 1,
  },
  innerCard: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
  },
  colorBar: {
    width: 6,
    height: '100%',
  },
  historyCard: { marginBottom: 15 },
  itemContent: { flex: 1, padding: 15, justifyContent: 'center' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  itemStyle: { fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 5, marginRight: 8 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  colorSwatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 },
  infoRow: { flexDirection: 'row', gap: 15, flex: 1 },
  infoGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 13, fontWeight: '600' },
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
    marginRight: 8,
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
});