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
  onSelectCaja: (cajaId: string, nombreCaja: string) => void;
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

  const renderItem = ({ item, index }: { item: Caja, index: number }) => (
    <TouchableOpacity
      style={[
        styles.cajaCard,
        {
          backgroundColor: currentTheme.card,
          borderColor: currentTheme.border,
        }
      ]}
      activeOpacity={0.7}
      onPress={() => onSelectCaja(item.id, item.nombre)}
    >
      <View style={[styles.iconContainer, { backgroundColor: currentTheme.primary + '18' }]}>
        <Ionicons name="cube" size={22} color={currentTheme.primary} />
      </View>

      <View style={styles.cajaInfo}>
        <Text style={[styles.cajaTitle, { color: currentTheme.text }]} numberOfLines={1}>
          {item.nombre}
        </Text>
        <Text style={[styles.cajaSubtitle, { color: currentTheme.textSecondary }]}>
          Caja N° {index + 1} del Inventario
        </Text>
      </View>

      <View style={[styles.arrowBadge, { backgroundColor: currentTheme.primary + '15' }]}>
        <Ionicons name="arrow-forward" size={16} color={currentTheme.primary} />
      </View>
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
        <TouchableOpacity style={styles.backdropPress} activeOpacity={1} onPress={onClose} />

        <View style={[styles.modalContainer, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          <View style={styles.handleBarContainer}>
            <View style={[styles.handleBar, { backgroundColor: currentTheme.border }]} />
          </View>

          <View style={[styles.header, { borderBottomColor: currentTheme.border }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconBg, { backgroundColor: currentTheme.primary + '20' }]}>
                <Ionicons name="swap-horizontal" size={22} color={currentTheme.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: currentTheme.text }]}>Mover Prenda de Caja</Text>
                <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>
                  Selecciona la caja de destino
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: currentTheme.border + '50' }]}
              accessibilityLabel="Cerrar modal"
            >
              <Ionicons name="close" size={20} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={currentTheme.primary} />
              <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>
                Cargando cajas disponibles...
              </Text>
            </View>
          ) : cajas.length === 0 ? (
            <View style={styles.centerContent}>
              <View style={[styles.emptyIconBg, { backgroundColor: currentTheme.border + '40' }]}>
                <Ionicons name="archive-outline" size={42} color={currentTheme.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>
                No hay otras cajas disponibles
              </Text>
              <Text style={[styles.emptySub, { color: currentTheme.textSecondary }]}>
                Crea una nueva caja en este inventario para poder trasladar prendas.
              </Text>
            </View>
          ) : (
            <FlatList
              data={cajas}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdropPress: {
    flex: 1,
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '75%',
    minHeight: '45%',
    borderWidth: 1,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 18,
    paddingBottom: 32,
  },
  cajaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cajaInfo: {
    flex: 1,
  },
  cajaTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cajaSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  arrowBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 220,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
