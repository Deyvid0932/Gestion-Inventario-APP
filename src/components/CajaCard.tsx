import React, { memo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Swipeable, RectButton, TouchableOpacity } from 'react-native-gesture-handler';
import { CajaWithStats } from '../types';
import { clayStyles } from '../style/theme';

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

  return (
    <ScaleDecorator>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={canEdit ? renderRightActions : undefined}
        friction={2.5}
        rightThreshold={40}
        enabled={!isActive && canEdit}
      >
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={300}
          disabled={isActive}
          onPress={() => onPress(item.id, item.nombre)}
          activeOpacity={0.9}
          style={[
            styles.card,
            clayStyles,
            {
              backgroundColor: isActive ? theme.card + '90' : theme.card,
              borderColor: isActive ? theme.text : theme.border,
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
          </View>
        </TouchableOpacity>
      </Swipeable>
    </ScaleDecorator>
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
    marginBottom: 16,
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
    paddingBottom: 12,
  },
  actionButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 4,
  },
});


export default CajaCard;