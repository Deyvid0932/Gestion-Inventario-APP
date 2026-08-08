import React from 'react';
import { Modal, TouchableWithoutFeedback, View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface ImagePreviewModalProps {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}

export const ImagePreviewModal = ({ uri, visible, onClose }: ImagePreviewModalProps) => {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {/* Botón solo X de Cierre en la esquina superior derecha */}
          <TouchableOpacity
            style={[styles.closeButton, { top: Math.max(insets.top + 10, 20) }]}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Cerrar vista de imagen"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={32} color="#FFFFFF" />
          </TouchableOpacity>

          <AnimatedImage
            entering={FadeIn.duration(300)}
            source={{ uri: uri || '' }}
            style={styles.fullImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
          />
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    zIndex: 999,
    padding: 8,
  },
  fullImage: {
    width: '100%',
    height: '85%',
  },
});