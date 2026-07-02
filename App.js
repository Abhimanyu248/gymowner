import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Text } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppStore } from './src/store/useAppStore';
import AppNavigator from './src/navigation/AppNavigator';
import { useThemeColors } from './src/theme/palette';
import GlobalLoader from './src/components/GlobalLoader';
import NetworkErrorScreen from './src/components/NetworkErrorScreen';

const AnimatedLoader = ({ isHydrating, colors, themeMode }) => {
  const [isVisible, setIsVisible] = useState(isHydrating);
  const opacity = useRef(new Animated.Value(isHydrating ? 1 : 0)).current;
  const contentOffset = useRef(new Animated.Value(18)).current;
  const logoScale = useRef(new Animated.Value(0.96)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressLoop = useRef(null);

  useEffect(() => {
    if (isHydrating) {
      setIsVisible(true);
      opacity.stopAnimation();
      contentOffset.stopAnimation();
      logoScale.stopAnimation();
      progressAnim.stopAnimation();

      progressAnim.setValue(0);
      contentOffset.setValue(18);
      logoScale.setValue(0.96);

      progressLoop.current?.stop();

      progressLoop.current = Animated.loop(
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        { resetBeforeIteration: true }
      );
      progressLoop.current.start();

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(contentOffset, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 55,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      progressLoop.current?.stop();

      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsVisible(false);
        }
      });
    }

    return () => {
      progressLoop.current?.stop();
    };
  }, [isHydrating, opacity, contentOffset, logoScale, progressAnim]);

  if (!isVisible && !isHydrating) return null;

  const isDark = themeMode === 'dark';
  const progressTranslate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-76, 236],
  });

  return (
    <Animated.View
      pointerEvents={isHydrating ? 'auto' : 'none'}
      style={[styles.loaderOverlay, { backgroundColor: colors.background, opacity }]}
    >
      <View
        style={[
          styles.backgroundPanel,
          styles.backgroundPanelTop,
          { backgroundColor: isDark ? '#1E2A24' : '#E8F1EB' },
        ]}
      />
      <View
        style={[
          styles.backgroundPanel,
          styles.backgroundPanelBottom,
          { backgroundColor: isDark ? '#2A241F' : '#F2E2D2' },
        ]}
      />

      <Animated.View style={[styles.loaderContent, { transform: [{ translateY: contentOffset }] }]}>
        <View style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>Starting session</Text>
        </View>

        <Animated.View style={{ alignItems: 'center', transform: [{ scale: logoScale }] }}>
          <View
            style={[
              styles.logoCircleLoader,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? 'rgba(0, 210, 106, 0.36)' : 'rgba(31, 60, 52, 0.22)',
                boxShadow: isDark
                  ? '0 18px 34px rgba(0, 210, 106, 0.22)'
                  : '0 18px 34px rgba(31, 60, 52, 0.18)',
              },
            ]}
          >
            <Image
              source={require('./assets/bicep.png')}
              style={[styles.logoImageLoader, { tintColor: colors.textPrimary }]}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.brandNameLoader, { color: colors.textPrimary }]}>GymPro</Text>
          <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>Train smarter. Track stronger.</Text>
        </Animated.View>

        <View style={[styles.progressTrack, { backgroundColor: isDark ? '#242B35' : '#E3DACE' }]}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: colors.primary,
                transform: [{ translateX: progressTranslate }],
              },
            ]}
          />
        </View>
      </Animated.View>
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
      <AnimatedLoader isHydrating={isHydrating} colors={colors} themeMode={themeMode} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
    overflow: 'hidden',
  },
  backgroundPanel: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 36,
    opacity: 0.55,
    transform: [{ rotate: '18deg' }],
  },
  backgroundPanelTop: {
    top: -92,
    right: -84,
  },
  backgroundPanelBottom: {
    bottom: -112,
    left: -88,
  },
  loaderContent: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  statusPill: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 34,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  logoCircleLoader: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 2,
  },
  logoImageLoader: {
    width: 128,
    height: 128,
  },
  brandNameLoader: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 10,
    zIndex: 2,
  },
  brandTagline: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  progressTrack: {
    width: 236,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 56,
  },
  progressBar: {
    width: 76,
    height: '100%',
    borderRadius: 2,
  },
});
