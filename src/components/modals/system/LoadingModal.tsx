import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAppStore } from '../../../store/useAppStore';
import { clayStyles } from '../../../styles/theme';
import { Ionicons } from '@expo/vector-icons';

interface LoadingModalProps {
  visible: boolean;
  message?: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ visible, message }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const setSyncing = useAppStore(state => state.setSyncing);
  const [showDismissBtn, setShowDismissBtn] = useState(false);

  // Auto-cierre de seguridad tras 6 segundos para evitar que la pantalla se quede colgada
  useEffect(() => {
    if (!visible) {
      setShowDismissBtn(false);
      return;
    }

    // Mostrar botón de cancelar/continuar tras 2.5 segundos
    const btnTimer = setTimeout(() => {
      setShowDismissBtn(true);
    }, 2500);

    // Auto-cierre forzado a los 6 segundos
    const safetyTimer = setTimeout(() => {
      //console.warn('[LoadingModal] ⚠️ Tiempo de sincronización superó 6s. Cerrando modal de seguridad automáticamente.');
      setSyncing(false);
    }, 6000);

    return () => {
      clearTimeout(btnTimer);
      clearTimeout(safetyTimer);
    };
  }, [visible, setSyncing]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={() => setSyncing(false)}
    >
      <View style={styles.overlay}>
        <View
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
          <View style={[styles.iconContainer, { backgroundColor: currentTheme.background }]}>
            <ActivityIndicator size="large" color={currentTheme.primary} />
            <Ionicons
              name="cloud-upload-outline"
              size={24}
              color={currentTheme.primary}
              style={styles.centerIcon}
            />
          </View>

          <Text style={[styles.title, { color: currentTheme.text }]}>
            Sincronizando Datos
          </Text>

          <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>
            {message || 'Cargando y respaldando tu información...'}
          </Text>

          {showDismissBtn && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSyncing(false)}
              style={[styles.dismissButton, { borderColor: currentTheme.border, backgroundColor: currentTheme.background }]}
            >
              <Text style={[styles.dismissButtonText, { color: currentTheme.textSecondary }]}>
                Continuar en modo local
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  card: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 10,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  centerIcon: {
    position: 'absolute',
    opacity: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  dismissButton: {
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  dismissButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
