import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { clayStyles } from '../style/theme';
import { DashboardService, DashboardTotals, ActivityItem } from '../services/DashboardService';
import { SynchronizationEngine } from '../sync/SynchronizationEngine';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { RootStackParamList, BottomTabParamList } from '../types';

export const HomeScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList & BottomTabParamList>>();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const colorScheme = useAppStore(state => state.colorScheme);
  const user = useAppStore(state => state.user);
  const { width } = useWindowDimensions();

  const [totals, setTotals] = useState<DashboardTotals>({
    totalLotes: 0,
    totalCajas: 0,
    totalPrendas: 0,
    totalAlarmas: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'offline'>('synced');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Deyvi';

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);

    try {
      // 1. Cargar Totales y Actividad
      const dataTotals = await DashboardService.getTotals(db, user?.id);
      const dataActivities = await DashboardService.getRecentActivities(db, user?.id);
      setTotals(dataTotals);
      setActivities(dataActivities);

      // 2. Evaluar Estado de Sincronización
      const pendingCount = await SynchronizationEngine.getPendingCount(db);
      if (pendingCount > 0) {
        setSyncStatus('pending');
      } else {
        setSyncStatus('synced');
      }
    } catch (e) {
      console.error('Error cargando Dashboard:', e);
      setSyncStatus('offline');
    } finally {
      if (!isRefresh) setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [db, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    if (user?.id) {
      SynchronizationEngine.fullSync(db, user.id).catch(() => {});
    }
    loadDashboardData(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title="Inicio" />

      {loading ? (
        <SkeletonLoader theme={currentTheme} />
      ) : (
        <ScrollView
          key={`${themeMode}-${colorScheme}`}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={currentTheme.primary}
            />
          }
        >
          {/* 1. BIENVENIDA MINIMALISTA */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeGreeting, { color: currentTheme.text }]}>
              Hola, {userName} 👋
            </Text>
            <Text style={[styles.welcomeSub, { color: currentTheme.textSecondary }]}>
              Todo listo para trabajar.
            </Text>
          </View>

          {/* 2. TARJETA DE ESTADO DE SINCRONIZACIÓN */}
          <View
            style={[
              styles.syncCard,
              clayStyles,
              {
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.border,
                shadowColor: currentTheme.borderShadow || '#000',
              },
            ]}
          >
            <View style={styles.syncRow}>
              <View style={styles.syncStatusLeft}>
                <View
                  style={[
                    styles.syncDot,
                    {
                      backgroundColor:
                        syncStatus === 'synced'
                          ? '#10B981'
                          : syncStatus === 'pending'
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                />
                <Text style={[styles.syncText, { color: currentTheme.text }]}>
                  {syncStatus === 'synced'
                    ? '🟢 Todo sincronizado'
                    : syncStatus === 'pending'
                    ? '🟠 Cambios pendientes'
                    : '🔴 Sin conexión'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.syncBtn, { backgroundColor: currentTheme.primary + '15' }]}
                onPress={onRefresh}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color={currentTheme.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. RESUMEN OPERATIVO SIMPLE (4 MÉTRICAS LIMPIAS) */}
          <View style={styles.metricsGrid}>
            <View
              style={[
                styles.metricCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Lotes</Text>
              <Text style={[styles.metricValue, { color: currentTheme.text }]}>{totals.totalLotes}</Text>
            </View>

            <View
              style={[
                styles.metricCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Cajas</Text>
              <Text style={[styles.metricValue, { color: currentTheme.text }]}>{totals.totalCajas}</Text>
            </View>

            <View
              style={[
                styles.metricCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Prendas</Text>
              <Text style={[styles.metricValue, { color: currentTheme.text }]}>{totals.totalPrendas}</Text>
            </View>

            <View
              style={[
                styles.metricCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Alarmas</Text>
              <Text style={[styles.metricValue, { color: currentTheme.primary }]}>{totals.totalAlarmas}</Text>
            </View>
          </View>

          {/* 4. ACCIÓN PRINCIPAL PROTAGONISTA */}
          <TouchableOpacity
            style={[
              styles.heroButton,
              {
                backgroundColor: currentTheme.primary,
                shadowColor: currentTheme.primary,
              },
            ]}
            onPress={() => navigation.navigate('Inventarios')}
            activeOpacity={0.88}
          >
            <View style={styles.heroButtonContent}>
              <Ionicons name="cube" size={24} color={currentTheme.primaryText} style={{ marginRight: 10 }} />
              <Text style={[styles.heroButtonText, { color: currentTheme.primaryText }]}>
                Entrar a mis lotes
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color={currentTheme.primaryText} />
          </TouchableOpacity>

          {/* 5. ACCESOS RÁPIDOS (EXACTAMENTE 3) */}
          <View style={styles.quickAccessRow}>
            <TouchableOpacity
              style={[
                styles.quickAccessItem,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
              onPress={() => navigation.navigate('Chatbot')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: currentTheme.primary + '18' }]}>
                <Ionicons name="sparkles-outline" size={20} color={currentTheme.primary} />
              </View>
              <Text style={[styles.quickAccessLabel, { color: currentTheme.text }]}>IA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAccessItem,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
              onPress={() => navigation.navigate('History')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: currentTheme.primary + '18' }]}>
                <Ionicons name="time-outline" size={20} color={currentTheme.primary} />
              </View>
              <Text style={[styles.quickAccessLabel, { color: currentTheme.text }]}>Historial</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAccessItem,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: currentTheme.primary + '18' }]}>
                <Ionicons name="settings-outline" size={20} color={currentTheme.primary} />
              </View>
              <Text style={[styles.quickAccessLabel, { color: currentTheme.text }]}>Ajustes</Text>
            </TouchableOpacity>
          </View>

          {/* 6. ACTIVIDAD RECIENTE (MÁXIMO 3 ACCIONES) */}
          <View
            style={[
              styles.activityCard,
              clayStyles,
              {
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.border,
                shadowColor: currentTheme.borderShadow || '#000',
              },
            ]}
          >
            <Text style={[styles.activityHeaderTitle, { color: currentTheme.text }]}>
              Actividad Reciente
            </Text>

            {activities.map((item, index) => (
              <View
                key={item.id || index}
                style={[
                  styles.activityItemRow,
                  index < activities.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: currentTheme.border,
                  },
                ]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={18}
                  color={currentTheme.primary}
                  style={styles.activityIcon}
                />
                <View style={styles.activityTextContainer}>
                  <Text style={[styles.activityTitle, { color: currentTheme.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.activitySubtitle, { color: currentTheme.textSecondary }]}>
                    {item.subtitle}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 35 }} />
        </ScrollView>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
  },
  welcomeSection: {
    marginBottom: 16,
    marginTop: 4,
  },
  welcomeGreeting: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  welcomeSub: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  syncCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  syncText: {
    fontSize: 13,
    fontWeight: '700',
  },
  syncBtn: {
    padding: 6,
    borderRadius: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 18,
    elevation: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  heroButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroButtonText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  quickAccessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  quickAccessItem: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickAccessLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  activityCard: {
    padding: 16,
  },
  activityHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  activityItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  activityIcon: {
    marginRight: 10,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  activitySubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
});
