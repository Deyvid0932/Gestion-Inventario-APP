import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';

interface NavbarProps {
  title: string;
  showBackButton?: boolean;
  isLoading?: boolean;
}

export const Navbar = ({ title, showBackButton, isLoading }: NavbarProps) => {
  const navigation = useNavigation();
  const { currentTheme, toggleTheme, themeMode } = useAppStore();
  const lastBackPress = React.useRef(0);

  const handleBack = () => {
    const now = Date.now();
    if (now - lastBackPress.current < 400) return;
    lastBackPress.current = now;
    navigation.goBack();
  };

  return (
    <View style={[styles.header, { backgroundColor: currentTheme.primary }]}>
      <StatusBar 
        barStyle={themeMode === 'light' ? 'light-content' : 'dark-content'} 
        backgroundColor={currentTheme.primary} 
      />
      
      <View style={styles.left}>
        {showBackButton && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={30} color="#FFF" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {isLoading && (
          <ActivityIndicator size="small" color="#FFF" style={{ marginLeft: 10 }} />
        )}
      </View>

      <TouchableOpacity 
        onPress={toggleTheme} 
        style={styles.themeToggle}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={themeMode === 'light' ? "moon-outline" : "sunny-outline"} 
          size={24} 
          color="#FFF" 
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  themeToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
