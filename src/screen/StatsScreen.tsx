import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, RefreshControl, ScrollView } from 'react-native';
import { BarChart, ProgressChart } from 'react-native-chart-kit';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { StatsService, DashboardStats } from '../services/StatsService';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { clayStyles } from '../style/theme';
import { getColorHex } from '../utils/colorUtils';

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
    barPercentage: 0.6,
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

  // Porcentajes clave
  const porcentajeActivas = stats && stats.totalPrendas > 0 
    ? Math.round((stats.prendasActivas / stats.totalPrendas) * 100) 
    : 100;

  const porcentajeFotos = stats && stats.totalPrendas > 0 
    ? Math.round((stats.prendasConFoto / stats.totalPrendas) * 100) 
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title="Estadísticas de Inventario" />

      {loading || !stats ? (
        <SkeletonLoader theme={currentTheme} />
      ) : (
        <ScrollView
          key={`${themeMode}-${colorScheme}`}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={currentTheme.primary} />}
        >
          {/* TARJETAS EJECUTIVAS RESUMEN */}
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.grid}>
            {/* Card 1: Volumen General */}
            <View style={[styles.kpiCard, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
              <View style={styles.kpiHeader}>
                <View style={[styles.iconBox, { backgroundColor: currentTheme.primary + '20' }]}>
                  <Ionicons name="cube" size={22} color={currentTheme.primary} />
                </View>
                <Text style={[styles.kpiLabel, { color: currentTheme.textSecondary }]}>Volumen de Producción</Text>
              </View>
              <Text style={[styles.kpiMainNumber, { color: currentTheme.text }]}>{stats.totalPrendas}</Text>
              <Text style={[styles.kpiSubText, { color: currentTheme.textSecondary }]}>
                {stats.totalCajas} cajas en {stats.totalInventarios} lotes
              </Text>
            </View>

            {/* Card 2: Eficiencia Operativa */}
            <View style={[styles.kpiCard, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
              <View style={styles.kpiHeader}>
                <View style={[styles.iconBox, { backgroundColor: '#10B98120' }]}>
                  <Ionicons name="checkmark-done-circle" size={22} color="#10B981" />
                </View>
                <Text style={[styles.kpiLabel, { color: currentTheme.textSecondary }]}>Tasa de Activos</Text>
              </View>
              <Text style={[styles.kpiMainNumber, { color: '#10B981' }]}>{porcentajeActivas}%</Text>
              <Text style={[styles.kpiSubText, { color: currentTheme.textSecondary }]}>
                {stats.prendasActivas} activas · {stats.prendasInactivas} inactivas
              </Text>
            </View>
          </Animated.View>

          {/* TARJETA TROFEO: CAJA LÍDER */}
          {stats.cajaTopCantidad > 0 && (
            <Animated.View
              entering={FadeInUp.delay(200).springify()}
              style={[
                styles.trophyCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.primary + '40',
                },
              ]}
            >
              <View style={styles.trophyRow}>
                <View style={[styles.trophyIconBox, { backgroundColor: '#F59E0B20' }]}>
                  <Ionicons name="trophy" size={28} color="#F59E0B" />
                </View>
                <View style={styles.trophyInfo}>
                  <Text style={[styles.trophyTag, { color: currentTheme.textSecondary }]}>Caja con Mayor Volumen</Text>
                  <Text style={[styles.trophyName, { color: currentTheme.text }]}>{stats.cajaTopNombre}</Text>
                  <Text style={[styles.trophySub, { color: currentTheme.primary }]}>
                    {stats.cajaTopCantidad} prendas ({Math.round((stats.cajaTopCantidad / stats.totalPrendas) * 100)}% del total)
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* SECCIÓN SIMPLE Y LLAMATIVA: COBERTURA Y ALERTAS */}
          {stats.totalPrendas > 0 && (
            <Animated.View
              entering={FadeInUp.delay(300).springify()}
              style={[
                styles.chartCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                },
              ]}
            >
              <View style={styles.chartHeaderRow}>
                <Ionicons name="sparkles-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Cobertura & Alertas</Text>
              </View>

              <View style={styles.meterContainer}>
                {/* Barra 1: Fotos Respaldadas */}
                <View style={styles.meterItem}>
                  <View style={styles.meterHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="camera-outline" size={18} color="#F59E0B" />
                      <Text style={[styles.meterLabel, { color: currentTheme.text }]}>Fotos Respaldadas en R2</Text>
                    </View>
                    <Text style={[styles.meterValue, { color: '#F59E0B' }]}>{porcentajeFotos}%</Text>
                  </View>
                  <View style={[styles.barBackground, { backgroundColor: currentTheme.background, height: 12, borderRadius: 6 }]}>
                    <View style={[styles.barFill, { width: `${Math.min(porcentajeFotos, 100)}%`, backgroundColor: '#F59E0B', borderRadius: 6 }]} />
                  </View>
                  <Text style={[styles.meterSub, { color: currentTheme.textSecondary }]}>
                    {stats.prendasConFoto} de {stats.totalPrendas} prendas con fotos registradas
                  </Text>
                </View>

                {/* Barra 2: Alertas de Alarma */}
                <View style={styles.meterItem}>
                  <View style={styles.meterHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="alarm-outline" size={18} color="#EAB308" />
                      <Text style={[styles.meterLabel, { color: currentTheme.text }]}>Con Recordatorio / Alarma</Text>
                    </View>
                    <Text style={[styles.meterValue, { color: '#EAB308' }]}>
                      {Math.round((stats.prendasConAlarma / stats.totalPrendas) * 100)}%
                    </Text>
                  </View>
                  <View style={[styles.barBackground, { backgroundColor: currentTheme.background, height: 12, borderRadius: 6 }]}>
                    <View style={[styles.barFill, { width: `${Math.min(Math.round((stats.prendasConAlarma / stats.totalPrendas) * 100), 100)}%`, backgroundColor: '#EAB308', borderRadius: 6 }]} />
                  </View>
                  <Text style={[styles.meterSub, { color: currentTheme.textSecondary }]}>
                    {stats.prendasConAlarma} prendas con fecha y hora programada
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* GRÁFICO 2: BAR CHART DE TOP CAJAS (SIN DUPLICAR CON LINE CHART) */}
          {stats.top5Cajas && stats.top5Cajas.length > 0 && (
            <Animated.View
              entering={FadeInUp.delay(400).springify()}
              style={[
                styles.chartCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                },
              ]}
            >
              <View style={styles.chartHeaderRow}>
                <Ionicons name="bar-chart-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Top 5 Cajas por Volumen</Text>
              </View>

              <BarChart
                data={{
                  labels: stats.top5Cajas.map(c => c.nombre.length > 8 ? c.nombre.substring(0, 7) + '..' : c.nombre),
                  datasets: [{ data: stats.top5Cajas.map(c => c.total) }],
                }}
                width={width - 64}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={chartConfig}
                style={styles.chartStyle}
                showValuesOnTopOfBars
                fromZero
              />
            </Animated.View>
          )}

          {/* SECCIÓN NUEVA: DESGLOSE DE COLORES PREDOMINANTES */}
          {stats.topColores && stats.topColores.length > 0 && (
            <Animated.View
              entering={FadeInUp.delay(500).springify()}
              style={[
                styles.chartCard,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                },
              ]}
            >
              <View style={styles.chartHeaderRow}>
                <Ionicons name="color-palette-outline" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Colores Predominantes</Text>
              </View>

              <View style={styles.colorsList}>
                {stats.topColores.map(item => {
                  const colorHex = getColorHex(item.color);
                  const pct = Math.round((item.count / stats.totalPrendas) * 100);

                  return (
                    <View key={item.color} style={styles.colorRow}>
                      <View style={[styles.colorChip, { backgroundColor: colorHex, borderColor: currentTheme.border }]} />
                      <Text style={[styles.colorName, { color: currentTheme.text }]}>{item.color}</Text>
                      
                      <View style={[styles.barBackground, { backgroundColor: currentTheme.background }]}>
                        <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: currentTheme.primary }]} />
                      </View>

                      <Text style={[styles.colorCount, { color: currentTheme.textSecondary }]}>
                        {item.count} ({pct}%)
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 60 },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  kpiMainNumber: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  kpiSubText: {
    fontSize: 11,
    fontWeight: '600',
  },
  trophyCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  trophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  trophyIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyInfo: {
    flex: 1,
  },
  trophyTag: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trophyName: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 2,
  },
  trophySub: {
    fontSize: 12,
    fontWeight: '700',
  },
  chartCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  chartStyle: {
    borderRadius: 14,
    alignSelf: 'center',
  },
  meterContainer: {
    gap: 16,
    marginTop: 4,
  },
  meterItem: {
    gap: 6,
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meterLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  meterValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  meterSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  colorsList: {
    gap: 12,
    marginTop: 4,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  colorName: {
    width: 70,
    fontSize: 13,
    fontWeight: '600',
  },
  barBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  colorCount: {
    width: 65,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
});
