import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screen/HomeScreen';
import { ChatbotScreen } from '../screen/ChatbotScreen';
import { HistoryScreen } from '../screen/HistoryScreen';
import { SettingsScreen } from '../screen/SettingsScreen';
import { InventariosScreen } from '../screen/InventariosScreen';
import { CajasScreen } from '../screen/CajasScreen';
import CajaContentsScreen from '../screen/CajaContentsScreen';
import { FormScreen } from '../screen/FormScreen';
import { RootStackParamList, BottomTabParamList } from '../types';
import { useAppStore } from '../store/useAppStore';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

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
      <Stack.Screen name="Inventarios" component={InventariosScreen} />
      <Stack.Screen name="Cajas" component={CajasScreen} />
      <Stack.Screen name="ExcelGrid" component={CajaContentsScreen} />
      <Stack.Screen name="Form" component={FormScreen} />
    </Stack.Navigator>
  );
};

const TabNavigator = () => {
  const currentTheme = useAppStore(state => state.currentTheme);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Chatbot') {
            iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Chatbot" component={ChatbotScreen} options={{ title: 'Asistente' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
};

export const AppNavigation = () => {
  return <MainStack />;
};
