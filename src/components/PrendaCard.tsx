import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Animated } from 'react-native';
import { Prenda } from '../types';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import { getColorHex } from '../utils/colorUtils';

//Interface son las propiedades del componente
interface PrendaCardProps {
  prenda: Prenda;
  onToggleStatus: () => void;
  onLongPress?: (prenda: any) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  delayLongPress?: number;
}

const areEqual = (prev: PrendaCardProps, next: PrendaCardProps) => {
  return (
    //compara antes y despues si el id, estado, isSelected, estilo, op y color son iguales no renderiza el componente
    prev.prenda.id === next.prenda.id &&
    Number(prev.prenda.estado) === Number(next.prenda.estado) &&
    prev.isSelected === next.isSelected &&
    prev.prenda.estilo === next.prenda.estilo &&
    prev.prenda.op === next.prenda.op &&
    prev.prenda.color === next.prenda.color
  );
};

//React.memo es un componente que renderiza si los datos cambian
export const PrendaCard = React.memo(({ prenda, onToggleStatus, onLongPress, isSelected, onSelect }: PrendaCardProps) => {
  const currentTheme = useAppStore((state) => state.currentTheme);
  const estado = Number(prenda.estado);
  // UseRef cambia el valor de scaleAnim sin causar un re-renderizado del componente
  const scaleAnim = useRef(new Animated.Value(1)).current;

  //animación al presionar el boton de + lo encoge
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();

  //animación al soltar el boton de + lo deja en su tamaño original
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const colorHex = getColorHex(prenda.color);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={() => onLongPress?.(prenda)}
      onPress={() => onSelect?.(prenda.id)}
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
              {prenda.estilo}
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
                {prenda.op || 'Sin OP'}
              </Text>
            </View>
            <View style={styles.infoGroup}>
              <Ionicons name="color-palette-outline" size={14} color={currentTheme.textSecondary} />
              <Text style={[styles.infoValue, { color: currentTheme.textSecondary }]}>
                {prenda.color}
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
