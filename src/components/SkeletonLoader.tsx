import React from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const SkeletonLoader = ({ theme }: { theme: any }) => {
  const animatedValue = new Animated.Value(0);

  //UseEffect es un hook que se ejecuta un bucle infinito que anima el valor de animatedValue de 0 a 1 en un tiempo de 1500ms
  React.useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  const SkeletonItem = () => (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: theme.border, width: 80 }]} />
        <View style={[styles.badge, { backgroundColor: theme.border, width: 100 }]} />
      </View>
      <View style={[styles.line, { backgroundColor: theme.border, width: '60%' }]} />
      <View style={[styles.line, { backgroundColor: theme.border, width: '40%' }]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
        ]}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonItem key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 18 },
  card: {
    height: 100,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  badge: { height: 24, borderRadius: 8 },
  line: { height: 12, borderRadius: 6, marginBottom: 10 },
});
