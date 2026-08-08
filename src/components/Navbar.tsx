import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';

interface NavbarProps {
  title: string;
  showBackButton?: boolean;
  isLoading?: boolean;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
}

export const Navbar = ({ title, showBackButton, isLoading, rightElement, leftElement }: NavbarProps) => {
  const navigation = useNavigation();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const lastBackPress = React.useRef(0);

  const handleBack = () => {
    const now = Date.now();
    if (now - lastBackPress.current < 300) return;
    lastBackPress.current = now;
    navigation.goBack();
  };

  return (
    <View style={[styles.header, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
      <StatusBar
        barStyle={themeMode === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={currentTheme.card}
      />

      <View style={styles.left}>
        {leftElement ? leftElement : (
          showBackButton && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7} accessibilityLabel="Regresar">
              <Ionicons name="arrow-back" size={28} color={currentTheme.text} />
            </TouchableOpacity>
          )
        )}
        <Text style={[styles.headerTitle, { color: currentTheme.text }]} numberOfLines={1} allowFontScaling={true}>
          {title}
        </Text>
        {isLoading && (
          <ActivityIndicator size="small" color={currentTheme.primary} style={{ marginLeft: 10 }} />
        )}
      </View>

      <View style={styles.right}>
        {rightElement}
      </View>
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
    paddingTop: 45,
    borderBottomWidth: 1,
    elevation: 4,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
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
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  accountButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarNavImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
