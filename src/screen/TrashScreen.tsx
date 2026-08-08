import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppStore } from '../store/useAppStore';
import { InventarioService } from '../services/InventarioService';
import { CajaService } from '../services/CajaService';
import { PrendaService } from '../services/PrendaService';
import { AuthManager } from '../services/AuthManager';
import { RootStackParamList } from '../types';
import { supabase } from '../database/supabase';
import { RoleGuard } from '../components/RoleGuard';
import { EmptyState } from '../components/EmptyState';

interface PendingDeletionItem {
  id: string;
  tableName: string;
  recordId: string;
  title: string;
  createdAt: string;
  deletedAt?: string | null;
}

export const TrashScreen: React.FC = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const currentTheme = useAppStore(state => state.currentTheme);
  const user = useAppStore(state => state.user);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'inventarios' | 'cajas' | 'prendas'>('inventarios');
  const [items, setItems] = useState<PendingDeletionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadTrashItems = useCallback(async () => {
    setLoading(true);
    try {
      const combined: PendingDeletionItem[] = [];

      // 1. Inventarios eliminados lógicamente
      const deletedInventarios = await db.getAllAsync<{ id: string; nombre: string; deleted_at?: string; fechaCreacion: string }>(
        `SELECT id, nombre, deleted_at, fechaCreacion FROM inventarios WHERE deleted_at IS NOT NULL`
      );
      for (const inv of deletedInventarios || []) {
        combined.push({
          id: `inv_${inv.id}`,
          tableName: 'inventarios',
          recordId: inv.id,
          title: inv.nombre || 'Lote / Inventario',
          createdAt: inv.deleted_at || inv.fechaCreacion || new Date().toISOString(),
          deletedAt: inv.deleted_at,
        });
      }

      // 2. Cajas eliminadas lógicamente (solo cajas borradas individualmente cuyo lote NO esté borrado)
      const deletedCajas = await db.getAllAsync<{ id: string; nombre: string; deleted_at?: string; fechaCreacion: string }>(
        `SELECT id, nombre, deleted_at, fechaCreacion FROM cajas WHERE deleted_at IS NOT NULL AND inventarioId NOT IN (SELECT id FROM inventarios WHERE deleted_at IS NOT NULL)`
      );
      for (const caja of deletedCajas || []) {
        combined.push({
          id: `caja_${caja.id}`,
          tableName: 'cajas',
          recordId: caja.id,
          title: caja.nombre || 'Caja de Almacén',
          createdAt: caja.deleted_at || caja.fechaCreacion || new Date().toISOString(),
          deletedAt: caja.deleted_at,
        });
      }

      // 3. Prendas eliminadas lógicamente (solo prendas borradas individualmente cuya caja NO esté borrada)
      const deletedPrendas = await db.getAllAsync<{ id: string; estilo: string; color: string; deleted_at?: string; fechaCreacion: string }>(
        `SELECT id, estilo, color, deleted_at, fechaCreacion FROM prendas WHERE deleted_at IS NOT NULL AND cajaId NOT IN (SELECT id FROM cajas WHERE deleted_at IS NOT NULL)`
      );
      for (const prenda of deletedPrendas || []) {
        combined.push({
          id: `prenda_${prenda.id}`,
          tableName: 'prendas',
          recordId: prenda.id,
          title: `${prenda.estilo || 'Prenda'} - ${prenda.color || ''}`,
          createdAt: prenda.deleted_at || prenda.fechaCreacion || new Date().toISOString(),
          deletedAt: prenda.deleted_at,
        });
      }

      // 4. Registros pendientes en cola pending_deletions (si no están duplicados)
      const pendingRows = await db.getAllAsync<{ id: string; tableName: string; recordId: string; createdAt: string }>(
        `SELECT * FROM pending_deletions ORDER BY createdAt DESC`
      );
      const existingRecordIds = new Set(combined.map(c => c.recordId));
      for (const p of pendingRows || []) {
        if (!existingRecordIds.has(p.recordId)) {
          combined.push({
            id: p.id,
            tableName: p.tableName,
            recordId: p.recordId,
            title: `${p.tableName}: ${p.recordId}`,
            createdAt: p.createdAt,
            deletedAt: p.createdAt,
          });
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
    loadTrashItems();
  }, [loadTrashItems]);

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

  const computeRemainingTime = (deletedAt?: string | null) => {
    if (!deletedAt) return '48h restantes';
    const deletedTime = new Date(deletedAt).getTime();
    const expiresAt = deletedTime + 48 * 60 * 60 * 1000;
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return 'Vencido (pendiente de purga)';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m restantes`;
  };

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

  const deleteItemHelper = async (item: PendingDeletionItem) => {
    let result: { success: boolean; error?: string } = { success: true };
    if (item.tableName === 'inventarios') {
      result = await InventarioService.hardDelete(db, item.recordId, user?.id);
    } else if (item.tableName === 'cajas') {
      result = await CajaService.hardDelete(db, item.recordId, user?.id);
    } else if (item.tableName === 'prendas') {
      result = await PrendaService.hardDelete(db, item.recordId, user?.id);
    } else {
      const tableMap: Record<string, string> = {
        chat_sessions: 'chat_sessions',
        chat_history: 'chat_messages',
      };
      const remoteTable = tableMap[item.tableName] || item.tableName;
      try {
        const { error } = await supabase.from(remoteTable).delete().eq('id', item.recordId);
        if (error) throw new Error(error.message);
      } catch (err: any) {
        result = { success: false, error: err.message };
      }
    }

    if (!result.success) {
      throw new Error(result.error || 'Error al eliminar el registro de Supabase.');
    }

    await db.runAsync(`DELETE FROM pending_deletions WHERE recordId = ? OR id = ?`, [item.recordId, item.id]);
  };

  const handlePermanentDelete = async (item: PendingDeletionItem) => {
    Alert.alert(
      '¿Eliminar Definitivamente?',
      'Esta acción eliminará el registro de la nube y de la base local de forma irreversible.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              await deleteItemHelper(item);
              await AuthManager.refreshAllAppState(db);
              await loadTrashItems();
            } catch (e: any) {
              console.error('Error al eliminar definitivamente:', e);
              Alert.alert('Error', e.message || 'Ocurrió un error al eliminar el registro.');
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
      'Se purgarán de forma definitiva TODOS los registros de la papelera. Esta acción es irreversible.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar Todo',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              for (const item of items) {
                await deleteItemHelper(item);
              }
              await AuthManager.refreshAllAppState(db);
              await loadTrashItems();
            } catch (e: any) {
              console.error('Error al vaciar papelera:', e);
              Alert.alert('Error al vaciar papelera', e.message || 'Ocurrió un fallo al purgar la papelera.');
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
    <RoleGuard roles={['Admin']}>
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={currentTheme.background} />

        {/* Header Pantalla Completa */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16), backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={currentTheme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: currentTheme.text }]}>Papelera de Reciclaje</Text>
            <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>
              {items.length} elemento{items.length !== 1 ? 's' : ''} en papelera (retención 48h)
            </Text>
          </View>


        </View>

        {/* Barra de Pestañas: [ Inventarios ] [ Cajas ] [ Prendas ] */}
        <View style={[styles.tabBar, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'inventarios' && { backgroundColor: currentTheme.primary + '25', borderColor: currentTheme.primary }]}
            onPress={() => setActiveTab('inventarios')}
          >
            <Ionicons
              name="file-tray-stacked-outline"
              size={16}
              color={activeTab === 'inventarios' ? currentTheme.primary : currentTheme.textSecondary}
              style={{ marginRight: 6 }}
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
              size={16}
              color={activeTab === 'cajas' ? currentTheme.primary : currentTheme.textSecondary}
              style={{ marginRight: 6 }}
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
              size={16}
              color={activeTab === 'prendas' ? currentTheme.primary : currentTheme.textSecondary}
              style={{ marginRight: 6 }}
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
          <EmptyState
            iconName="trash-outline"
            title={`Sin ${activeTab === 'inventarios' ? 'Lotes' : activeTab === 'cajas' ? 'Cajas' : 'Prendas'} en Papelera`}
            description={`No hay ${activeTab === 'inventarios' ? 'lotes' : activeTab === 'cajas' ? 'cajas' : 'prendas'} eliminados en este apartado.`}
            currentTheme={currentTheme}
            delay={100}
          />
        ) : (
          <FlatList
            data={displayedItems}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: currentTheme.primary + '20' }]}>
                    <Ionicons name={getEntityIcon(item.tableName) as any} size={22} color={currentTheme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: currentTheme.text }]}>{item.title || getEntityName(item.tableName)}</Text>
                    <Text style={[styles.cardSub, { color: currentTheme.textSecondary }]}>{getEntityName(item.tableName)} (ID: {item.recordId})</Text>
                    <Text style={[styles.cardDate, { color: '#F59E0B', fontWeight: '600' }]}>
                      ⏳ {computeRemainingTime(item.deletedAt)}
                    </Text>
                  </View>
                </View>

                {/* Acciones */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.btnRestore, { backgroundColor: currentTheme.primary + '15' }]}
                    onPress={() => handleRestore(item)}
                    disabled={processingId === item.id}
                  >
                    <Ionicons name="refresh-outline" size={16} color={currentTheme.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.btnRestoreText, { color: currentTheme.primary }]}>Restaurar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnDelete, { backgroundColor: '#EF444415' }]}
                    onPress={() => handlePermanentDelete(item)}
                    disabled={processingId === item.id}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 4 }} />
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
    </RoleGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
  },
  emptyTrashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  emptyTrashText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  listContent: {
    padding: 16,
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
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 11,
    fontFamily: 'Platform',
    marginTop: 2,
  },
  cardDate: {
    fontSize: 11,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
  },
  btnRestore: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRestoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  btnDelete: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDeleteText: {
    color: '#EF4444',
    fontSize: 13,
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
