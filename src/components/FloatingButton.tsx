import React, { useRef } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';

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

  //useAppStore es un hook que nos permite acceder al estado global de la aplicación, en este caso el tema actual siempre sera claro ligth
  const { currentTheme } = useAppStore();

  // UseRef cambia el valor de scaleAnim sin causar un re-renderizado del componente
  const scaleAnim = useRef(new Animated.Value(1)).current;

  //animación al presionar el boton de + lo encoge
  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true }).start();
  };

  //animación al soltar el boton de + lo deja en su tamaño original
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
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <Ionicons name={icon as any} size={30} color="#FFF" />
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
  },
});
