import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useAppInitialization } from '../../hooks/init/useAppInitialization';
import { useAppStore } from '../../store/useAppStore';
import { navigationRef } from '../../navigation/navigationRef';
import { AppNavigation } from '../../navigation/AppNavigation';

export function AppContent() {
    useAppInitialization();

    const themeMode = useAppStore(state => state.themeMode);
    const currentTheme = useAppStore(state => state.currentTheme);

    const navigationTheme = React.useMemo(() => ({
        ...(themeMode === 'dark' ? DarkTheme : DefaultTheme),
        colors: {
            ...(themeMode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
            background: currentTheme.background,
            card: currentTheme.card,
        },
    }), [themeMode, currentTheme.background, currentTheme.card]);

    return (
        <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
            <NavigationContainer ref={navigationRef} theme={navigationTheme}>
                <AppNavigation />
            </NavigationContainer>
        </View>
    );
}