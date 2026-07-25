import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, RefreshControl, ScrollView } from 'react-native';
import { PieChart, BarChart, LineChart, ProgressChart } from 'react-native-chart-kit';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { StatsService, DashboardStats } from '../services/StatsService';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { clayStyles } from '../style/theme';

export const StatsScreen = () => {
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const colorScheme = useAppStore(state => state.colorScheme);
  const user = useAppStore(state => state.user);
  const { width } = useWindowDimensions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    const data = await StatsService.getStats(db, user?.id);
    setStats(data);
    if (!isRefresh) setLoading(false);
    if (isRefresh) setRefreshing(false);
  }, [db, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadStats(true);
  };

  const chartConfig = {
    backgroundColor: currentTheme.card,
    backgroundGradientFrom: currentTheme.card,
    backgroundGradientTo: currentTheme.card,
    fillShadowGradientOpacity: 0.5,
    fillShadowGradientFrom: currentTheme.primary,
    fillShadowGradientTo: currentTheme.card,
    decimalPlaces: 0,
    color: (_opacity = 1) => currentTheme.primary,
    labelColor: (_opacity = 1) => currentTheme.textSecondary,
    barPercentage: 0.65,
    propsForDots: {
      r: "6",
      strokeWidth: "3",
      stroke: currentTheme.primary,
      fill: currentTheme.card,
    },
    propsForBackgroundLines: {
      strokeWidth: 1,
      stroke: currentTheme.border,
      strokeDasharray: '4',
    },
  };

  const statsConfig = [
    { key: 'totalInventarios', title: 'Total Lotes', icon: 'layers-outline', color: currentTheme.primary },
    { key: 'totalCajas', title: 'Total Cajas', icon: 'cube-outline', color: currentTheme.primary },
    { key: 'totalPrendas', title: 'Total Prendas', icon: 'shirt-outline', color: currentTheme.primary },
    { key: 'prendasActivas', title: 'Activas', icon: 'checkmark-circle', color: '#10B981' },
    { key: 'prendasInactivas', title: 'Inactivas', icon: 'close-circle', color: '#EF4444' },
    { key: 'prendasConFoto', title: 'Con Foto', icon: 'camera', color: '#F59E0B' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title="Estadísticas" />

      {loading || !stats ? (
        <SkeletonLoader theme={currentTheme} />
      ) : (
        <ScrollView
          key={`${themeMode}-${colorScheme}`}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={currentTheme.primary} />}
        >
          {/* TARJETAS KPI */}
          <View style={styles.grid}>
            {statsConfig.map((config, index) => (
              <Animated.View
                entering={FadeInUp.delay(index * 80).springify()}
                key={config.key}
                style={[
                  styles.card,
                  clayStyles,
                  {
                    backgroundColor: currentTheme.card,
                    borderColor: currentTheme.border,
                    shadowColor: currentTheme.borderShadow || '#000',
                  },
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: config.color + '20' }]}>
                  <Ionicons name={config.icon as any} size={26} color={config.color} />
                </View>
                <Text style={[styles.cardTitle, { color: currentTheme.textSecondary }]}>{config.title}</Text>
                <Text style={[styles.cardValue, { color: currentTheme.text }]}>
                  {String(stats[config.key as keyof DashboardStats])}
                </Text>
              </Animated.View>
            ))}
          </View>

          {/* CAJA TOP INSANA */}
          <Animated.View
            entering={FadeInUp.delay(STATS_CONFIG_DELAY).springify()}
            style={[
              styles.fullCard,
              clayStyles,
              {
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.primary + '40',
                shadowColor: currentTheme.borderShadow || '#000',
              },
            ]}
          >
            <View style={styles.fullCardHeader}>
              <View style={[styles.iconBox, { backgroundColor: currentTheme.primary + '25' }]}>
                <Ionicons name="trophy" size={28} color={currentTheme.primary} />
              </View>
              <View style={styles.fullCardTextContainer}>
                <Text style={[styles.cardTitle, { color: currentTheme.textSecondary }]}>Caja con Más Prendas</Text>
                <Text style={[styles.fullCardValue, { color: currentTheme.text }]}>{stats.cajaTopNombre}</Text>
                <Text style={[styles.fullCardSub, { color: currentTheme.primary }]}>{stats.cajaTopCantidad} prendas registradas</Text>
              </View>
            </View>
          </Animated.View>

          {/* GRÁFICO 1: ANILLO RADIAL DE RENDIMIENTO (PROGRESS CHART) */}
          {stats.totalPrendas > 0 && (
            <Animated.View
              entering={FadeInUp.delay(600).springify()}
              style={[
                styles.chartCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
            >
              <View style={styles.chartHeaderRow}>
                <Ionicons name="pie-chart-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Medidor Radial de Avance</Text>
              </View>
              <ProgressChart
                data={{
                  labels: ["Activas", "Fotos"],
                  data: [
                    stats.totalPrendas > 0 ? Math.min(stats.prendasActivas / stats.totalPrendas, 1) : 0,
                    stats.totalPrendas > 0 ? Math.min(stats.prendasConFoto / stats.totalPrendas, 1) : 0,
                  ],
                }}
                width={width - 64}
                height={170}
                strokeWidth={14}
                radius={32}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1, index) => {
                    if (index === 0) return currentTheme.primary;
                    return '#F59E0B';
                  },
                }}
                hideLegend={false}
                style={styles.chartStyle}
              />
            </Animated.View>
          )}

          {/* GRÁFICO 2: CURVA BÉZIER DE TENDENCIA (LINE CHART) */}
          {stats.top5Cajas && stats.top5Cajas.length > 1 && (
            <Animated.View
              entering={FadeInUp.delay(750).springify()}
              style={[
                styles.chartCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
            >
              <View style={styles.chartHeaderRow}>
                <Ionicons name="stats-chart-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Curva Neumórfica Top Cajas</Text>
              </View>
              <LineChart
                data={{
                  labels: stats.top5Cajas.map(c => c.nombre.substring(0, 6)),
                  datasets: [
                    {
                      data: stats.top5Cajas.map(c => c.total),
                      color: (_opacity = 1) => currentTheme.primary,
                      strokeWidth: 3,
                    },
                  ],
                }}
                width={width - 64}
                height={210}
                bezier
                fromZero
                chartConfig={chartConfig}
                style={styles.chartStyle}
              />
            </Animated.View>
          )}

          {/* GRÁFICO 3: BAR CHART ADAPTATIVO CON TEMA */}
          {stats.top5Cajas && stats.top5Cajas.length > 0 && (
            <Animated.View
              entering={FadeInUp.delay(900).springify()}
              style={[
                styles.chartCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
            >
              <View style={styles.chartHeaderRow}>
                <Ionicons name="bar-chart-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Distribución por Cajas</Text>
              </View>
              <BarChart
                data={{
                  labels: stats.top5Cajas.map(c => c.nombre.substring(0, 7)),
                  datasets: [{ data: stats.top5Cajas.map(c => c.total) }],
                }}
                width={width - 64}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                fromZero
                chartConfig={chartConfig}
                style={styles.chartStyle}
                showValuesOnTopOfBars={true}
              />
            </Animated.View>
          )}

          {/* GRÁFICO 4: DISTRIBUCIÓN DE ESTADO (PIE CHART) */}
          {(stats.prendasActivas > 0 || stats.prendasInactivas > 0) && (
            <Animated.View
              entering={FadeInUp.delay(1050).springify()}
              style={[
                styles.chartCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                },
              ]}
            >
              <View style={styles.chartHeaderRow}>
                <Ionicons name="options-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Proporción Activas vs Inactivas</Text>
              </View>
              <PieChart
                data={[
                  {
                    name: 'Activas',
                    population: stats.prendasActivas,
                    color: currentTheme.primary,
                    legendFontColor: currentTheme.textSecondary,
                    legendFontSize: 12,
                  },
                  {
                    name: 'Inactivas',
                    population: stats.prendasInactivas,
                    color: '#EF4444',
                    legendFontColor: currentTheme.textSecondary,
                    legendFontSize: 12,
                  },
                ]}
                width={width - 64}
                height={160}
                chartConfig={chartConfig}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
              />
            </Animated.View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const STATS_CONFIG_DELAY = 480;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    padding: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  fullCard: {
    width: '100%',
    padding: 16,
    marginBottom: 16,
  },
  fullCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullCardTextContainer: {
    marginLeft: 16,
  },
  fullCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  fullCardSub: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  chartCard: {
    width: '100%',
    padding: 16,
    marginTop: 16,
    marginBottom: 4,
    alignItems: 'center',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartStyle: {
    borderRadius: 16,
    marginTop: 4,
  },
});
