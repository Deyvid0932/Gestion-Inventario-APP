import React, { memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Swipeable, RectButton, TouchableOpacity } from 'react-native-gesture-handler';
import { CajaWithStats } from '../types';

interface CajaCardProps {
  item: CajaWithStats;
  onPress: (id: string, nombre: string) => void;
  onEdit: (id: string, nombre: string) => void;
  onDelete: (id: string, nombre: string) => void;
  theme: any;
  drag: () => void;
  isActive: boolean;
}

const CajaCard = memo(({
  item,
  onPress,
  onEdit,
  onDelete,
  theme,
  drag,
  isActive
}: CajaCardProps) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>
  ) => {
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
  };

  return (
    <ScaleDecorator>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        friction={2.5}
        rightThreshold={40}
        enabled={!isActive}
      >
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={300}
          disabled={isActive}
          onPress={() => onPress(item.id, item.nombre)}
          activeOpacity={0.9}
          style={[
            styles.card,
            {
              backgroundColor: isActive ? theme.primary + '20' : theme.card,
              borderColor: isActive ? theme.primary : theme.border,
            }
          ]}
        >
          <View style={styles.cardMain}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="archive" size={26} color={theme.primary} />
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
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  swipeActionsContainer: {
    width: 160,
    flexDirection: 'row',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 20, 
    marginHorizontal: 4,
  },
});


export default React.memo(CajaCard);