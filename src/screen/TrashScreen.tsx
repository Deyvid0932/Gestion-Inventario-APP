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
import { RootStackParamList } from '../types';
import { supabase } from '../database/supabase';
import { RoleGuard } from '../components/RoleGuard';

interface PendingDeletionItem {
  id: string;
  tableName: string;
  recordId: string;
  createdAt: string;
}

export const TrashScreen: React.FC = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const currentTheme = useAppStore(state => state.currentTheme);
  const user = useAppStore(state => state.user);
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<PendingDeletionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadTrashItems = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<PendingDeletionItem>(
        `SELECT * FROM pending_deletions ORDER BY createdAt DESC`
      );
      setItems(rows || []);
    } catch (e) {
      console.error('Error cargando elementos de la papelera:', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadTrashItems();
  }, [loadTrashItems]);

  const handleRestore = async (item: PendingDeletionItem) => {
    setProcessingId(item.id);
    try {
      await db.runAsync(`DELETE FROM pending_deletions WHERE id = ?`, [item.id]);
      Alert.alert('Restaurado', 'El registro fue removido de la cola de eliminación.');
      await loadTrashItems();
    } catch (e) {
      Alert.alert('Error', 'No se pudo restaurar el elemento.');
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
              const remoteTable = tableMap[item.tableName] || item.tableName;
              try {
                await supabase.from(remoteTable).delete().eq('id', item.recordId);
              } catch (_) {}
              await db.runAsync(`DELETE FROM pending_deletions WHERE id = ?`, [item.id]);
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
                const tableMap: Record<string, string> = {
                  inventarios: 'inventories',
                  cajas: 'boxes',
                  prendas: 'garments',
                  chat_sessions: 'chat_sessions',
                  chat_history: 'chat_messages',
                };
                const remoteTable = tableMap[item.tableName] || item.tableName;
                try {
                  await supabase.from(remoteTable).delete().eq('id', item.recordId);
                } catch (_) {}
              }
              await db.runAsync(`DELETE FROM pending_deletions`);
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
              {items.length} elemento{items.length !== 1 ? 's' : ''} pendiente{items.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {items.length > 0 && (
            <TouchableOpacity onPress={handleEmptyTrash} style={[styles.emptyTrashBtn, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="trash-bin-outline" size={18} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.emptyTrashText}>Vaciar</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={currentTheme.primary} />
            <Text style={{ color: currentTheme.textSecondary, marginTop: 12 }}>Cargando elementos pendientes...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: currentTheme.primary + '15' }]}>
              <Ionicons name="trash-outline" size={48} color={currentTheme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>Papelera Vacía</Text>
            <Text style={[styles.emptyDesc, { color: currentTheme.textSecondary }]}>
              No hay ningún elemento pendiente de eliminación remota en este momento.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: currentTheme.primary + '20' }]}>
                    <Ionicons name={getEntityIcon(item.tableName) as any} size={22} color={currentTheme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: currentTheme.text }]}>{getEntityName(item.tableName)}</Text>
                    <Text style={[styles.cardSub, { color: currentTheme.textSecondary }]}>ID: {item.recordId}</Text>
                    <Text style={[styles.cardDate, { color: currentTheme.textSecondary }]}>
                      Eliminado: {new Date(item.createdAt).toLocaleString('es-ES')}
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
