import { useState, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, HistoryItem } from '../../types';
import { useAppStore } from '../../store/useAppStore';

const HISTORY_TIME_ZONE = 'America/Lima';
const historyDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: HISTORY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const historyDateFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: HISTORY_TIME_ZONE,
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const getHistoryDay = (date: Date): number => {
  const parts = historyDayFormatter.formatToParts(date);
  const year = Number(parts.find(part => part.type === 'year')?.value);
  const month = Number(parts.find(part => part.type === 'month')?.value);
  const day = Number(parts.find(part => part.type === 'day')?.value);
  return Date.UTC(year, month - 1, day);
};

export const getRelativeDateLabel = (dateString: string) => {
  // SQLite datetime('now') guarda UTC sin sufijo; interpretarlo igual en ambos dispositivos.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(dateString)
    ? `${dateString.replace(' ', 'T')}Z`
    : dateString;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return dateString;

  const diffDays = (getHistoryDay(new Date()) - getHistoryDay(date)) / (1000 * 60 * 60 * 24);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';

  return historyDateFormatter.format(date);
};

export type HistoryStatus = 'Activo' | 'Inactivo' | 'Alarmas';

export const useHistoryScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const dataRevision = useAppStore(state => state.dataRevision);

  const [showExportModal, setShowExportModal] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<HistoryStatus>('Activo');
  const [results, setResults] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tabAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const historyFetchId = useRef(0);

  const fetchHistory = useCallback(async (showLoading = true) => {
    const fetchId = ++historyFetchId.current;
    if (showLoading) {
      setLoading(true);
      fadeAnim.setValue(0);
    }
    try {
      const cleanSearch = search.trim();
      const searchParam = `%${cleanSearch}%`;
      const startParam = `${cleanSearch}%`;
      const exactParam = cleanSearch;
      const userClause = '';

      let query = '';
      let params: any[] = [];

      if (status === 'Alarmas') {
        query = `
          SELECT g.id, g.box_id, g.op, g.style, g.color, g.status, g.created_at, g.shipping_at,
                 (SELECT alarm_datetime FROM garment_alarms WHERE garment_id = g.id AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as alarm_datetime,
                 b.name as box_name, i.name as inventory_name
          FROM garments g
          JOIN boxes b ON g.box_id = b.id
          JOIN inventories i ON b.inventory_id = i.id
          WHERE g.deleted_at IS NULL AND b.deleted_at IS NULL AND i.deleted_at IS NULL
            AND EXISTS (
              SELECT 1 FROM garment_alarms
              WHERE garment_id = g.id AND deleted_at IS NULL AND alarm_datetime IS NOT NULL
            )
            AND (g.op LIKE ? OR g.style LIKE ? OR g.color LIKE ?) ${userClause}
          ORDER BY alarm_datetime ASC, g.id DESC
        `;
        params = [searchParam, searchParam, searchParam];
      } else {
        const estadoDb = status === 'Activo' ? 1 : 0;
        query = `
          SELECT g.id, g.box_id, g.op, g.style, g.color, g.status, g.created_at, g.shipping_at,
                 (SELECT alarm_datetime FROM garment_alarms WHERE garment_id = g.id AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as alarm_datetime,
                 b.name as box_name, i.name as inventory_name
          FROM garments g
          JOIN boxes b ON g.box_id = b.id
          JOIN inventories i ON b.inventory_id = i.id
          WHERE g.deleted_at IS NULL AND b.deleted_at IS NULL AND i.deleted_at IS NULL
            AND g.status = ? AND (g.op LIKE ? OR g.style LIKE ? OR g.color LIKE ?) ${userClause}
          ORDER BY g.created_at DESC,
            (CASE 
              WHEN g.op = ? OR g.style = ? OR g.color = ? THEN 0
              WHEN g.op LIKE ? OR g.style LIKE ? OR g.color LIKE ? THEN 1
              ELSE 2
            END), g.id DESC
        `;
        params = [
          estadoDb, searchParam, searchParam, searchParam,
          exactParam, exactParam, exactParam,
          startParam, startParam, startParam
        ];
      }

      const rows = await db.getAllAsync<HistoryItem>(query, params);
      if (fetchId === historyFetchId.current) {
        setResults(rows);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      if (fetchId === historyFetchId.current) {
        setRefreshing(false);
        if (showLoading) {
          setTimeout(() => setLoading(false), 200);
        } else {
          setLoading(false);
        }
      }
    }
  }, [db, search, status, fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory(false);
    }, [fetchHistory, dataRevision])
  );

  const toggleStatus = useCallback((newStatus: HistoryStatus) => {
    setStatus(newStatus);
    const targetVal = newStatus === 'Activo' ? 0 : (newStatus === 'Inactivo' ? 1 : 2);
    Animated.spring(tabAnim, { toValue: targetVal, useNativeDriver: false }).start();
  }, [tabAnim]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory(false);
  }, [fetchHistory]);

  const navigateToDetail = useCallback((item: HistoryItem) => {
    const rootNav = (navigation.getParent() as any) || navigation;
    const bId = item.box_id;
    const bName = item.box_name || 'Caja';
    rootNav.navigate('BoxContents', {
      boxId: bId,
      boxName: bName,
      targetGarmentId: item.id,
    });
  }, [navigation]);

  return {
    state: {
      search,
      status,
      results,
      loading,
      refreshing,
      showExportModal,
    },
    computed: {
      currentTheme,
      themeMode,
    },
    refs: {
      tabAnim,
      fadeAnim,
    },
    handlers: {
      setSearch,
      toggleStatus,
      setShowExportModal,
      onRefresh,
      fetchHistory,
      navigateToDetail,
      getRelativeDateLabel,
    },
  };
};
