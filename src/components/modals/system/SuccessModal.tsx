import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../../store/useAppStore';

interface SuccessModalProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  isVisible,
  onClose,
  title,
  message,
  buttonText = 'Aceptar'
}) => {
  const currentTheme = useAppStore(state => state.currentTheme);

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdropPress} activeOpacity={1} onPress={onClose} />

        <View style={[styles.modalCard, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: currentTheme.primary + '20' }]}>
            <Ionicons name="checkmark-circle" size={48} color={currentTheme.primary} />
          </View>

          <Text style={[styles.title, { color: currentTheme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: currentTheme.textSecondary }]}>{message}</Text>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: currentTheme.primary }]}
            activeOpacity={0.85}
            onPress={onClose}
          >
            <Text style={styles.btnText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
