import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import { DetallePrenda } from '../types';

interface DetallePrendaCardProps {
  detallePrenda: DetallePrenda;
  onToggleStatus: () => void;
  onLongPress?: (detallePrenda: DetallePrenda) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

const areEqual = (prev: DetallePrendaCardProps, next: DetallePrendaCardProps) => {
  return (
    prev.detallePrenda.id === next.detallePrenda.id &&
    prev.detallePrenda.op === next.detallePrenda.op &&
    prev.detallePrenda.estilo === next.detallePrenda.estilo &&
    prev.detallePrenda.color === next.detallePrenda.color &&
    (prev.detallePrenda).estado === (next.detallePrenda).estado &&
    
    prev.isSelected === next.isSelected
  );
};

export const DetallePrendaCard = React.memo(({ detallePrenda, onToggleStatus, onLongPress, isSelected, onSelect }: DetallePrendaCardProps) => {

  const currentTheme = useAppStore((state) => state.currentTheme);
  const estado = Number(detallePrenda.estado)

  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { 
          backgroundColor: isSelected ? currentTheme.primary + '15' : currentTheme.card,
          borderColor: isSelected ? currentTheme.primary : currentTheme.border 
        }
      ]}
      onLongPress={() => onLongPress?.(detallePrenda)}
      onPress={() => onSelect?.(detallePrenda.id)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.opContainer}>
          <Text style={[styles.label, { color: currentTheme.textSecondary }]}>Estilo</Text>
          <Text style={[styles.opValue, { color: currentTheme.text }]}>{detallePrenda.estilo}</Text>
        </View>
        <Switch
          value={estado === 1 ? true : false}
          onValueChange={onToggleStatus}
          trackColor={{ false: '#767577', true: currentTheme.primary + '80' }}
          thumbColor={estado === 1 ? currentTheme.primary : '#f4f3f4'}
        />
      </View>
      <View style={styles.body}>
        <View style={styles.infoRow}>
         <Text style={[styles.label, { color: currentTheme.textSecondary }]}>OP</Text>
          <Text style={[styles.estiloText, { color: currentTheme.text }]}>{detallePrenda.op}</Text>
        </View>
    
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
             <Text style={[styles.detailLabel, { color: currentTheme.textSecondary }]}>Color:</Text>
             <Text style={[styles.detailValue, { color: currentTheme.text }]}>{detallePrenda.color}</Text>
          </View>

          <View style={[styles.badge, { backgroundColor: estado === 1 ? '#2ecc7120' : '#95a5a620' }]}>
            <Text style={[styles.badgeText, { color: estado === 1 ? '#27ae60' : '#7f8c8d' }]}>
              {estado === 1 ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>

      </View>
    </TouchableOpacity>
  );
}, areEqual);

const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  opContainer: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  opValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  body: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  estiloText: {
    fontSize: 16,
    fontWeight: '500',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  }
});
