import React, { useEffect } from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { InventoriesScreen } from '../screens/InventoriesScreen';
import { BoxesScreen } from '../screens/BoxesScreen';
import { BoxContentsScreen } from '../screens/BoxContentsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ChatbotScreen } from '../screens/ChatbotScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { RootStackParamList, BottomTabParamList } from '../types';
import { useAppStore } from '../store/useAppStore';
import { FormScreen } from '../screens/FormScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TrashScreen } from '../screens/TrashScreen';
import { LoadingModal } from '../components';
import { InactiveAccountModal } from '../components';
import { navigationRef } from './navigationRef';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

const MainStack = () => {
  const currentTheme = useAppStore(state => state.currentTheme);

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        cardShadowEnabled: false,
        cardOverlayEnabled: false,
        cardStyle: { backgroundColor: currentTheme.background },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Boxes" component={BoxesScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="BoxContents" component={BoxContentsScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Trash" component={TrashScreen} />
      <Stack.Screen name="Form" component={FormScreen} />
    </Stack.Navigator>
  );
};



const TabNavigator = () => {
  const currentTheme = useAppStore(state => state.currentTheme);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Inventories') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Chatbot') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: currentTheme.primary,
        tabBarInactiveTintColor: currentTheme.textSecondary,
        tabBarStyle: {
          backgroundColor: currentTheme.card,
          borderTopColor: currentTheme.border,
        },
      })}
    >
      <Tab.Screen name="Home" component={StatsScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Inventories" component={InventoriesScreen} options={{ title: 'Lotes' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Buscar' }} />
      <Tab.Screen name="Chatbot" component={ChatbotScreen} options={{ title: 'Asistente' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
};

export const AppNavigation = () => {
  const isSyncing = useAppStore(state => state.isSyncing);
  const syncMessage = useAppStore(state => state.syncMessage);
  const isAuthLoading = useAppStore(state => state.isAuthLoading);
  const hasCompletedOnboarding = useAppStore(state => state.hasCompletedOnboarding);
  const checkOnboardingStatus = useAppStore(state => state.checkOnboardingStatus);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  useEffect(() => {
    if (hasCompletedOnboarding === false && navigationRef.isReady()) {
      navigationRef.navigate('Onboarding');
    }
  }, [hasCompletedOnboarding]);

  const showLoading = isAuthLoading || (isSyncing && syncMessage === 'Limpiando...');
  const loadingMsg = isAuthLoading ? 'Iniciando Sesión...' : (syncMessage || 'Limpiando...');

  return (
    <>
      <MainStack />
      <LoadingModal visible={showLoading} message={loadingMsg} />
      <InactiveAccountModal />
    </>
  );
};
