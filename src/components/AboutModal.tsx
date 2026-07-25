import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clayStyles } from '../style/theme';
import { useAppStore } from '../store/useAppStore';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

const TECHNOLOGIES = [
  { name: 'React Native', icon: 'code-slash-outline', color: '#61DAFB', desc: 'Framework móvil nativo de alto rendimiento para Android e iOS.' },
  { name: 'Expo', icon: 'rocket-outline', color: '#000000', darkColor: '#FFFFFF', desc: 'Plataforma para acceso nativo al hardware, cámara y notificaciones.' },
  { name: 'TypeScript', icon: 'logo-javascript', color: '#3178C6', desc: 'Tipado estático seguro para prevenir errores en tiempo de desarrollo.' },
  { name: 'SQLite (WAL)', icon: 'server-outline', color: '#003B57', darkColor: '#007ACC', desc: 'Base de datos relacional ultra rápida almacenada 100% en tu dispositivo.' },
  { name: 'Supabase', icon: 'flash-outline', color: '#3ECF8E', desc: 'Backend Cloud para autenticación segura con Google y sincronización remota.' },
  { name: 'Llama 3.3 IA', icon: 'hardware-chip-outline', color: '#8B5CF6', desc: 'Modelo de inteligencia artificial avanzado para el asistente virtual y consultas.' },
  { name: 'React Navigation', icon: 'navigate-outline', color: '#7B1FA2', desc: 'Gestor de rutas y navegación entre pestañas sin lag.' },
  { name: 'Zustand', icon: 'cube-outline', color: '#F59E0B', desc: 'Estado global atómico y ligero sin renders globales innecesarios.' },
];

const ADVANTAGES = [
  { title: 'Funciona sin internet', desc: 'Todos tus lotes, cajas y prendas están disponibles offline en SQLite.', icon: 'cloud-offline-outline' },
  { title: 'Sincronización en la nube', desc: 'Respaldo seguro en Supabase para restaurar o usar en varios teléfonos.', icon: 'cloud-done-outline' },
  { title: 'IA integrada (Llama 3.3)', desc: 'Consultas inteligentes para buscar prendas por color, lote o descripción.', icon: 'sparkles-outline' },
  { title: 'Búsquedas ultra rápidas', desc: 'Filtros instantáneos con índices optimizados en base de datos local.', icon: 'search-outline' },
  { title: 'Gestión por Lotes y Cajas', desc: 'Organización estructurada y profesional de inventarios textiles.', icon: 'albums-outline' },
  { title: 'Recordatorios inteligentes', desc: 'Alarmas nativas para dar seguimiento a prendas en producción.', icon: 'alarm-outline' },
  { title: 'Interfaz moderna y limpia', desc: 'Estilo neumórfico/claymorphic adaptado a múltiples paletas de color.', icon: 'color-palette-outline' },
  { title: 'Alto rendimiento', desc: 'Arquitectura de renderizado ligero sin tirones ni retrasos.', icon: 'speedometer-outline' },
  { title: 'Seguridad de datos', desc: 'Inicio de sesión con Google OAuth sin compartir contraseñas.', icon: 'shield-checkmark-outline' },
];

export const AboutModal: React.FC<AboutModalProps> = ({ visible, onClose }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheetContainer,
            clayStyles,
            {
              backgroundColor: currentTheme.card,
              borderColor: currentTheme.border,
              shadowColor: currentTheme.borderShadow || '#000',
              maxHeight: '85%',
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          <View style={styles.dragIndicator} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Ionicons name="information-circle-outline" size={24} color={currentTheme.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: currentTheme.text }]} allowFontScaling={true}>
                Acerca de la Aplicación
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}
              accessibilityLabel="Cerrar acerca de la aplicación"
            >
              <Ionicons name="close" size={20} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Hero App Info */}
            <View style={[styles.appHeroCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
              <View style={[styles.appLogoBadge, { backgroundColor: currentTheme.primary }]}>
                <Ionicons name="cube" size={32} color="#FFF" />
              </View>
              <Text style={[styles.appName, { color: currentTheme.text }]}>Topytop Kith</Text>
              <Text style={[styles.appTagline, { color: currentTheme.textSecondary }]}>
                Sistema Inteligente de Gestión de Inventario Textil
              </Text>

              <View style={styles.appMetaGrid}>
                <View style={[styles.metaPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                  <Text style={[styles.metaLabel, { color: currentTheme.textSecondary }]}>Versión App</Text>
                  <Text style={[styles.metaValue, { color: currentTheme.text }]}>v1.0.0</Text>
                </View>

                <View style={[styles.metaPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                  <Text style={[styles.metaLabel, { color: currentTheme.textSecondary }]}>Base de Datos</Text>
                  <Text style={[styles.metaValue, { color: currentTheme.text }]}>SQLite v12</Text>
                </View>

                <View style={[styles.metaPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                  <Text style={[styles.metaLabel, { color: currentTheme.textSecondary }]}>Estado Usuario</Text>
                  <Text style={[styles.metaValue, { color: user ? '#2ecc71' : currentTheme.primary }]}>
                    {user ? 'Autenticado' : 'Invitado'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Sección: Tecnologías Utilizadas */}
            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>TECNOLOGÍAS UTILIZADAS</Text>
            <View style={styles.techGrid}>
              {TECHNOLOGIES.map((tech) => {
                const iconColor = themeMode === 'dark' && tech.darkColor ? tech.darkColor : tech.color;
                return (
                  <View key={tech.name} style={[styles.techCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                    <View style={styles.techCardHeader}>
                      <Ionicons name={tech.icon as any} size={20} color={iconColor} style={{ marginRight: 8 }} />
                      <Text style={[styles.techName, { color: currentTheme.text }]}>{tech.name}</Text>
                    </View>
                    <Text style={[styles.techDesc, { color: currentTheme.textSecondary }]}>{tech.desc}</Text>
                  </View>
                );
              })}
            </View>

            {/* Sección: Ventajas Destacadas */}
            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary, marginTop: 14 }]}>BENEFICIOS Y VENTAJAS</Text>
            <View style={[styles.advantagesContainer, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
              {ADVANTAGES.map((adv, index) => (
                <React.Fragment key={adv.title}>
                  <View style={styles.advantageRow}>
                    <Ionicons name={adv.icon as any} size={22} color={currentTheme.primary} style={styles.advantageIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.advantageTitle, { color: currentTheme.text }]}>{adv.title}</Text>
                      <Text style={[styles.advantageDesc, { color: currentTheme.textSecondary }]}>{adv.desc}</Text>
                    </View>
                  </View>
                  {index < ADVANTAGES.length - 1 && <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />}
                </React.Fragment>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    elevation: 10,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#CCCCCC',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  appHeroCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  appLogoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 4,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  appTagline: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  appMetaGrid: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  metaPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  techGrid: {
    gap: 8,
    marginBottom: 10,
  },
  techCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  techCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  techName: {
    fontSize: 13,
    fontWeight: '700',
  },
  techDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  advantagesContainer: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  advantageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  advantageIcon: {
    marginRight: 12,
  },
  advantageTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  advantageDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  divider: {
    height: 1,
    width: '100%',
  },
});
