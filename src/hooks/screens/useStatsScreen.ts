import { useState, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { StatsService, DashboardStats } from '../../services';
import { RootStackParamList } from '../../types';

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'prenda' | 'caja' | 'inventario';
  action: 'creado' | 'editado' | 'eliminado';
  date: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const fetchRecentActivity = async (db: any): Promise<ActivityItem[]> => {
  try {
    const activities = await db.getAllAsync(
      `SELECT 
        'p-create-' || id AS id,
        'Prenda' AS title,
        COALESCE(style, 'Sin estilo') || ' - ' || COALESCE(color, 'Sin color') || CASE WHEN op IS NOT NULL AND op != '' THEN ' (OP: ' || op || ')' ELSE '' END AS subtitle,
        'prenda' AS type,
        'creado' AS action,
        created_at AS date,
        'shirt-outline' AS icon
      FROM garments
      WHERE deleted_at IS NULL

      UNION ALL

      SELECT 
        'p-edit-' || id AS id,
        'Prenda' AS title,
        COALESCE(style, 'Sin estilo') || ' - ' || COALESCE(color, 'Sin color') || CASE WHEN op IS NOT NULL AND op != '' THEN ' (OP: ' || op || ')' ELSE '' END AS subtitle,
        'prenda' AS type,
        'editado' AS action,
        updated_at AS date,
        'pencil-outline' AS icon
      FROM garments
      WHERE deleted_at IS NULL AND updated_at IS NOT NULL AND updated_at > created_at

      UNION ALL

      SELECT 
        'p-del-' || id AS id,
        'Prenda' AS title,
        COALESCE(style, 'Sin estilo') || ' - ' || COALESCE(color, 'Sin color') || CASE WHEN op IS NOT NULL AND op != '' THEN ' (OP: ' || op || ')' ELSE '' END AS subtitle,
        'prenda' AS type,
        'eliminado' AS action,
        deleted_at AS date,
        'trash-outline' AS icon
      FROM garments
      WHERE deleted_at IS NOT NULL

      UNION ALL

      SELECT 
        'c-create-' || id AS id,
        'Caja' AS title,
        name AS subtitle,
        'caja' AS type,
        'creado' AS action,
        created_at AS date,
        'cube-outline' AS icon
      FROM boxes
      WHERE deleted_at IS NULL

      UNION ALL

      SELECT 
        'c-edit-' || id AS id,
        'Caja' AS title,
        name AS subtitle,
        'caja' AS type,
        'editado' AS action,
        updated_at AS date,
        'pencil-outline' AS icon
      FROM boxes
      WHERE deleted_at IS NULL AND updated_at IS NOT NULL AND updated_at > created_at

      UNION ALL

      SELECT 
        'c-del-' || id AS id,
        'Caja' AS title,
        name AS subtitle,
        'caja' AS type,
        'eliminado' AS action,
        deleted_at AS date,
        'trash-outline' AS icon
      FROM boxes
      WHERE deleted_at IS NOT NULL

      UNION ALL

      SELECT 
        'i-create-' || id AS id,
        'Lote' AS title,
        name AS subtitle,
        'inventario' AS type,
        'creado' AS action,
        created_at AS date,
        'albums-outline' AS icon
      FROM inventories
      WHERE deleted_at IS NULL

      UNION ALL

      SELECT 
        'i-edit-' || id AS id,
        'Lote' AS title,
        name AS subtitle,
        'inventario' AS type,
        'editado' AS action,
        updated_at AS date,
        'pencil-outline' AS icon
      FROM inventories
      WHERE deleted_at IS NULL AND updated_at IS NOT NULL AND updated_at > created_at

      UNION ALL

      SELECT 
        'i-del-' || id AS id,
        'Lote' AS title,
        name AS subtitle,
        'inventario' AS type,
        'eliminado' AS action,
        deleted_at AS date,
        'trash-outline' AS icon
      FROM inventories
      WHERE deleted_at IS NOT NULL

      ORDER BY date DESC
      LIMIT 5`
    );
    return activities as ActivityItem[];
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return [];
  }
};

export const formatRelativeTime = (isoDate: string | null): string => {
  if (!isoDate) return '';
  const now = Date.now();
  const date = new Date(isoDate).getTime();
  const diffMs = Math.max(0, now - date);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Hace instantes';
  const diffMins = Math.floor(diffSec / 60);
  if (diffMins === 1) return 'Hace 1 min';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return 'Hace 1 h';
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return new Date(isoDate).toLocaleDateString();
};

const getRelativeTimeString = (isoDate: string | null, isSyncing: boolean, syncMessage: string) => {
  if (isSyncing) return syncMessage || 'Sincronizando...';
  if (!isoDate) return 'Sin sincronizar';

  const now = new Date().getTime();
  const date = new Date(isoDate).getTime();
  const diffMs = Math.max(0, now - date);
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Sincronizado hace unos segundos';
  if (diffMins === 1) return 'Sincronizado hace 1 minuto';
  if (diffMins < 60) return `Sincronizado hace ${diffMins} minutos`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return 'Sincronizado hace 1 hora';
  if (diffHours < 24) return `Sincronizado hace ${diffHours} horas`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Sincronizado hace 1 día';
  return `Sincronizado hace ${diffDays} días`;
};

export const useStatsScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<any>();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const colorScheme = useAppStore(state => state.colorScheme);
  const user = useAppStore(state => state.user);

  const lastSyncTime = useAppStore(state => state.lastSyncTime);
  const isSyncing = useAppStore(state => state.isSyncing);
  const syncMessage = useAppStore(state => state.syncMessage);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);

    const [statsData, recentActivity] = await Promise.all([
      StatsService.getStats(db, user?.id),
      fetchRecentActivity(db)
    ]);

    setStats(statsData);
    setActivities(recentActivity);

    if (!isRefresh) setLoading(false);
    if (isRefresh) setRefreshing(false);
  }, [db, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Usuario';
  const firstName = userName.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const syncText = getRelativeTimeString(lastSyncTime, isSyncing, syncMessage);

  const navigateTo = (screen: keyof RootStackParamList | string) => {
    navigation.navigate(screen);
  };

  return {
    state: {
      stats,
      activities,
      loading,
      refreshing,
    },
    computed: {
      currentTheme,
      themeMode,
      colorScheme,
      greeting,
      firstName,
      syncText,
      isSyncing,
    },
    handlers: {
      onRefresh,
      navigateTo,
      formatRelativeTime,
    },
  };
};
