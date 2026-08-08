import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { InventarioService } from '../services/InventarioService';
import { CajaService } from '../services/CajaService';
import { PrendaService } from '../services/PrendaService';
import { AuthManager } from '../services/AuthManager';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../database/supabase';
import { RoleGuard } from './RoleGuard';

interface TrashModalProps {
  visible: boolean;
  onClose: () => void;
}

interface PendingDeletionItem {
  id: string;
  tableName: string;
  recordId: string;
  createdAt: string;
}

export const TrashModal: React.FC<TrashModalProps> = ({ visible, onClose }) => {
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const user = useAppStore(state => state.user);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'inventarios' | 'cajas' | 'prendas'>('inventarios');
  const [items, setItems] = useState<PendingDeletionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadTrashItems = useCallback(async () => {
    setLoading(true);
    try {
      const combined: PendingDeletionItem[] = [];

      const deletedInventarios = await db.getAllAsync<{ id: string; nombre: string; deleted_at?: string; fechaCreacion: string }>(
        `SELECT id, nombre, deleted_at, fechaCreacion FROM inventarios WHERE deleted_at IS NOT NULL`
      );
      for (const inv of deletedInventarios || []) {
        combined.push({
          id: `soft_inv_${inv.id}`,
          tableName: 'inventarios',
          recordId: inv.id,
          createdAt: inv.deleted_at || inv.fechaCreacion || new Date().toISOString(),
        });
      }

      const deletedCajas = await db.getAllAsync<{ id: string; nombre: string; deleted_at?: string; fechaCreacion: string }>(
        `SELECT id, nombre, deleted_at, fechaCreacion FROM cajas WHERE deleted_at IS NOT NULL AND inventarioId NOT IN (SELECT id FROM inventarios WHERE deleted_at IS NOT NULL)`
      );
      for (const caja of deletedCajas || []) {
        combined.push({
          id: `soft_caja_${caja.id}`,
          tableName: 'cajas',
          recordId: caja.id,
          createdAt: caja.deleted_at || caja.fechaCreacion || new Date().toISOString(),
        });
      }

      const deletedPrendas = await db.getAllAsync<{ id: string; estilo: string; deleted_at?: string; fechaCreacion: string }>(
        `SELECT id, estilo, deleted_at, fechaCreacion FROM prendas WHERE deleted_at IS NOT NULL AND cajaId NOT IN (SELECT id FROM cajas WHERE deleted_at IS NOT NULL)`
      );
      for (const prenda of deletedPrendas || []) {
        combined.push({
          id: `soft_prenda_${prenda.id}`,
          tableName: 'prendas',
          recordId: prenda.id,
          createdAt: prenda.deleted_at || prenda.fechaCreacion || new Date().toISOString(),
        });
      }

      const pendingRows = await db.getAllAsync<PendingDeletionItem>(
        `SELECT * FROM pending_deletions ORDER BY createdAt DESC`
      );
      const existingRecordIds = new Set(combined.map(c => c.recordId));
      for (const p of pendingRows || []) {
        if (!existingRecordIds.has(p.recordId)) {
          combined.push(p);
        }
      }

      setItems(combined);
    } catch (e) {
      console.error('Error cargando elementos de la papelera:', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (visible) {
      loadTrashItems();
    }
  }, [visible, loadTrashItems]);

  const counts = React.useMemo(() => {
    return {
      inventarios: items.filter(i => i.tableName === 'inventarios').length,
      cajas: items.filter(i => i.tableName === 'cajas').length,
      prendas: items.filter(i => i.tableName === 'prendas').length,
    };
  }, [items]);

  const displayedItems = React.useMemo(() => {
    return items.filter(item => item.tableName === activeTab);
  }, [items, activeTab]);

  const handleRestore = async (item: PendingDeletionItem) => {
    setProcessingId(item.id);
    try {
      let result: { success: boolean; error?: string } = { success: true };
      if (item.tableName === 'inventarios') {
        result = await InventarioService.restore(db, item.recordId, user?.id);
      } else if (item.tableName === 'cajas') {
        result = await CajaService.restore(db, item.recordId, user?.id);
      } else if (item.tableName === 'prendas') {
        result = await PrendaService.restore(db, item.recordId, user?.id);
      }

      if (!result.success) {
        Alert.alert('No se puede restaurar', result.error || 'Ocurrió un fallo al restaurar el elemento.');
        return;
      }

      await db.runAsync(`DELETE FROM pending_deletions WHERE recordId = ? OR id = ?`, [item.recordId, item.id]);
      await AuthManager.refreshAllAppState(db);
      Alert.alert('Restaurado', 'El elemento fue restaurado exitosamente.');
      await loadTrashItems();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo restaurar el elemento.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async (item: PendingDeletionItem) => {
    Alert.alert(
      '¿Eliminar Definitivamente?',
      'Esta acción eliminará el registro de la nube y de la cola local de forma irreversible.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              const tableMap: Record<string, string> = {
                inventarios: 'inventories',
                cajas: 'boxes',
                prendas: 'garments',
                chat_sessions: 'chat_sessions',
                chat_history: 'chat_messages',
              };
              if (item.tableName === 'inventarios') {
                await InventarioService.hardDelete(db, item.recordId, user?.id);
              } else if (item.tableName === 'cajas') {
                await CajaService.hardDelete(db, item.recordId, user?.id);
              } else if (item.tableName === 'prendas') {
                await PrendaService.hardDelete(db, item.recordId, user?.id);
              } else {
                const tableMap: Record<string, string> = {
                  chat_sessions: 'chat_sessions',
                  chat_history: 'chat_messages',
                };
                const remoteTable = tableMap[item.tableName] || item.tableName;
                const { error } = await supabase.from(remoteTable).delete().eq('id', item.recordId);
                if (!error) {
                  await db.runAsync(`DELETE FROM pending_deletions WHERE id = ?`, [item.id]);
                }
              }
              await loadTrashItems();
            } catch (e) {
              console.error(e);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleEmptyTrash = async () => {
    if (items.length === 0) return;
    Alert.alert(
      '¿Vaciar Papelera?',
      'Se purgarán de forma definitiva todos los registros pendientes de eliminación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar Todo',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              for (const item of items) {
                if (item.tableName === 'inventarios') {
                  const cajas = await db.getAllAsync<{ id: string }>('SELECT id FROM cajas WHERE inventarioId = ?', [item.recordId]);
                  const cajaIds = cajas.map(c => c.id);
                  if (cajaIds.length > 0) {
                    try { await supabase.from('garments').delete().in('caja_id', cajaIds); } catch (_) {}
                    try { await supabase.from('boxes').delete().in('id', cajaIds); } catch (_) {}
                  }
                  const { error } = await supabase.from('inventories').delete().eq('id', item.recordId);
                  if (error) {
                    const deletionId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    await db.runAsync(`INSERT INTO pending_deletions (id, tableName, recordId, createdAt) VALUES (?, 'inventarios', ?, ?)`, [deletionId, item.recordId, new Date().toISOString()]);
                  }
                  await db.runAsync(`DELETE FROM prendas WHERE cajaId IN (SELECT id FROM cajas WHERE inventarioId = ?)`, [item.recordId]);
                  await db.runAsync(`DELETE FROM cajas WHERE inventarioId = ?`, [item.recordId]);
                  await db.runAsync(`DELETE FROM inventarios WHERE id = ?`, [item.recordId]);
                } else {
                  const tableMap: Record<string, string> = {
                    inventarios: 'inventories',
                    cajas: 'boxes',
                    prendas: 'garments',
                    chat_sessions: 'chat_sessions',
                    chat_history: 'chat_messages',
                  };
                  const remoteTable = tableMap[item.tableName] || item.tableName;
                  const { error } = await supabase.from(remoteTable).delete().eq('id', item.recordId);
                  if (!error) {
                    await db.runAsync(`DELETE FROM pending_deletions WHERE id = ?`, [item.id]);
                  }
                }
              }
              await loadTrashItems();
            } catch (e) {
              console.error(e);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getEntityIcon = (tableName: string) => {
    switch (tableName) {
      case 'inventarios': return 'file-tray-stacked-outline';
      case 'cajas': return 'archive-outline';
      case 'prendas': return 'shirt-outline';
      case 'chat_sessions':
      case 'chat_history': return 'chatbubbles-outline';
      default: return 'trash-outline';
    }
  };

  const getEntityName = (tableName: string) => {
    switch (tableName) {
      case 'inventarios': return 'Lote / Inventario';
      case 'cajas': return 'Caja de Almacén';
      case 'prendas': return 'Prenda de Vestir';
      case 'chat_sessions': return 'Sesión de Chat';
      case 'chat_history': return 'Mensaje de Chat';
      default: return tableName;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <RoleGuard roles={['Admin']}>
        <View style={styles.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
          <View
            style={[
              styles.container,
              {
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.border,
                paddingTop: Math.max(insets.top, 20),
                paddingBottom: Math.max(insets.bottom + 20, 24),
              },
            ]}
          >
            {/* Header Modal */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="trash-bin-outline" size={24} color="#EF4444" style={{ marginRight: 8 }} />
                <View>
                  <Text style={[styles.title, { color: currentTheme.text }]}>Papelera de Reciclaje</Text>
                  <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>
                    {items.length} elemento{items.length !== 1 ? 's' : ''} pendiente{items.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>

                <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}>
                  <Ionicons name="close" size={20} color={currentTheme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Barra de Pestañas: [ Inventarios ] [ Cajas ] [ Prendas ] */}
            <View style={[styles.tabBar, { borderBottomColor: currentTheme.border }]}>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'inventarios' && { backgroundColor: currentTheme.primary + '25', borderColor: currentTheme.primary }]}
                onPress={() => setActiveTab('inventarios')}
              >
                <Ionicons
                  name="file-tray-stacked-outline"
                  size={14}
                  color={activeTab === 'inventarios' ? currentTheme.primary : currentTheme.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.tabLabel, { color: activeTab === 'inventarios' ? currentTheme.primary : currentTheme.textSecondary }]}>
                  Lotes ({counts.inventarios})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'cajas' && { backgroundColor: currentTheme.primary + '25', borderColor: currentTheme.primary }]}
                onPress={() => setActiveTab('cajas')}
              >
                <Ionicons
                  name="archive-outline"
                  size={14}
                  color={activeTab === 'cajas' ? currentTheme.primary : currentTheme.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.tabLabel, { color: activeTab === 'cajas' ? currentTheme.primary : currentTheme.textSecondary }]}>
                  Cajas ({counts.cajas})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'prendas' && { backgroundColor: currentTheme.primary + '25', borderColor: currentTheme.primary }]}
                onPress={() => setActiveTab('prendas')}
              >
                <Ionicons
                  name="shirt-outline"
                  size={14}
                  color={activeTab === 'prendas' ? currentTheme.primary : currentTheme.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.tabLabel, { color: activeTab === 'prendas' ? currentTheme.primary : currentTheme.textSecondary }]}>
                  Prendas ({counts.prendas})
                </Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={currentTheme.primary} />
                <Text style={{ color: currentTheme.textSecondary, marginTop: 12 }}>Cargando papelera...</Text>
              </View>
            ) : displayedItems.length === 0 ? (
              <View style={styles.centerContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: currentTheme.primary + '15' }]}>
                  <Ionicons name="trash-outline" size={44} color={currentTheme.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>Sin {activeTab === 'inventarios' ? 'Lotes' : activeTab === 'cajas' ? 'Cajas' : 'Prendas'}</Text>
                <Text style={[styles.emptyDesc, { color: currentTheme.textSecondary }]}>
                  No hay {activeTab === 'inventarios' ? 'lotes' : activeTab === 'cajas' ? 'cajas' : 'prendas'} en este apartado de la papelera.
                </Text>
              </View>
            ) : (
              <FlatList
                data={displayedItems}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <View style={[styles.card, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: currentTheme.primary + '20' }]}>
                        <Ionicons name={getEntityIcon(item.tableName) as any} size={20} color={currentTheme.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: currentTheme.text }]}>{getEntityName(item.tableName)}</Text>
                        <Text style={[styles.cardSub, { color: currentTheme.textSecondary }]}>ID: {item.recordId}</Text>
                        <Text style={[styles.cardDate, { color: currentTheme.textSecondary }]}>
                          Eliminado: {new Date(item.createdAt).toLocaleString('es-ES')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.btnRestore, { backgroundColor: currentTheme.primary + '15' }]}
                        onPress={() => handleRestore(item)}
                        disabled={processingId === item.id}
                      >
                        <Ionicons name="refresh-outline" size={15} color={currentTheme.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.btnRestoreText, { color: currentTheme.primary }]}>Restaurar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btnDelete, { backgroundColor: '#EF444415' }]}
                        onPress={() => handlePermanentDelete(item)}
                        disabled={processingId === item.id}
                      >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={styles.btnDeleteText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>

                    {processingId === item.id && (
                      <View style={styles.cardOverlay}>
                        <ActivityIndicator size="small" color={currentTheme.primary} />
                      </View>
                    )}
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </RoleGuard>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '82%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
  },
  emptyTrashBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  emptyTrashText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 11,
    fontFamily: 'Platform',
    marginTop: 1,
  },
  cardDate: {
    fontSize: 11,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
  },
  btnRestore: {
    flex: 1,
    flexDirection: 'row',
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRestoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  btnDelete: {
    flex: 1,
    flexDirection: 'row',
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDeleteText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
