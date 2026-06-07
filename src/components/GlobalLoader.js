import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { useThemeColors } from '../theme/palette';
import { Dumbbell } from 'lucide-react-native';

const SpinRing = ({ size, color, reverse, duration, thickness }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim, duration]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: thickness,
        borderColor: 'transparent',
        borderTopColor: color,
        borderRightColor: reverse ? color : 'transparent',
        transform: [{ rotate: spin }],
      }}
    />
  );
};

const PulsingIcon = ({ color }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ])
    ).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }}>
      <Dumbbell size={32} color={color} strokeWidth={2.5} />
    </Animated.View>
  );
};

/**
 * GlobalLoader
 * A single, centered, animated loading overlay shown whenever any backend
 * operation is in progress (isLoadingData === true in the store).
 * Mount this once at the root level so every screen shares one loader.
 */
export default function GlobalLoader() {
  const isLoadingData = useAppStore((state) => state.isLoadingData);
  const themeMode = useAppStore((state) => state.themeMode);
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const prevLoading = useRef(false);
  const [isVisible, setIsVisible] = useState(isLoadingData);

  useEffect(() => {
    if (isLoadingData && !prevLoading.current) {
      setIsVisible(true);
      // Fade and zoom in
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!isLoadingData && prevLoading.current) {
      // Fade and zoom out
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0, // Shrink to 0 to completely eliminate shadow
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsVisible(false);
      });
    }
    prevLoading.current = isLoadingData;
  }, [isLoadingData, opacity, scale]);

  if (!isVisible && !isLoadingData) return null;

  // Keep in tree while animating even when isLoadingData becomes false
  // (the fade-out animation needs the component mounted)
  return (
    <Animated.View
      style={[
        styles.overlay,
        { 
          opacity,
          backgroundColor: themeMode === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.65)'
        }
      ]}
      pointerEvents={isLoadingData ? 'auto' : 'none'}
    >
      <Animated.View style={[styles.card, { backgroundColor: colors.surface, transform: [{ scale }] }]}>
        {/* Outer Ring */}
        <SpinRing size={74} color={colors.primary} reverse={false} duration={1200} thickness={3} />
        {/* Inner Ring */}
        <SpinRing size={60} color={colors.secondary || colors.primary} reverse={true} duration={1800} thickness={3} />
        {/* Pulsing Center Icon */}
        <PulsingIcon color={colors.primary} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9000,
    elevation: 9000,
  },
  card: {
    width: 100,
    height: 100,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
});
