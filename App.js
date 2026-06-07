import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Animated, Text } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppStore } from './src/store/useAppStore';
import AppNavigator from './src/navigation/AppNavigator';
import { useThemeColors } from './src/theme/palette';
import { shadows } from './src/theme/theme';
import GlobalLoader from './src/components/GlobalLoader';
import NetworkErrorScreen from './src/components/NetworkErrorScreen';

const AnimatedLoader = ({ isHydrating, colors }) => {
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    let loop;
    if (isHydrating) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 2,
          duration: 700,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsAnimationComplete(true);
      });
    }

    return () => {
      if (loop) loop.stop();
    };
  }, [isHydrating, opacity, scale]);

  if (isAnimationComplete) return null;

  return (
    <Animated.View style={[styles.loaderOverlay, { backgroundColor: colors.background, opacity }]}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        <View style={[styles.logoCircleLoader, { backgroundColor: `${colors.primary}25`, borderColor: `${colors.primary}50` }]}>
          <Text style={styles.logoTextLoader}>💪</Text>
        </View>
        <Text style={[styles.brandNameLoader, { color: colors.textPrimary }]}>GymPro</Text>
      </Animated.View>
      <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.accent} />
    </Animated.View>
  );
};

export default function App() {
  const init = useAppStore(state => state.init);
  const isHydrating = useAppStore(state => state.isHydrating);
  const themeMode = useAppStore((state) => state.themeMode);
  const colors = useThemeColors();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.background }}>
      <ExpoStatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
      <NetworkErrorScreen />
      <GlobalLoader />
      <AnimatedLoader isHydrating={isHydrating} colors={colors} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logoCircleLoader: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...shadows.glow,
  },
  logoTextLoader: {
    fontSize: 48,
  },
  brandNameLoader: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
