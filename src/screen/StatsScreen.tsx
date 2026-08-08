import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { StatsService, DashboardStats } from '../services/StatsService';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { clayStyles } from '../style/theme';

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'prenda' | 'caja' | 'inventario';
  date: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const fetchRecentActivity = async (db: any): Promise<ActivityItem[]> => {
  try {
    const prendas = await db.getAllAsync(`SELECT id, estilo, color, op, fechaCreacion FROM prendas WHERE deleted_at IS NULL ORDER BY fechaCreacion DESC LIMIT 3`);
    const cajas = await db.getAllAsync(`SELECT id, nombre, fechaCreacion FROM cajas WHERE deleted_at IS NULL ORDER BY fechaCreacion DESC LIMIT 3`);
    const inventarios = await db.getAllAsync(`SELECT id, nombre, fechaCreacion FROM inventarios WHERE deleted_at IS NULL ORDER BY fechaCreacion DESC LIMIT 3`);

    let activities: ActivityItem[] = [];

    prendas.forEach((p: any) => {
      activities.push({
        id: p.id,
        title: `Prenda agregada`,
        subtitle: `${p.estilo} - ${p.color} (OP: ${p.op})`,
        type: 'prenda',
        date: p.fechaCreacion,
        icon: 'shirt-outline'
      });
    });

    cajas.forEach((c: any) => {
      activities.push({
        id: c.id,
        title: `Caja creada`,
        subtitle: c.nombre,
        type: 'caja',
        date: c.fechaCreacion,
        icon: 'cube-outline'
      });
    });

    inventarios.forEach((i: any) => {
      activities.push({
        id: i.id,
        title: `Lote creado`,
        subtitle: i.nombre,
        type: 'inventario',
        date: i.fechaCreacion,
        icon: 'albums-outline'
      });
    });

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return activities.slice(0, 3);
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return [];
  }
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

export const StatsScreen = () => {
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
  const [activeChartTab, setActiveChartTab] = useState<'trend' | 'boxes' | 'status'>('trend');

  const screenWidth = Dimensions.get('window').width - 48;

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

  const chartConfig = {
    backgroundColor: currentTheme.card,
    backgroundGradientFrom: currentTheme.card,
    backgroundGradientTo: currentTheme.card,
    decimalPlaces: 0,
    color: (opacity = 1) => currentTheme.primary,
    labelColor: (opacity = 1) => currentTheme.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: currentTheme.primary,
    },
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title="Inicio" />

      {loading || !stats ? (
        <SkeletonLoader theme={currentTheme} />
      ) : (
        <ScrollView
          key={`${themeMode}-${colorScheme}`}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={currentTheme.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. BIENVENIDA */}
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.welcomeSection}>
            <Text style={[styles.welcomeTitle, { color: currentTheme.text }]}>{greeting}, {firstName} 👋</Text>
            <Text style={[styles.welcomeSubtitle, { color: currentTheme.textSecondary }]}>Gestiona y encuentra tus prendas fácilmente</Text>
          </Animated.View>

          {/* 2. TARJETA "TU INVENTARIO" */}
          <Animated.View entering={FadeInUp.delay(200).springify()} style={[styles.inventoryCard, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
            <Text style={[styles.inventoryCardTitle, { color: currentTheme.textSecondary }]}>Tu inventario</Text>
            <Text style={[styles.inventoryCardPrimaryText, { color: currentTheme.text }]}>{stats.totalPrendas} prendas en {stats.totalCajas} cajas</Text>
            <Text style={[styles.inventoryCardSecondaryText, { color: currentTheme.textSecondary }]}>{stats.totalInventarios} inventarios</Text>
          </Animated.View>

          {/* 3. SECCIÓN "¿QUÉ DESEAS HACER?" */}
          <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.actionsSection}>
            <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>¿Qué deseas hacer?</Text>

            <View style={styles.actionsGrid}>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                  onPress={() => navigation.navigate('History')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: currentTheme.primary + '20' }]}>
                    <Ionicons name="search" size={26} color={currentTheme.primary} />
                  </View>
                  <Text style={[styles.actionText, { color: currentTheme.text }]}>Buscar prendas</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                  onPress={() => navigation.navigate('Inventarios')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: currentTheme.primary + '20' }]}>
                    <Ionicons name="cube" size={26} color={currentTheme.primary} />
                  </View>
                  <Text style={[styles.actionText, { color: currentTheme.text }]}>Inventarios</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                  onPress={() => navigation.navigate('Settings')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: currentTheme.primary + '20' }]}>
                    <Ionicons name="settings" size={26} color={currentTheme.primary} />
                  </View>
                  <Text style={[styles.actionText, { color: currentTheme.text }]}>Ajustes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                  onPress={() => navigation.navigate('Chatbot')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: currentTheme.primary + '20' }]}>
                    <Ionicons name="sparkles" size={26} color={currentTheme.primary} />
                  </View>
                  <Text style={[styles.actionText, { color: currentTheme.text }]}>Asistente IA</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* 4. ACTIVIDAD RECIENTE */}
          <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.recentActivitySection}>
            <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Actividad reciente</Text>

            {activities.length > 0 ? (
              <View style={[styles.activityContainer, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                {activities.map((activity, index) => (
                  <View key={`${activity.type}-${activity.id}`} style={[styles.activityItem, index < activities.length - 1 && { borderBottomWidth: 1, borderBottomColor: currentTheme.border }]}>
                    <View style={[styles.activityIconBox, { backgroundColor: currentTheme.primary + '15' }]}>
                      <Ionicons name={activity.icon} size={20} color={currentTheme.primary} />
                    </View>
                    <View style={styles.activityTextContainer}>
                      <Text style={[styles.activityTitle, { color: currentTheme.text }]}>{activity.title}</Text>
                      <Text style={[styles.activitySubtitle, { color: currentTheme.textSecondary }]} numberOfLines={1}>{activity.subtitle}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyActivityContainer, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                <Text style={[styles.emptyActivityText, { color: currentTheme.textSecondary }]}>No hay actividad reciente</Text>
              </View>
            )}
          </Animated.View>

          {/* 5. GRÁFICOS INTERACTIVOS (DASHBOARD METRICS) */}
          <Animated.View entering={FadeInUp.delay(450).springify()} style={styles.chartsSection}>
            <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Métricas y Análisis</Text>

            <View style={[styles.chartsContainer, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
              {/* Tab Selector de Gráficos */}
              <View style={[styles.chartTabsRow, { borderBottomColor: currentTheme.border }]}>
                <TouchableOpacity
                  style={[styles.chartTabBtn, activeChartTab === 'trend' && { backgroundColor: currentTheme.primary + '20', borderColor: currentTheme.primary }]}
                  onPress={() => setActiveChartTab('trend')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trending-up" size={15} color={activeChartTab === 'trend' ? currentTheme.primary : currentTheme.textSecondary} />
                  <Text style={[styles.chartTabText, { color: activeChartTab === 'trend' ? currentTheme.primary : currentTheme.textSecondary }]}>Tendencia</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chartTabBtn, activeChartTab === 'boxes' && { backgroundColor: currentTheme.primary + '20', borderColor: currentTheme.primary }]}
                  onPress={() => setActiveChartTab('boxes')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="stats-chart" size={15} color={activeChartTab === 'boxes' ? currentTheme.primary : currentTheme.textSecondary} />
                  <Text style={[styles.chartTabText, { color: activeChartTab === 'boxes' ? currentTheme.primary : currentTheme.textSecondary }]}>Top Cajas</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chartTabBtn, activeChartTab === 'status' && { backgroundColor: currentTheme.primary + '20', borderColor: currentTheme.primary }]}
                  onPress={() => setActiveChartTab('status')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pie-chart" size={15} color={activeChartTab === 'status' ? currentTheme.primary : currentTheme.textSecondary} />
                  <Text style={[styles.chartTabText, { color: activeChartTab === 'status' ? currentTheme.primary : currentTheme.textSecondary }]}>Estado</Text>
                </TouchableOpacity>
              </View>

              {/* Render del Gráfico Activo */}
              <View style={styles.chartWrapper}>
                {activeChartTab === 'trend' && (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.chartSubtitle, { color: currentTheme.textSecondary }]}>Prendas registradas en los últimos 7 días</Text>
                    <LineChart
                      data={{
                        labels: (stats.weeklyTrend && stats.weeklyTrend.length > 0) ? stats.weeklyTrend.map(d => d.dayLabel) : ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
                        datasets: [{
                          data: (stats.weeklyTrend && stats.weeklyTrend.length > 0) ? stats.weeklyTrend.map(d => d.count) : [0, 0, 0, 0, 0, 0, 0]
                        }]
                      }}
                      width={screenWidth - 32}
                      height={200}
                      chartConfig={chartConfig}
                      bezier
                      style={styles.chartStyle}
                    />
                  </View>
                )}

                {activeChartTab === 'boxes' && (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.chartSubtitle, { color: currentTheme.textSecondary }]}>Top Cajas por número de prendas</Text>
                    {stats.top5Cajas && stats.top5Cajas.length > 0 ? (
                      <BarChart
                        data={{
                          labels: stats.top5Cajas.map(c => c.nombre.length > 7 ? c.nombre.slice(0, 6) + '…' : c.nombre),
                          datasets: [{
                            data: stats.top5Cajas.map(c => c.total)
                          }]
                        }}
                        width={screenWidth - 32}
                        height={200}
                        yAxisLabel=""
                        yAxisSuffix=""
                        chartConfig={chartConfig}
                        style={styles.chartStyle}
                        showValuesOnTopOfBars
                      />
                    ) : (
                      <Text style={[styles.noChartDataText, { color: currentTheme.textSecondary }]}>No hay prendas asignadas a cajas</Text>
                    )}
                  </View>
                )}

                {activeChartTab === 'status' && (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.chartSubtitle, { color: currentTheme.textSecondary }]}>Proporción Activas vs Inactivas</Text>
                    <PieChart
                      data={[
                        {
                          name: 'Activas',
                          population: stats.prendasActivas || 0,
                          color: '#2ecc71',
                          legendFontColor: currentTheme.text,
                          legendFontSize: 12
                        },
                        {
                          name: 'Inactivas',
                          population: stats.prendasInactivas || 0,
                          color: '#8E8E93',
                          legendFontColor: currentTheme.text,
                          legendFontSize: 12
                        }
                      ]}
                      width={screenWidth - 32}
                      height={200}
                      chartConfig={chartConfig}
                      accessor="population"
                      backgroundColor="transparent"
                      paddingLeft="15"
                      absolute
                    />
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          {/* 6. ESTADO DE SINCRONIZACIÓN */}
          <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.syncStatusSection}>
            <Text style={[styles.syncStatusText, { color: currentTheme.textSecondary }]}>
              {getRelativeTimeString(lastSyncTime, isSyncing, syncMessage)}
            </Text>
          </Animated.View>

        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },

  welcomeSection: {
    marginTop: 8,
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  },

  inventoryCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    marginBottom: 36,
  },
  inventoryCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  inventoryCardPrimaryText: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  inventoryCardSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },

  actionsSection: {
    marginBottom: 36,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 20,
  },
  actionsGrid: {
    gap: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1.1,
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  recentActivitySection: {
    marginBottom: 32,
  },
  activityContainer: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  activityIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityTextContainer: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyActivityContainer: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActivityText: {
    fontSize: 15,
    fontWeight: '600',
  },

  chartsSection: {
    marginBottom: 32,
  },
  chartsContainer: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
  chartTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  chartTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  chartTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  chartSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  chartStyle: {
    borderRadius: 16,
    marginVertical: 4,
  },
  noChartDataText: {
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 40,
  },

  syncStatusSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  syncStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
