import { Modal, TouchableWithoutFeedback, View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface ImagePreviewModalProps {
  uri: string | null;      // La foto es un string (o nula si no hay)
  visible: boolean;        // Es un interruptor (true/false)
  onClose: () => void;     // Es una función que no devuelve nada
}

export const ImagePreviewModal = ({ uri, visible, onClose } : ImagePreviewModalProps ) => (
  <Modal transparent visible={visible} animationType="fade">
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        <Animated.Image 
          entering={FadeIn.duration(300)} // Animación suave al aparecer
          source={{ uri: uri || '' }}
          style={styles.fullImage} 
          resizeMode="contain" 
        />
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)', // Fondo oscuro profesional
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});