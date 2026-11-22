import React from 'react';
import { Modal, TouchableWithoutFeedback, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImagePreviewModalProps {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}

export const ImagePreviewModal = ({ uri, visible, onClose }: ImagePreviewModalProps) => {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {/* Botón solo X de Cierre en la esquina superior derecha */}
          <TouchableOpacity
            style={[styles.closeButton, { top: Math.max(insets.top + 8, 16) }]}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Cerrar vista de imagen"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <Image
            source={{ uri: uri || '' }}
            style={styles.fullImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 999,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
