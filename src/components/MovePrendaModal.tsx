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
import { Caja } from '../types';
import { CajaService } from '../services/CajaService';
import { useAppStore } from '../store/useAppStore';

interface MovePrendaModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectCaja: (cajaId: string) => void;
  currentCajaId: string;
}

export const MovePrendaModal = ({ isVisible, onClose, onSelectCaja, currentCajaId }: MovePrendaModalProps) => {
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isVisible && currentCajaId) {
      setLoading(true);
      CajaService.getSiblingCajas(db, currentCajaId)
        .then(data => {
          setCajas(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    } else {
      setCajas([]);
    }
  }, [isVisible, currentCajaId, db]);

  const renderItem = ({ item }: { item: Caja }) => (
    <TouchableOpacity
      style={[styles.cajaItem, { borderBottomColor: currentTheme.border }]}
      onPress={() => onSelectCaja(item.id)}
    >
      <Ionicons name="cube-outline" size={24} color={currentTheme.text} style={styles.icon} />
      <Text style={[styles.cajaText, { color: currentTheme.text }]}>{item.nombre}</Text>
      <Ionicons name="chevron-forward" size={20} color={currentTheme.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: currentTheme.card }]}>
          <View style={[styles.header, { borderBottomColor: currentTheme.border }]}>
            <Text style={[styles.title, { color: currentTheme.text }]}>Mover a...</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={currentTheme.primary} />
            </View>
          ) : cajas.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={{ color: currentTheme.textSecondary, textAlign: 'center' }}>
                No hay otras cajas en este inventario.
              </Text>
            </View>
          ) : (
            <FlatList
              data={cajas}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '40%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 40,
  },
  cajaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  icon: {
    marginRight: 12,
  },
  cajaText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
});
