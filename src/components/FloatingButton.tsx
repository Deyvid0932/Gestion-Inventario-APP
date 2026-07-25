import React, { useRef } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { clayStyles } from '../style/theme';

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

  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      style={[{ position: 'absolute', bottom: 30, right: 30, zIndex: 999 }, style]}
    >
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: currentTheme.primary,
            borderColor: currentTheme.border,
            borderWidth: clayStyles.borderWidth,
            shadowColor: currentTheme.borderShadow,
            shadowOpacity: 0.4,
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 12,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <Ionicons name={icon as any} size={28} color={themeMode === 'light' ? '#FFF' : '#000'} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
});
