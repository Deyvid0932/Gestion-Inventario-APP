import React from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Navbar } from '../components';
import { SkeletonLoader } from '../components';
import { clayStyles } from '../styles/theme';
import { useStatsScreen } from '../hooks';

export const StatsScreen = () => {
  const { state, computed, handlers } = useStatsScreen();
  const { stats, activities, loading, refreshing } = state;
  const {
    currentTheme,
    themeMode,
    colorScheme,
    greeting,
    firstName,
    syncText,
    isSyncing,
  } = computed;
  const { onRefresh, navigateTo, formatRelativeTime } = handlers;

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
            <Text style={[styles.welcomeSubtitle, { color: currentTheme.textSecondary }]}>Gestiona tus prendas fácilmente</Text>
          </Animated.View>

          {/* 2. HERO CARD "RESUMEN DE INVENTARIO" */}
          <Animated.View entering={FadeInUp.delay(200).springify()} style={[styles.inventoryCard, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
            <View style={styles.inventoryCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.inventoryIconPill, { backgroundColor: currentTheme.primary + '18' }]}>
                  <Ionicons name="layers-outline" size={16} color={currentTheme.primary} />
                </View>
                <Text style={[styles.inventoryCardLabel, { color: currentTheme.textSecondary }]}>RESUMEN GENERAL</Text>
              </View>
              <View style={[styles.liveDotPill, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
                <View style={styles.liveDot} />
                <Text style={styles.liveDotText}>Activo</Text>
              </View>
            </View>

            <View style={styles.inventoryStatsRow}>
              <Text style={[styles.inventoryNumber, { color: currentTheme.text }]}>
                {stats.totalGarments.toLocaleString()}
              </Text>
              <Text style={[styles.inventorySublabel, { color: currentTheme.textSecondary }]}>
                Prendas totales registradas
              </Text>
            </View>

            <View style={[styles.inventoryRibbon, { borderTopColor: currentTheme.border }]}>
              <View style={styles.ribbonItem}>
                <Ionicons name="cube-outline" size={15} color={currentTheme.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.ribbonValue, { color: currentTheme.text }]}>{stats.totalBoxes}</Text>
                <Text style={[styles.ribbonLabel, { color: currentTheme.textSecondary }]}>Cajas</Text>
              </View>
              <View style={[styles.ribbonDivider, { backgroundColor: currentTheme.border }]} />
              <View style={styles.ribbonItem}>
                <Ionicons name="albums-outline" size={15} color={currentTheme.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.ribbonValue, { color: currentTheme.text }]}>{stats.totalInventories}</Text>
                <Text style={[styles.ribbonLabel, { color: currentTheme.textSecondary }]}>Lotes</Text>
              </View>
              <View style={[styles.ribbonDivider, { backgroundColor: currentTheme.border }]} />
              <View style={styles.ribbonItem}>
                <Ionicons name="notifications-outline" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text style={[styles.ribbonValue, { color: currentTheme.text }]}>{stats.garmentsWithAlarm || 0}</Text>
                <Text style={[styles.ribbonLabel, { color: currentTheme.textSecondary }]}>Alarmas</Text>
              </View>
            </View>
          </Animated.View>

          {/* 3. SECCIÓN "¿QUÉ DESEAS HACER?" */}
          <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.actionsSection}>
            <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>¿Qué deseas hacer?</Text>

            <View style={styles.actionsGrid}>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                  onPress={() => navigateTo('History')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#3B82F618' }]}>
                    <Ionicons name="search" size={24} color="#3B82F6" />
                  </View>
                  <Text style={[styles.actionText, { color: currentTheme.text }]}>Buscar prendas</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                  onPress={() => navigateTo('Inventories')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#8B5CF618' }]}>
                    <Ionicons name="albums" size={24} color="#8B5CF6" />
                  </View>
                  <Text style={[styles.actionText, { color: currentTheme.text }]}>Lotes e inventarios</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                  onPress={() => navigateTo('Chatbot')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: currentTheme.primary + '18' }]}>
                    <Ionicons name="sparkles" size={24} color={currentTheme.primary} />
                  </View>
                  <Text style={[styles.actionText, { color: currentTheme.text }]}>Topytop IA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                  onPress={() => navigateTo('Settings')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#64748B18' }]}>
                    <Ionicons name="settings-sharp" size={24} color="#64748B" />
                  </View>
                  <Text style={[styles.actionText, { color: currentTheme.text }]}>Ajustes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* 4. ACTIVIDAD RECIENTE (AUDITORÍA COMPLETA) */}
          <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.recentActivitySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Actividad reciente</Text>
              <View style={[styles.countBadge, { backgroundColor: currentTheme.primary + '15' }]}>
                <Text style={[styles.countBadgeText, { color: currentTheme.primary }]}>{activities.length} eventos</Text>
              </View>
            </View>

            {activities.length > 0 ? (
              <View style={[styles.activityContainer, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                {activities.map((activity, index) => {
                  const isCreated = activity.action === 'creado';
                  const isEdited = activity.action === 'editado';
                  const actionColor = isCreated ? '#10B981' : isEdited ? '#F59E0B' : '#EF4444';
                  const actionBg = isCreated ? '#10B98115' : isEdited ? '#F59E0B15' : '#EF444415';
                  const actionText = isCreated ? '+ Creado' : isEdited ? '✎ Editado' : '✕ Eliminado';

                  return (
                    <View
                      key={activity.id}
                      style={[
                        styles.activityItem,
                        index < activities.length - 1 && { borderBottomWidth: 1, borderBottomColor: currentTheme.border }
                      ]}
                    >
                      <View style={[styles.activityIconBox, { backgroundColor: actionBg }]}>
                        <Ionicons name={activity.icon} size={20} color={actionColor} />
                      </View>

                      <View style={styles.activityTextContainer}>
                        <View style={styles.activityTitleRow}>
                          <Text style={[styles.activityTitle, { color: currentTheme.text }]}>{activity.title}</Text>
                          <View style={[styles.actionTag, { backgroundColor: actionBg, borderColor: actionColor + '30' }]}>
                            <Text style={[styles.actionTagText, { color: actionColor }]}>{actionText}</Text>
                          </View>
                        </View>
                        <Text style={[styles.activitySubtitle, { color: currentTheme.textSecondary }]} numberOfLines={1}>
                          {activity.subtitle}
                        </Text>
                      </View>

                      <Text style={[styles.activityTime, { color: currentTheme.textSecondary }]}>
                        {formatRelativeTime(activity.date)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.emptyActivityContainer, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                <Ionicons name="time-outline" size={32} color={currentTheme.textSecondary} style={{ opacity: 0.6, marginBottom: 8 }} />
                <Text style={[styles.emptyActivityText, { color: currentTheme.textSecondary }]}>No hay actividad reciente registrada</Text>
              </View>
            )}
          </Animated.View>

          {/* 5. ESTADO DE SINCRONIZACIÓN */}
          <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.syncStatusSection}>
            <View style={[styles.syncStatusPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
              <Ionicons
                name={isSyncing ? "sync" : "cloud-done-outline"}
                size={15}
                color={isSyncing ? currentTheme.primary : '#10B981'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.syncStatusText, { color: currentTheme.textSecondary }]}>
                {syncText}
              </Text>
            </View>
          </Animated.View>

        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 50 },

  welcomeSection: {
    marginTop: 1,
    marginBottom: 15,
  },
  welcomeTitle: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
  },

  /* HERO CARD RESUMEN */
  inventoryCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 28,
  },
  inventoryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inventoryIconPill: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  inventoryCardLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  liveDotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  liveDotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  inventoryStatsRow: {
    marginBottom: 16,
  },
  inventoryNumber: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 2,
  },
  inventorySublabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  inventoryRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  ribbonItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonValue: {
    fontSize: 14,
    fontWeight: '800',
    marginRight: 4,
  },
  ribbonLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  ribbonDivider: {
    width: 1,
    height: 20,
  },

  /* ACCIONES RÁPIDAS */
  actionsSection: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  actionsGrid: {
    gap: 12,
    marginTop: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* ACTIVIDAD RECIENTE AUDITADA */
  recentActivitySection: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activityContainer: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  activityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityTextContainer: {
    flex: 1,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  activitySubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyActivityContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActivityText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* SINCRONIZACIÓN */
  syncStatusSection: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  syncStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
