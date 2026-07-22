import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, RefreshControl, ScrollView } from 'react-native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { StatsService, DashboardStats } from '../services/StatsService';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { clayStyles } from '../style/theme';

const { width } = Dimensions.get('window');

const STATS_CONFIG = [
  { key: 'totalInventarios', title: 'Total Lotes', icon: 'layers-outline', color: '#6C5CE7' },
  { key: 'totalCajas', title: 'Total Cajas', icon: 'cube-outline', color: '#0984E3' },
  { key: 'totalPrendas', title: 'Total Prendas', icon: 'shirt-outline', color: '#00B894' },
  { key: 'prendasActivas', title: 'Activas', icon: 'checkmark-circle', color: '#00CEC9' },
  { key: 'prendasInactivas', title: 'Inactivas', icon: 'close-circle', color: '#E17055' },
  { key: 'prendasConFoto', title: 'Con Foto', icon: 'camera', color: '#FDCB6E' },
];

export const StatsScreen = () => {
  const db = useSQLiteContext();
  const { currentTheme, themeMode } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const data = await StatsService.getStats(db);
    setStats(data);
    if (!isRefresh) setLoading(false);
    if (isRefresh) setRefreshing(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadStats(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title="Estadísticas" />
      
      {loading || !stats ? (
        <SkeletonLoader theme={currentTheme} />
      ) : (
        <ScrollView
          key={themeMode} // <-- Fuerza el remount completo para evitar lag al recalcular colores en los SVGs
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={currentTheme.primary} />}
        >
          <View style={styles.grid}>
            {STATS_CONFIG.map((config, index) => (
              <Animated.View 
                entering={FadeInUp.delay(index * 100).springify()}
                key={config.key} 
                style={[styles.card, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border, shadowColor: currentTheme.borderShadow || '#000' }]}
              >
                <View style={[styles.iconBox, { backgroundColor: config.color + '20' }]}>
                  <Ionicons name={config.icon as any} size={28} color={config.color} />
                </View>
                <Text style={[styles.cardTitle, { color: currentTheme.textSecondary }]}>{config.title}</Text>
                <Text style={[styles.cardValue, { color: currentTheme.text }]}>
                  {String(stats[config.key as keyof DashboardStats])}
                </Text>
              </Animated.View>
            ))}
          </View>

          {/* Caja con más prendas (Full Width) */}
          <Animated.View 
            entering={FadeInUp.delay(STATS_CONFIG.length * 100).springify()}
            style={[styles.fullCard, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border, shadowColor: currentTheme.borderShadow || '#000' }]}
          >
            <View style={styles.fullCardHeader}>
              <View style={[styles.iconBox, { backgroundColor: '#E8439320' }]}>
                <Ionicons name="trophy" size={28} color="#E84393" />
              </View>
              <View style={styles.fullCardTextContainer}>
                <Text style={[styles.cardTitle, { color: currentTheme.textSecondary }]}>Caja con más prendas</Text>
                <Text style={[styles.fullCardValue, { color: currentTheme.text }]}>{stats.cajaTopNombre}</Text>
                <Text style={[styles.fullCardSub, { color: '#E84393' }]}>{stats.cajaTopCantidad} prendas</Text>
              </View>
            </View>
          </Animated.View>
          
          {/* Gráfico de Barras: Top 5 Cajas */}
          {stats.top5Cajas && stats.top5Cajas.length > 0 && (
            <Animated.View entering={FadeInUp.delay((STATS_CONFIG.length + 1) * 100).springify()} style={[styles.chartCard, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border, shadowColor: currentTheme.borderShadow || '#000' }]}>
              <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Top 5 Cajas (Prendas)</Text>
              <BarChart
                data={{
                  labels: stats.top5Cajas.map(c => c.nombre.substring(0, 8)),
                  datasets: [{ data: stats.top5Cajas.map(c => c.total) }]
                }}
                width={width - 64}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                fromZero
                chartConfig={{
                  backgroundColor: currentTheme.card,
                  backgroundGradientFrom: currentTheme.card,
                  backgroundGradientTo: currentTheme.card,
                  fillShadowGradientOpacity: 1,
                  fillShadowGradientFrom: '#0984E3', // Color empresarial principal
                  fillShadowGradientTo: '#0984E3',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(108, 92, 231, ${opacity})`, // Lineas del grid discretas
                  labelColor: (opacity = 1) => currentTheme.textSecondary,
                  barPercentage: 0.7,
                  propsForBackgroundLines: {
                    strokeWidth: 1,
                    stroke: currentTheme.border,
                    strokeDasharray: '0', // Líneas sólidas tipo Power BI
                  }
                }}
                style={styles.chartStyle}
                showValuesOnTopOfBars={true} // Mostrar el valor arriba para más legibilidad
              />
            </Animated.View>
          )}

          {/* Gráfico Circular: Estado de Prendas */}
          {(stats.prendasActivas > 0 || stats.prendasInactivas > 0) && (
            <Animated.View entering={FadeInUp.delay((STATS_CONFIG.length + 2) * 100).springify()} style={[styles.chartCard, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border, shadowColor: currentTheme.borderShadow || '#000' }]}>
              <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Distribución de Estado</Text>
              <PieChart
                data={[
                  { name: 'Activas', population: stats.prendasActivas, color: '#0984E3', legendFontColor: currentTheme.textSecondary, legendFontSize: 12 },
                  { name: 'Inactivas', population: stats.prendasInactivas, color: '#D63031', legendFontColor: currentTheme.textSecondary, legendFontSize: 12 }
                ]}
                width={width - 64}
                height={160}
                chartConfig={{ color: () => currentTheme.text }}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute // Muestra los valores reales en lugar de porcentajes
              />
            </Animated.View>
          )}
          
          <View style={{ height: 40 }} />
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
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: (width - 48) / 2, // 2 columns with 16 padding on edges and between
    padding: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
    // clayStyles applied via spread
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  fullCard: {
    width: '100%',
    padding: 16,
    marginBottom: 16,
    // clayStyles applied via spread
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
    // clayStyles applied via spread
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  chartStyle: {
    borderRadius: 16,
    marginTop: 8,
  }
});
