import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingScreen, OnboardingSlide } from '../hooks';

interface OnboardingScreenProps {
  onFinish?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onFinish }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const {
    state: { currentIndex },
    computed: { currentTheme, isDark, isLastSlide, slides },
    refs: { scrollX, flatListRef },
    handlers: { handleSkip, onMomentumScrollEnd },
  } = useOnboardingScreen({ onFinish, screenWidth });

  const renderSlide = ({ item }: { item: OnboardingSlide; index: number }) => {
    return (
      <View style={[styles.slideWrapper, { width: screenWidth }]}>
        <View
          style={[
            styles.card,
            {
              width: screenWidth * 0.82,
              height: screenHeight * 0.68,
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
              {slides.map((_, dotIndex) => {
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
            {isLastSlide ? 'Empezar' : 'Omitir'}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={currentTheme.primary} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      {/* Horizontal Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        scrollEnabled
        style={styles.slidesList}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slidesList: {
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
