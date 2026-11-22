import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clayStyles } from '../../../styles/theme';
import { useAppStore } from '../../../store/useAppStore';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

const TECHNOLOGIES = [
  { name: 'React Native 0.83', icon: 'code-slash-outline', color: '#61DAFB', desc: 'Motor móvil nativo con Nueva Arquitectura para máximo rendimiento.' },
  { name: 'Expo SDK 55', icon: 'rocket-outline', color: '#000000', darkColor: '#FFFFFF', desc: 'Acceso nativo a cámara, galería, archivos, compartir y notificaciones.' },
  { name: 'TypeScript 5.9', icon: 'logo-javascript', color: '#3178C6', desc: 'Tipado estático estricto para mayor estabilidad en cada actualización.' },
  { name: 'SQLite (WAL)', icon: 'server-outline', color: '#003B57', darkColor: '#007ACC', desc: 'Base de datos local ultra rápida con funcionamiento 100% offline.' },
  { name: 'Supabase Cloud', icon: 'flash-outline', color: '#3ECF8E', desc: 'Autenticación segura con Google OAuth y sincronización en la nube.' },
  { name: 'Cloudflare R2', icon: 'cloud-upload-outline', color: '#F38020', desc: 'Almacenamiento privado con URLs firmadas para fotos de prendas y solicitudes.' },
  { name: 'Groq + Llama 3.3 IA', icon: 'hardware-chip-outline', color: '#8B5CF6', desc: 'Asistente Topytop IA para consultas inteligentes de inventario.' },
  { name: 'ML Kit OCR', icon: 'scan-outline', color: '#EC4899', desc: 'Reconocimiento óptico de texto local para escanear solicitudes y cartillas.' },
  { name: 'Excel & PDF Engine', icon: 'document-text-outline', color: '#10B981', desc: 'Generación de reportes en Excel con estilo y documentos PDF nativos.' },
  { name: 'Zustand & Reanimated', icon: 'cube-outline', color: '#F59E0B', desc: 'Estado global atómico y animaciones fluidas a 60 FPS.' },
];

const ADVANTAGES = [
  { title: 'Funciona sin internet', desc: 'Todos tus lotes, cajas, prendas y auditoría están disponibles offline en SQLite.', icon: 'cloud-offline-outline' },
  { title: 'Fotos en Cloudflare R2', desc: 'Respaldo privado de imágenes de prendas y solicitudes con carga optimizada.', icon: 'images-outline' },
  { title: 'Sincronización inteligente', desc: 'Respaldo automático en Supabase para restaurar o usar en varios dispositivos.', icon: 'cloud-done-outline' },
  { title: 'Topytop IA + Escaneo OCR', desc: 'Consultas en lenguaje natural y lectura rápida de etiquetas con cámara.', icon: 'sparkles-outline' },
  { title: 'Reportes Excel y PDF', desc: 'Exporta por lotes, cajas o prendas seleccionadas con columnas configurables.', icon: 'document-attach-outline' },
  { title: 'Auditoría de actividad', desc: 'Historial reciente de creaciones, ediciones y eliminaciones con filtros.', icon: 'time-outline' },
  { title: 'Recordatorios inteligentes', desc: 'Alarmas nativas para dar seguimiento a prendas en producción.', icon: 'alarm-outline' },
  { title: 'Seguridad de datos', desc: 'Inicio de sesión con Google OAuth y aislamiento por usuario con RLS.', icon: 'shield-checkmark-outline' },
];

export const AboutModal: React.FC<AboutModalProps> = ({ visible, onClose }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
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
              paddingBottom: 0,
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
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}
          >
            {/* Hero App Info */}
            <View style={[styles.appHeroCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
              <Image
                source={require('../../../../assets/icon_navidad.png')}
                style={styles.appLogoImage}
                resizeMode="cover"
              />
              <Text style={[styles.appName, { color: currentTheme.text }]}>Topytop Kith</Text>
              <Text style={[styles.appTagline, { color: currentTheme.textSecondary }]}>
                Sistema Inteligente de Gestión de Inventario Textil
              </Text>

              <View style={styles.appMetaGrid}>
                <View style={[styles.metaPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                  <Text style={[styles.metaLabel, { color: currentTheme.textSecondary }]}>Versión App</Text>
                  <Text style={[styles.metaValue, { color: currentTheme.text }]}>v2.0.0</Text>
                </View>

                <View style={[styles.metaPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                  <Text style={[styles.metaLabel, { color: currentTheme.textSecondary }]}>Base de Datos</Text>
                  <Text style={[styles.metaValue, { color: currentTheme.text }]}>SQLite v12</Text>
                </View>

                <View style={[styles.metaPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                  <Text style={[styles.metaLabel, { color: currentTheme.textSecondary }]}>Estado Usuario</Text>
                  <Text style={[styles.metaValue, { color: user ? '#2ecc71' : currentTheme.primary }]}>
                    {user ? 'Autenticado' : 'Sin sesión'}
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
    paddingTop: 100,
  },
  sheetContainer: {
    flex: 1,
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
  appLogoImage: {
    width: 68,
    height: 68,
    borderRadius: 18,
    marginBottom: 10,
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
