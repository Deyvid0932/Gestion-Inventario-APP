import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Animated } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { DetallePrenda } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { getColorHex } from '../utils/colorUtils';

//Interface son las propiedades del componente
interface DetallePrendaCardProps {
  detallePrenda: DetallePrenda;
  onToggleStatus: () => void;
  onLongPress?: (detallePrenda: DetallePrenda) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

//prev: son las propiedades anteriores del componente, next: son las nuevas propiedades del componente
const areEqual = (prev: DetallePrendaCardProps, next: DetallePrendaCardProps) => {
  return (
    prev.detallePrenda.id === next.detallePrenda.id &&
    Number(prev.detallePrenda.estado) === Number(next.detallePrenda.estado) &&
    prev.isSelected === next.isSelected &&
    prev.detallePrenda.estilo === next.detallePrenda.estilo &&
    prev.detallePrenda.op === next.detallePrenda.op &&
    prev.detallePrenda.color === next.detallePrenda.color
  );
};

//React.memo es un componente que renderiza si los datos cambian
export const DetallePrendaCard = React.memo(({ detallePrenda, onToggleStatus, onLongPress, isSelected, onSelect }: DetallePrendaCardProps) => {

  //useAppStore es un hook que nos permite acceder al estado global de la aplicación, en este caso el tema actual
  const currentTheme = useAppStore((state) => state.currentTheme);
  const estado = Number(detallePrenda.estado);

  // UseRef cambia el valor de scaleAnim sin causar un re-renderizado del componente
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const colorHex = getColorHex(detallePrenda.color);

  return (
    //TouchableOpacity es un button
    <TouchableOpacity 
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={() => onLongPress?.(detallePrenda)}
      onPress={() => onSelect?.(detallePrenda.id)}
    >   
      <Animated.View 
        style={[
          styles.card, 
          { 
            backgroundColor: isSelected ? currentTheme.primary + '15' : currentTheme.card,
            borderColor: isSelected ? currentTheme.primary : currentTheme.border,
            borderLeftColor: colorHex,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.styleTitle, { color: currentTheme.text }]} numberOfLines={1}>
              {detallePrenda.estilo}
            </Text>
            <Switch
              value={estado === 1}
              onValueChange={onToggleStatus}
              trackColor={{ false: '#767577', true: currentTheme.primary + '80' }}
              thumbColor={estado === 1 ? currentTheme.primary : '#f4f3f4'}
            />
          </View>

          <View style={styles.footer}>
            <View style={styles.infoGroup}>
              <Ionicons name="pricetag-outline" size={14} color={currentTheme.textSecondary} />
              <Text style={[styles.infoValue, { color: currentTheme.textSecondary }]}>
                {detallePrenda.op || 'Sin OP'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Ionicons name="color-palette-outline" size={14} color={currentTheme.textSecondary} />
              <Text style={[styles.infoValue, { color: currentTheme.textSecondary }]}>
                {detallePrenda.color}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}, areEqual);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 8,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    overflow: 'hidden'
  },
  content: { padding: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  styleTitle: { fontSize: 18, fontWeight: '800', flex: 1, marginRight: 10 },
  footer: { flexDirection: 'row', gap: 15 },
  infoGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoValue: { fontSize: 13, fontWeight: '600' },
});
