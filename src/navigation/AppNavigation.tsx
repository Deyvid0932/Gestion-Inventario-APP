import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { InventariosScreen } from '../screen/InventariosScreen';
import CajaContentsScreen from '../screen/CajaContentsScreen';
import { HistoryScreen } from '../screen/HistoryScreen';
import { StatsScreen } from '../screen/StatsScreen';
import { ChatbotScreen } from '../screen/ChatbotScreen';
import { OnboardingScreen } from '../screen/OnboardingScreen';
import { RootStackParamList, BottomTabParamList } from '../types';
import { useAppStore } from '../store/useAppStore';
import { CajasScreen } from '../screen/CajasScreen';
import { FormScreen } from '../screen/FormScreen';

import { LoadingModal } from '../components/LoadingModal';
import { InactiveAccountModal } from '../components/InactiveAccountModal';
import { navigationRef } from './navigationRef';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

import { TrashScreen } from '../screen/TrashScreen';

const MainStack = () => {
  const currentTheme = useAppStore(state => state.currentTheme);

  return (
    <Stack.Navigator 
      initialRouteName="MainTabs"
      screenOptions={{ 
        animation: 'fade_from_bottom',
        headerShown: false,
        gestureEnabled: true,
        cardStyle: { backgroundColor: currentTheme.background },
        transitionSpec: {
          open: { animation: 'spring', config: { stiffness: 1000, damping: 500, mass: 3, overshootClamping: true, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 } },
          close: { animation: 'spring', config: { stiffness: 1000, damping: 500, mass: 3, overshootClamping: true, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 } },
        },
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              opacity: current.progress,
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width * 0.1, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Cajas" component={CajasScreen} />
      <Stack.Screen name="ExcelGrid" component={CajaContentsScreen} />
      <Stack.Screen name="Form" component={FormScreen} />
    </Stack.Navigator>
  );
};

import { SettingsScreen } from '../screen/SettingsScreen';

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
          } else if (route.name === 'Inventarios') {
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
      <Tab.Screen name="Inventarios" component={InventariosScreen} options={{ title: 'Lotes' }} />
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

  const showLoading = isSyncing || isAuthLoading;
  const loadingMsg = isAuthLoading ? 'Iniciando Sesión...' : (syncMessage || 'Sincronizando Datos...');

  return (
    <>
      <MainStack />
      <LoadingModal visible={showLoading} message={loadingMsg} />
      <InactiveAccountModal />
    </>
  );
};
