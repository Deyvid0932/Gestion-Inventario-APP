import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../style/theme';

interface FloatingButtonProps {
  onPress: () => void;
  icon?: string;
  style?: ViewStyle;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({ 
  onPress, 
  icon = "add", 
  style 
}) => {
  const currentTheme = theme.light;

  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        { backgroundColor: currentTheme.primary }, 
        style
      ]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon as any} size={30} color="#FFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 999,
  },
});
