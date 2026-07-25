import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clayStyles } from '../style/theme';
import { useAppStore } from '../store/useAppStore';

interface PrivacyModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRIVACY_SECTIONS = [
  {
    title: '📱 Datos Almacenados en tu Dispositivo',
    icon: 'server-outline',
    desc: 'Topytop Kith almacena todos tus lotes, cajas y prendas en una base de datos local SQLite dentro de tu propio teléfono. Todo funciona sin necesidad de internet.',
  },
  {
    title: '☁ Sincronización en la Nube',
    icon: 'cloud-done-outline',
    desc: 'Si decides conectar tu cuenta de Google, se crea una copia de seguridad encriptada en Supabase Cloud para proteger tus datos contra pérdidas y sincronizar varios teléfonos.',
  },
  {
    title: '🚫 Lo que NUNCA compartimos',
    icon: 'shield-ban-outline',
    desc: 'Tu información personal, inventarios, imágenes o datos de cuenta NUNCA se venden, alquilan ni comparten con terceros ni empresas anunciantes.',
  },
  {
    title: '🔑 Uso de tu Cuenta de Google',
    icon: 'logo-google',
    desc: 'Únicamente solicitamos tu correo, nombre y foto de perfil pública para autenticarte de forma segura y asociar tus respaldos privados en Supabase.',
  },
  {
    title: '🛡️ Uso de Supabase Infrastructure',
    icon: 'lock-closed-outline',
    desc: 'Supabase utiliza encriptación de datos SSL/TLS de nivel bancario y políticas de seguridad Row Level Security (RLS) para que nadie más pueda ver tus prendas.',
  },
  {
    title: '🤖 Uso de Inteligencia Artificial (Llama 3.3 IA)',
    icon: 'sparkles-outline',
    desc: 'Las preguntas que le haces al Asistente IA procesan únicamente el texto de tus prendas para responder a tus consultas de inventario, sin almacenar datos personales.',
  },
  {
    title: '⚖️ Tus Derechos y Control de Datos',
    icon: 'happy-outline',
    desc: 'Eres dueño absoluto de tu información. Puedes exportar tus inventarios a Excel, cerrar sesión o eliminar completamente los datos de tu dispositivo en cualquier momento.',
  },
];

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ visible, onClose }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const insets = useSafeAreaInsets();

  const handleContactDev = () => {
    Linking.openURL('https://wa.me/').catch(() => {
      Alert.alert('Contacto', 'Puedes enviar tus comentarios a través de los enlaces de contacto en el menú principal.');
    });
  };

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
              <Ionicons name="document-text-outline" size={24} color={currentTheme.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: currentTheme.text }]} allowFontScaling={true}>
                Políticas y Privacidad
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}
              accessibilityLabel="Cerrar modal de privacidad"
            >
              <Ionicons name="close" size={20} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Intro Card */}
            <View style={[styles.introCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
              <Ionicons name="shield-checkmark" size={32} color={currentTheme.primary} style={{ marginBottom: 8 }} />
              <Text style={[styles.introTitle, { color: currentTheme.text }]}>Transparencia y Seguridad Garantizada</Text>
              <Text style={[styles.introDesc, { color: currentTheme.textSecondary }]}>
                En Topytop Kith respetamos y protegemos la privacidad de tu información. Diseñamos la aplicación para funcionar de forma privada e independiente.
              </Text>
            </View>

            {/* Secciones Informativas Sencillas */}
            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>PRINCIPIOS DE PRIVACIDAD</Text>
            <View style={[styles.sectionsContainer, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
              {PRIVACY_SECTIONS.map((sec, index) => (
                <React.Fragment key={sec.title}>
                  <View style={styles.sectionRow}>
                    <Ionicons name={sec.icon as any} size={22} color={currentTheme.primary} style={styles.sectionIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sectionItemTitle, { color: currentTheme.text }]}>{sec.title}</Text>
                      <Text style={[styles.sectionItemDesc, { color: currentTheme.textSecondary }]}>{sec.desc}</Text>
                    </View>
                  </View>
                  {index < PRIVACY_SECTIONS.length - 1 && <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />}
                </React.Fragment>
              ))}
            </View>

            {/* Botón Único de Acción */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: currentTheme.primary }]}
                onPress={handleContactDev}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Contactar al Desarrollador</Text>
              </TouchableOpacity>
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
  introCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  introDesc: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  sectionItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionItemDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  actionsRow: {
    gap: 8,
    marginBottom: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  actionBtnOutlineText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
