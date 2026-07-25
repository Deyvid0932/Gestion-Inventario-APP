import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAppStore } from '../store/useAppStore';
import { clayStyles } from '../style/theme';
import { AccountModal } from './AccountModal';

interface NavbarProps {
  title: string;
  showBackButton?: boolean;
  isLoading?: boolean;
}

export const Navbar = ({ title, showBackButton, isLoading }: NavbarProps) => {
  const navigation = useNavigation();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);
  const [accountModalVisible, setAccountModalVisible] = React.useState(false);
  const lastBackPress = React.useRef(0);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  const handleBack = () => {
    const now = Date.now();
    if (now - lastBackPress.current < 300) return;
    lastBackPress.current = now;
    navigation.goBack();
  };

  return (
    <>
      <View style={[styles.header, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
        <StatusBar
          barStyle={themeMode === 'light' ? 'dark-content' : 'light-content'}
          backgroundColor={currentTheme.card}
        />

        <View style={styles.left}>
          {showBackButton && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7} accessibilityLabel="Regresar">
              <Ionicons name="arrow-back" size={28} color={currentTheme.text} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: currentTheme.text }]} numberOfLines={1} allowFontScaling={true}>
            {title}
          </Text>
          {isLoading && (
            <ActivityIndicator size="small" color={currentTheme.text} style={{ marginLeft: 10 }} />
          )}
        </View>

        <TouchableOpacity
          onPress={() => setAccountModalVisible(true)}
          style={[
            styles.accountButton,
            {
              backgroundColor: currentTheme.card,
              borderColor: currentTheme.border,
              borderWidth: clayStyles.borderWidth,
              shadowColor: currentTheme.borderShadow || '#000',
              shadowOpacity: 0.1,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 5,
              elevation: 4,
            },
          ]}
          activeOpacity={0.7}
          accessibilityLabel="Abrir menú de cuenta y ajustes"
          accessibilityRole="button"
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarNavImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          ) : (
            <Ionicons
              name="person-circle-outline"
              size={26}
              color={currentTheme.primary}
            />
          )}
        </TouchableOpacity>
      </View>

      <AccountModal
        visible={accountModalVisible}
        onClose={() => setAccountModalVisible(false)}
      />
    </>
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
});
