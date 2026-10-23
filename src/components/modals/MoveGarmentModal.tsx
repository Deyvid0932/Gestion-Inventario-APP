import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { Box } from '../../types';
import { BoxService } from '../../services';
import { useAppStore } from '../../store/useAppStore';

interface MoveGarmentModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectBox: (boxId: string, boxName: string) => void;
  currentBoxId: string;
}

export const MoveGarmentModal = ({ isVisible, onClose, onSelectBox, currentBoxId }: MoveGarmentModalProps) => {
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isVisible && currentBoxId) {
      setLoading(true);
      BoxService.getSiblingBoxes(db, currentBoxId)
        .then(data => {
          setBoxes(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    } else {
      setBoxes([]);
    }
  }, [isVisible, currentBoxId, db]);

  const renderItem = ({ item }: { item: Box }) => (
    <TouchableOpacity
      style={[
        styles.boxCard,
        {
          backgroundColor: currentTheme.card,
          borderColor: currentTheme.border,
        }
      ]}
      activeOpacity={0.7}
      onPress={() => onSelectBox(item.id, item.name)}
    >
      <View style={[styles.iconContainer, { backgroundColor: currentTheme.primary + '18' }]}>
        <Ionicons name="cube" size={22} color={currentTheme.primary} />
      </View>
      <View style={styles.boxInfo}>
        <Text style={[styles.boxTitle, { color: currentTheme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.boxSubtitle, { color: currentTheme.textSecondary }]}>
          Lote actual
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={currentTheme.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: currentTheme.text }]}>Mover Prenda</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={currentTheme.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.description, { color: currentTheme.textSecondary }]}>
            Selecciona la caja de destino dentro del mismo inventario para transferir esta prenda:
          </Text>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={currentTheme.primary} />
            </View>
          ) : boxes.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="cube-outline" size={40} color={currentTheme.textSecondary} />
              <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>
                No hay otras cajas disponibles en este inventario.
              </Text>
            </View>
          ) : (
            <FlatList
              data={boxes}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    padding: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  description: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  centerContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  listContainer: {
    paddingBottom: 16,
  },
  boxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  boxInfo: {
    flex: 1,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  boxSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default MoveGarmentModal;
