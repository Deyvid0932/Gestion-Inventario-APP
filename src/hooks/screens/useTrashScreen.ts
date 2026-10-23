import { useState, useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppStore } from '../../store/useAppStore';
import { InventoryService, BoxService, GarmentService, AuthManager } from '../../services';
import { RootStackParamList } from '../../types';
import { supabase } from '../../database/supabase';

export interface PendingDeletionItem {
  id: string;
  tableName: string;
  recordId: string;
  title: string;
  createdAt: string;
  deletedAt?: string | null;
}

export type TrashTabType = 'inventories' | 'boxes' | 'garments';

export const useTrashScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const currentTheme = useAppStore(state => state.currentTheme);
  const user = useAppStore(state => state.user);

  const [activeTab, setActiveTab] = useState<TrashTabType>('inventories');
  const [items, setItems] = useState<PendingDeletionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadTrashItems = useCallback(async () => {
    setLoading(true);
    try {
      const combined: PendingDeletionItem[] = [];

      // 1. Inventarios eliminados lógicamente
      const deletedInventories = await db.getAllAsync<{ id: string; name: string; deleted_at?: string; created_at: string }>(
        `SELECT id, name, deleted_at, created_at FROM inventories WHERE deleted_at IS NOT NULL`
      );
      for (const inv of deletedInventories || []) {
        combined.push({
          id: `inv_${inv.id}`,
          tableName: 'inventories',
          recordId: inv.id,
          title: inv.name || 'Lote / Inventario',
          createdAt: inv.deleted_at || inv.created_at || new Date().toISOString(),
          deletedAt: inv.deleted_at,
        });
      }

      // 2. Cajas eliminadas lógicamente (solo cajas borradas individualmente cuyo lote NO esté borrado)
      const deletedBoxes = await db.getAllAsync<{ id: string; name: string; deleted_at?: string; created_at: string }>(
        `SELECT id, name, deleted_at, created_at FROM boxes WHERE deleted_at IS NOT NULL AND inventory_id NOT IN (SELECT id FROM inventories WHERE deleted_at IS NOT NULL)`
      );
      for (const box of deletedBoxes || []) {
        combined.push({
          id: `box_${box.id}`,
          tableName: 'boxes',
          recordId: box.id,
          title: box.name || 'Caja de Almacén',
          createdAt: box.deleted_at || box.created_at || new Date().toISOString(),
          deletedAt: box.deleted_at,
        });
      }

      // 3. Prendas eliminadas lógicamente (solo prendas borradas individualmente cuya caja NO esté borrada)
      const deletedGarments = await db.getAllAsync<{ id: string; style: string; color: string; deleted_at?: string; created_at: string }>(
        `SELECT id, style, color, deleted_at, created_at FROM garments WHERE deleted_at IS NOT NULL AND box_id NOT IN (SELECT id FROM boxes WHERE deleted_at IS NOT NULL)`
      );
      for (const garment of deletedGarments || []) {
        combined.push({
          id: `garment_${garment.id}`,
          tableName: 'garments',
          recordId: garment.id,
          title: `${garment.style || 'Prenda'} - ${garment.color || ''}`,
          createdAt: garment.deleted_at || garment.created_at || new Date().toISOString(),
          deletedAt: garment.deleted_at,
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

  const counts = useMemo(() => {
    return {
      inventories: items.filter(i => i.tableName === 'inventories').length,
      boxes: items.filter(i => i.tableName === 'boxes').length,
      garments: items.filter(i => i.tableName === 'garments').length,
    };
  }, [items]);

  const displayedItems = useMemo(() => {
    return items.filter(item => {
      if (activeTab === 'inventories') {
        return item.tableName === 'inventories';
      }
      if (activeTab === 'boxes') {
        return item.tableName === 'boxes';
      }
      if (activeTab === 'garments') {
        return item.tableName === 'garments';
      }
      return item.tableName === activeTab;
    });
  }, [items, activeTab]);

  const computeRemainingTime = useCallback((deletedAt?: string | null) => {
    if (!deletedAt) return '48h restantes';
    const deletedTime = new Date(deletedAt).getTime();
    const expiresAt = deletedTime + 48 * 60 * 60 * 1000;
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return 'Vencido (pendiente de purga)';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m restantes`;
  }, []);

  const handleRestore = async (item: PendingDeletionItem) => {
    setProcessingId(item.id);
    try {
      let result: { success: boolean; error?: string } = { success: true };
      if (item.tableName === 'inventories') {
        result = await InventoryService.restore(db, item.recordId, user?.id);
      } else if (item.tableName === 'boxes') {
        result = await BoxService.restore(db, item.recordId, user?.id);
      } else if (item.tableName === 'garments') {
        result = await GarmentService.restore(db, item.recordId, user?.id);
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
    if (item.tableName === 'inventories') {
      result = await InventoryService.hardDelete(db, item.recordId, user?.id);
    } else if (item.tableName === 'boxes') {
      result = await BoxService.hardDelete(db, item.recordId, user?.id);
    } else if (item.tableName === 'garments') {
      result = await GarmentService.hardDelete(db, item.recordId, user?.id);
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

  const handlePermanentDelete = (item: PendingDeletionItem) => {
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

  const handleEmptyTrash = () => {
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
      case 'inventories': return 'file-tray-stacked-outline';
      case 'boxes': return 'archive-outline';
      case 'garments': return 'shirt-outline';
      case 'chat_sessions':
      case 'chat_history': return 'chatbubbles-outline';
      default: return 'trash-outline';
    }
  };

  const getEntityName = (tableName: string) => {
    switch (tableName) {
      case 'inventories': return 'Lote / Inventario';
      case 'boxes': return 'Caja de Almacén';
      case 'garments': return 'Prenda de Vestir';
      case 'chat_sessions': return 'Sesión de Chat';
      case 'chat_history': return 'Mensaje de Chat';
      default: return tableName;
    }
  };

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return {
    state: {
      activeTab,
      items,
      loading,
      processingId,
    },
    computed: {
      currentTheme,
      counts,
      displayedItems,
    },
    handlers: {
      setActiveTab,
      loadTrashItems,
      handleRestore,
      handlePermanentDelete,
      handleEmptyTrash,
      computeRemainingTime,
      getEntityIcon,
      getEntityName,
      goBack,
    },
  };
};
