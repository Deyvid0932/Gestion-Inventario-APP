import { useState, useRef, useCallback } from 'react';
import { Animated, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { navigationRef } from '../../navigation/navigationRef';

export interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'GESTIÓN DE INVENTARIOS',
    description: 'Organiza todos tus lotes de producción, cajas y prendas textiles en tiempo real. Filtra instantáneamente por escaneo y edita sin retrasos.',
    iconName: 'cube-outline',
  },
  {
    id: '2',
    title: 'ESCANEO OCR E IA',
    description: 'Captura la OP directamente desde la cámara con OCR y realiza consultas conversacionales avanzadas con nuestro asistente inteligente Llama 3.3.',
    iconName: 'sparkles-outline',
  },
  {
    id: '3',
    title: 'RESPALDO CLOUD',
    description: 'Trabaja sin conexión a internet con la base de datos local ultrarrápida. Sincroniza de forma segura con Supabase y Cloudflare R2.',
    iconName: 'cloud-done-outline',
  },
  {
    id: '4',
    title: 'CONTROL TOTAL',
    description: 'Configura recordatorios nativos para dar seguimiento a prendas en taller y visualiza métricas de avance en tiempo real para optimizar lotes.',
    iconName: 'pie-chart-outline',
  },
];

interface UseOnboardingScreenProps {
  onFinish?: () => void;
  screenWidth: number;
}

export const useOnboardingScreen = ({ onFinish, screenWidth }: UseOnboardingScreenProps) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const completeOnboarding = useAppStore(state => state.completeOnboarding);

  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const handleComplete = useCallback(async () => {
    await completeOnboarding();
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
    if (onFinish) onFinish();
  }, [completeOnboarding, onFinish]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const onMomentumScrollEnd = useCallback(
    (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
      const newIndex = Math.round(ev.nativeEvent.contentOffset.x / screenWidth);
      setCurrentIndex(newIndex);
    },
    [screenWidth]
  );

  const isDark = themeMode === 'dark';
  const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;

  return {
    state: {
      currentIndex,
    },
    computed: {
      currentTheme,
      themeMode,
      isDark,
      isLastSlide,
      slides: ONBOARDING_SLIDES,
    },
    refs: {
      scrollX,
      flatListRef,
    },
    handlers: {
      handleSkip,
      handleComplete,
      onMomentumScrollEnd,
      setCurrentIndex,
    },
  };
};
