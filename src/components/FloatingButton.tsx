import React, { useRef } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { clayStyles } from '../style/theme';

import { RoleGuard } from './RoleGuard';
import { RoleName } from '../types/roles';

interface FloatingButtonProps {
  onPress: () => void;
  icon?: string;
  style?: ViewStyle;
  roles?: RoleName[];
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({
  onPress,
  icon = "add",
  style,
  roles = ['Admin', 'Editor'],
}) => {

  const currentTheme = useAppStore(state => state.currentTheme);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <RoleGuard roles={roles}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={[{ position: 'absolute', bottom: 90, right: 24, zIndex: 999 }, style]}
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
          <Ionicons name={icon as any} size={28} color={currentTheme.primaryText} />
        </Animated.View>
      </TouchableOpacity>
    </RoleGuard>
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
