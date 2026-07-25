import { Modal, TouchableWithoutFeedback, View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface ImagePreviewModalProps {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}

export const ImagePreviewModal = ({ uri, visible, onClose }: ImagePreviewModalProps) => (
  <Modal transparent visible={visible} animationType="fade">
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});