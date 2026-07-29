import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { navigationRef } from '../navigation/navigationRef';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

const SLIDES: OnboardingSlide[] = [
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

interface OnboardingScreenProps {
  onFinish?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onFinish }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const completeOnboarding = useAppStore(state => state.completeOnboarding);
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    await completeOnboarding();
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
    if (onFinish) onFinish();
  };

  const isDark = themeMode === 'dark';

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    return (
      <View style={[styles.slideWrapper, { width: SCREEN_WIDTH }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: currentTheme.card,
              shadowColor: currentTheme.primary,
            },
          ]}
        >
          {/* Top Illustration Area */}
          <View style={styles.illustrationContainer}>
            <View
              style={[
                styles.dashedCircle,
                { borderColor: currentTheme.primary },
              ]}
            >
              <Ionicons name={item.iconName} size={72} color={currentTheme.primary} />
            </View>
            
            {/* Small decorative floating elements */}
            <View style={[styles.decorSmall, { backgroundColor: currentTheme.primary, top: 10, right: 30 }]} />
            <View style={[styles.decorMedium, { backgroundColor: currentTheme.primary, bottom: 20, left: 20, opacity: 0.5 }]} />
          </View>

          {/* Texts Area */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: currentTheme.primary }]}>
              {item.title}
            </Text>
            <Text style={[styles.description, { color: currentTheme.textSecondary }]}>
              {item.description}
            </Text>
          </View>

          {/* Footer Area inside the card */}
          <View style={styles.cardFooter}>
            {/* Dots */}
            <View style={styles.paginationRow}>
              {SLIDES.map((_, dotIndex) => {
                const isCurrent = currentIndex === dotIndex;
                return (
                  <Animated.View
                    key={dotIndex}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isCurrent ? currentTheme.primary : currentTheme.border,
                        width: isCurrent ? 24 : 8,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={currentTheme.background} />

      {/* Header - Skip Button */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 24) }]}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity 
          onPress={handleSkip} 
          style={[styles.skipBtn, { backgroundColor: currentTheme.primary + '15', borderColor: currentTheme.primary + '30' }]} 
          activeOpacity={0.7}
        >
          <Text style={[styles.skipBtnText, { color: currentTheme.primary }]}>
            {currentIndex === SLIDES.length - 1 ? 'Empezar' : 'Omitir'}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={currentTheme.primary} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      {/* Horizontal Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onMomentumScrollEnd={ev => {
          const newIndex = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(newIndex);
        }}
        scrollEventThrottle={16}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    zIndex: 10,
    paddingBottom: 10,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  slideWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40, 
  },
  card: {
    width: SCREEN_WIDTH * 0.82,
    height: SCREEN_HEIGHT * 0.68,
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  illustrationContainer: {
    flex: 2,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    position: 'relative',
  },
  dashedCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorSmall: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  decorMedium: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  textContainer: {
    flex: 1.5,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  cardFooter: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  buttonContainer: {
    height: 48, 
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtn: {
    paddingHorizontal: 32,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
