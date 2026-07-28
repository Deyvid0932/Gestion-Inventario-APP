import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { clayStyles } from '../style/theme';
import { useNavigation } from '@react-navigation/native';

export const DashboardSummaryCard: React.FC = () => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const inventarios = useAppStore(state => state.inventarios);
  const lastSyncTime = useAppStore(state => state.lastSyncTime);
  const navigation = useNavigation<any>();

  // Calcular métricas agregadas desde el estado reactivo de Zustand (fuente de verdad reactiva)
  const totalCajas = inventarios.reduce((acc, inv) => acc + (inv.totalCajas || 0), 0);
  const totalPrendas = inventarios.reduce((acc, inv) => acc + (inv.totalPrendas || 0), 0);
  const prendasEscaneadas = inventarios.reduce((acc, inv) => acc + (inv.prendasEscaneadas || 0), 0);

  const porcentajeRevisado = totalPrendas > 0
    ? Math.round((prendasEscaneadas / totalPrendas) * 100)
    : 100;

  const displaySyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Hoy';

  // Lote más reciente para el historial de actividad dinámico
  const latestInventario = inventarios.length > 0 ? inventarios[0] : null;
  const recentLotText = latestInventario
    ? `Lote "${latestInventario.nombre}" activo (${latestInventario.totalPrendas || 0} prendas)`
    : 'Sin lotes registrados aún';

  return (
    <View
      style={[
        styles.cardContainer,
        clayStyles,
        {
          backgroundColor: currentTheme.card,
          borderColor: currentTheme.border,
        },
      ]}
    >
      {/* Encabezado con Botón de Navegación a Estadísticas */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Ionicons name="sparkles" size={20} color={currentTheme.primary} />
          <Text style={[styles.headerTitle, { color: currentTheme.text }]}>Resumen General</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.statsButton, { backgroundColor: currentTheme.primary + '18' }]}
          onPress={() => navigation.navigate('Stats')}
        >
          <Text style={[styles.statsButtonText, { color: currentTheme.primary }]}>Ver estadísticas</Text>
          <Ionicons name="arrow-forward" size={14} color={currentTheme.primary} />
        </TouchableOpacity>
      </View>

      {/* Grid de 4 Métricas Principales Simétricas */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricTile, { backgroundColor: currentTheme.background }]}>
          <Text style={[styles.metricNumber, { color: currentTheme.primary }]}>{totalCajas}</Text>
          <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Cajas creadas</Text>
        </View>

        <View style={[styles.metricTile, { backgroundColor: currentTheme.background }]}>
          <Text style={[styles.metricNumber, { color: currentTheme.primary }]}>{totalPrendas}</Text>
          <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Prendas totales</Text>
        </View>

        <View style={[styles.metricTile, { backgroundColor: currentTheme.background }]}>
          <Text style={[styles.metricNumber, { color: currentTheme.primary }]}>{porcentajeRevisado}%</Text>
          <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Revisado</Text>
        </View>

        <View style={[styles.metricTile, { backgroundColor: currentTheme.background }]}>
          <Text style={[styles.metricNumber, { color: currentTheme.primary, fontSize: 16 }]} numberOfLines={1}>
            {displaySyncTime}
          </Text>
          <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Último respaldo</Text>
        </View>
      </View>

      {/* Sección Actividad Reciente con Espaciado Generoso y Profesional */}
      <View style={styles.activitySection}>
        <Text style={[styles.activityTitle, { color: currentTheme.textSecondary }]}>Actividad reciente</Text>

        <View style={styles.activityRow}>
          <View style={[styles.bulletPoint, { backgroundColor: currentTheme.primary }]} />
          <Text style={[styles.activityText, { color: currentTheme.text }]}>{recentLotText}</Text>
        </View>

        <View style={styles.activityRow}>
          <View style={[styles.bulletPoint, { backgroundColor: '#3B82F6' }]} />
          <Text style={[styles.activityText, { color: currentTheme.text }]}>
            {totalPrendas > 0 ? `${totalPrendas} prendas organizadas en ${totalCajas} cajas` : 'Registra cajas y prendas para ver avances'}
          </Text>
        </View>

        <View style={styles.activityRow}>
          <View style={[styles.bulletPoint, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.activityText, { color: currentTheme.text }]}>
            Última sincronización a Cloudflare R2 & Supabase
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 22,
    padding: 18,
    marginTop: 12,
    marginBottom: 0,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statsButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricTile: {
    flex: 1,
    minWidth: '45%',
    height: 64,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  activitySection: {
    marginTop: -15,
    paddingTop: 16,
  },
  activityTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  bulletPoint: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 5,
  },
  activityText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
