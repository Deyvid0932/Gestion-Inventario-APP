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
import { CajaWithStats } from '../types';
import { clayStyles } from '../style/theme';

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

interface CajaCardProps {
  item: CajaWithStats;
  onPress: (id: string, nombre: string) => void;
  onEdit: (id: string, nombre: string) => void;
  onDelete: (id: string, nombre: string) => void;
  theme: any;
  drag: () => void;
  isActive: boolean;
  canEdit?: boolean;
}

const CajaCard = memo(({
  item,
  onPress,
  onEdit,
  onDelete,
  theme,
  drag,
  isActive,
  canEdit = true,
}: CajaCardProps) => {
  const swipeableRef = useRef<Swipeable>(null);
  const scale = useSharedValue(1);
  const elevation = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      scale.value = withSpring(1.04, SPRING_CONFIG);
      elevation.value = withSpring(1, SPRING_CONFIG);
    } else {
      scale.value = withSpring(1, SPRING_CONFIG);
      elevation.value = withSpring(0, SPRING_CONFIG);
    }
  }, [isActive, scale, elevation]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: 0.08 + elevation.value * 0.18,
    shadowRadius: 4 + elevation.value * 12,
    ...(Platform.OS === 'android' ? { elevation: 2 + elevation.value * 8 } : {}),
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
            style={[styles.actionButton, { backgroundColor: '#f3dd12' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onEdit(item.id, item.nombre);
            }}
          >
            <Ionicons name="pencil-outline" size={24} color="#FFF" />
          </RectButton>
        </Animated.View>
        <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onDelete(item.id, item.nombre);
            }}
          >
            <Ionicons name="trash-outline" size={24} color="#FFF" />
          </RectButton>
        </Animated.View>
      </View>
    );
  }, [onEdit, onDelete, item.id, item.nombre, canEdit]);

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
        onPress={() => onPress(item.id, item.nombre)}
        activeOpacity={0.85}
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
          <View style={[styles.iconContainer, { backgroundColor: theme.background === '#000000' ? '#27272A' : '#F4F4F5', borderColor: theme.border }]}>
            <Ionicons name="archive" size={24} color={theme.primary} />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {item.nombre}
            </Text>
            <View style={styles.cardFooter}>
              <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
              <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                {new Date(item.fechaCreacion).toLocaleDateString()}
              </Text>
              <Text style={[styles.dot, { color: theme.textSecondary }]}>•</Text>
              <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                {item.itemCount} prendas
              </Text>
            </View>
          </View>

          {canEdit && (
            <View style={styles.swipeHintBadge}>
              <Ionicons name="chevron-back" size={14} color={theme.textSecondary} />
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
    prev.item.nombre === next.item.nombre &&
    prev.item.itemCount === next.item.itemCount &&
    prev.isActive === next.isActive &&
    prev.theme === next.theme;
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dot: {
    marginHorizontal: 6,
    fontSize: 14,
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
    borderRadius: 12,
    marginHorizontal: 4,
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


export default CajaCard;