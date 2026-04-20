import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { InventariosScreen } from '../screen/InventariosScreen';
import CajaContentsScreen from '../screen/CajaContentsScreen';
import { HistoryScreen } from '../screen/HistoryScreen';
import { RootStackParamList, BottomTabParamList } from '../types';
import { useAppStore } from '../store/useAppStore';
import CajasScreen from '../screen/CajasScreen';
import { FormScreen } from '../screen/FormScreen';
import GarmentDetailsScreen from '../screen/GarmentDetailsScreen';


const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

const MainStack = () => {
  return (
    <Stack.Navigator 
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Cajas" component={CajasScreen} />
      <Stack.Screen name="ExcelGrid" component={CajaContentsScreen} />
      <Stack.Screen name="Form" component={FormScreen} />
      
    </Stack.Navigator>
  );
};

const TabNavigator = () => {
  const { currentTheme } = useAppStore();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Inventarios') {
            iconName = focused ? 'file-tray-stacked' : 'file-tray-stacked-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'GarmentDetails') {
            iconName = focused ? 'shirt' : 'shirt-outline';
          }
          else {
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
      <Tab.Screen name="Inventarios" component={InventariosScreen} options={{ title: 'Lotes' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="GarmentDetails" component={GarmentDetailsScreen} options={{ title: 'Registros' }} />
    </Tab.Navigator>
  );
};

export const AppNavigation = () => {
  return <MainStack />;
};
