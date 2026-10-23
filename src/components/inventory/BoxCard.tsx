import React, { memo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
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
import { BoxWithStats } from '../../types';

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const formatBoxDate = (dateString?: string | null) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = d.getDate();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const month = months[d.getMonth()];
    return `${day} ${month}`;
  } catch {
    return dateString;
  }
};

interface BoxCardProps {
  item: BoxWithStats;
  onPress: (id: string, name: string) => void;
  onEdit: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  theme: any;
  drag?: () => void;
  isActive?: boolean;
  canEdit?: boolean;
}

export const BoxCard = memo(({
  item,
  onPress,
  onEdit,
  onDelete,
  theme,
  drag,
  isActive = false,
  canEdit = true,
}: BoxCardProps) => {
  const swipeableRef = useRef<Swipeable>(null);
  const scale = useSharedValue(1);

  const itemName = item.name || (item as any).nombre || '';
  const itemDate = item.created_at || (item as any).fechaCreacion || new Date().toISOString();
  const itemCount = item.itemCount ?? (item as any).totalPrendas ?? 0;

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

  const renderRightActions = useCallback((
    progress: Animated.AnimatedInterpolation<number>
  ) => {
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
              onEdit(item.id, itemName);
            }}
          >
            <Ionicons name="pencil-outline" size={24} color="#FFF" />
          </RectButton>
        </Animated.View>
        <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onDelete(item.id, itemName);
            }}
          >
            <Ionicons name="trash-outline" size={24} color="#FFF" />
          </RectButton>
        </Animated.View>
      </View>
    );
  }, [onEdit, onDelete, item.id, itemName, canEdit]);

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
        onLongPress={handleLongPress}
        delayLongPress={150}
        onPress={() => onPress(item.id, itemName)}
        activeOpacity={0.85}
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
        <View style={styles.cardMain}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: theme.background === '#000000'
                  ? '#27272A'
                  : (theme.primary ? `${theme.primary}18` : '#FCE7F3'),
                borderColor: theme.background === '#000000'
                  ? '#3F3F46'
                  : (theme.primary ? `${theme.primary}25` : '#FBCFE8'),
              }
            ]}
          >
            <Ionicons name="cube" size={26} color={theme.primary} />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {itemName}
            </Text>
            <View style={styles.cardFooter}>
              <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
              <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                {formatBoxDate(itemDate)}
              </Text>
              <Text style={[styles.dot, { color: theme.textSecondary }]}>•</Text>
              <Ionicons name="shirt-outline" size={13} color={theme.textSecondary} />
              <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                {itemCount} {itemCount === 1 ? 'prenda' : 'prendas'}
              </Text>
            </View>
          </View>

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
        rightThreshold={40}
        overshootRight={false}
      >
        {cardContent}
      </Swipeable>
    </View>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
    (prev.item.name || (prev.item as any).nombre) === (next.item.name || (next.item as any).nombre) &&
    prev.item.itemCount === next.item.itemCount &&
    prev.isActive === next.isActive &&
    prev.canEdit === next.canEdit &&
    prev.theme === next.theme;
});

export const CajaCard = BoxCard;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 16,
    borderRadius: 18,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dot: {
    marginHorizontal: 4,
    fontSize: 12,
  },
  swipeActionsContainer: {
    width: 160,
    flexDirection: 'row',
    height: '100%',
  },
  actionButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    marginHorizontal: 4,
  },
  swipeHintBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});

export default BoxCard;
