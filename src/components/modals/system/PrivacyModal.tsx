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
import { clayStyles } from '../../../styles/theme';
import { useAppStore } from '../../../store/useAppStore';

interface PrivacyModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRIVACY_SECTIONS = [
  {
    title: 'Datos Almacenados en tu Dispositivo (SQLite)',
    icon: 'server-outline',
    desc: 'Todos tus lotes, cajas, prendas e historial de actividad se guardan en una base de datos local SQLite dentro de tu dispositivo, permitiendo trabajar 100% sin internet.',
  },
  {
    title: 'Sincronización en Supabase Cloud',
    icon: 'cloud-done-outline',
    desc: 'Al conectar tu cuenta de Google, tus datos se respaldan de forma segura en Supabase mediante cifrado SSL/TLS y políticas Row Level Security (RLS) exclusivas para tu usuario.',
  },
  {
    title: 'Imágenes Privadas en Cloudflare R2',
    icon: 'images-outline',
    desc: 'Las fotos de prendas y solicitudes se almacenan de forma privada en Cloudflare R2 y se consultan únicamente con URLs firmadas temporales; nunca se publican ni indexan.',
  },
  {
    title: 'Asistente Topytop IA y Escaneo OCR',
    icon: 'sparkles-outline',
    desc: 'Topytop IA (vía Groq API) procesa solo las consultas de inventario que envías para responderte. El reconocimiento de texto (ML Kit OCR) se ejecuta localmente en tu teléfono sin enviar imágenes a terceros.',
  },
  {
    title: 'Notificaciones y Recordatorios Locales',
    icon: 'notifications-outline',
    desc: 'Las alarmas y recordatorios de prendas se programan directamente en tu dispositivo sin servicios de rastreo ni publicidad.',
  },
  {
    title: 'Lo que NUNCA compartimos',
    icon: 'shield-checkmark-outline',
    desc: 'Tu correo, inventarios, reportes o fotografías NUNCA se venden, alquilan ni comparten con terceros ni empresas anunciantes.',
  },
  {
    title: 'Control Total y Exportación',
    icon: 'happy-outline',
    desc: 'Eres dueño absoluto de tu información. Puedes exportar tus lotes a Excel o PDF, cerrar sesión o eliminar tus datos locales y en la nube en cualquier momento.',
  },
];

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ visible, onClose }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const insets = useSafeAreaInsets();

  const handleContactDev = () => {
    Linking.openURL('https://wa.me/51980709494').catch(() => {
      Alert.alert('Contacto', 'Puedes enviar tus comentarios a través de los enlaces de contacto en el menú principal.');
    });
  };

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
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}
          >
            <View style={[styles.introCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
              <Ionicons name="shield-checkmark" size={32} color={currentTheme.primary} style={{ marginBottom: 8 }} />
              <Text style={[styles.introTitle, { color: currentTheme.text }]}>Transparencia y Seguridad Garantizada</Text>
              <Text style={[styles.introDesc, { color: currentTheme.textSecondary }]}>
                En Topytop Kith v2.0 respetamos y protegemos la privacidad de tu inventario, tus fotografías y tu cuenta en todo momento.
              </Text>
            </View>

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
