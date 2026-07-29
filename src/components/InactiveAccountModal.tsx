import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../database/supabase';

export const InactiveAccountModal: React.FC = () => {
  const isAccountActive = useAppStore(state => state.isAccountActive);
  const currentTheme = useAppStore(state => state.currentTheme);
  const clearAllState = useAppStore(state => state.clearAllState);

  if (isAccountActive) return null;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    clearAllState();
  };

  return (
    <Modal visible={!isAccountActive} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={48} color="#EF4444" />
          </View>
          <Text style={[styles.title, { color: currentTheme.text }]}>Cuenta Desactivada</Text>
          <Text style={[styles.message, { color: currentTheme.textSecondary }]}>
            Tu acceso a la aplicación ha sido suspendido por un Administrador. Si crees que se trata de un error, contacta a tu supervisor.
          </Text>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    width: '100%',
    height: 48,
    borderRadius: 14,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
