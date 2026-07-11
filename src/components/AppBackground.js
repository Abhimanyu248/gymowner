import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../theme/palette';

/**
 * A beautiful, hardware-accelerated linear gradient background component
 * designed specifically to match both light and dark themes of GymPro.
 * It features soft ambient glow accents in the corners for a premium feel.
 */
export default function AppBackground({ children, style }) {
  const colors = useThemeColors();
  
  // Check if we are in dark mode (background is '#141A22')
  const isDark = colors.background === '#141A22';

  // Base background gradients:
  // - Light: Soft Sage Green tint (#EBF2ED) to Warm Sand/Beige (#F4EFE7)
  // - Dark: Cyber Slate Gray (#1B232D) to Deep Charcoal (#12171E)
  const gradientColors = isDark
    ? ['#1B232D', '#12171E']
    : ['#EBF2ED', '#F4EFE7'];

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={[styles.container, style]}
    >
      {/* Top-Right Ambient Glow Bubble
          - Light: Muted Dark Green (#1F3C34) at ultra-low opacity (2%)
          - Dark: Vibrant Cyber Green (#00D26A) at low opacity (5%) */}
      <View
        style={[
          styles.glowBubble,
          styles.topBubble,
          { backgroundColor: isDark ? '#00D26A' : '#1F3C34', opacity: isDark ? 0.05 : 0.025 },
        ]}
      />

      {/* Bottom-Left Ambient Glow Bubble
          - Light: Burnt Orange/Rust (#D17934) at ultra-low opacity (2%)
          - Dark: Vibrant Yellow/Gold (#EAB308) at low opacity (4%) */}
      <View
        style={[
          styles.glowBubble,
          styles.bottomBubble,
          { backgroundColor: isDark ? '#EAB308' : '#D17934', opacity: isDark ? 0.04 : 0.02 },
        ]}
      />

      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowBubble: {
    position: 'absolute',
    borderRadius: 200,
    width: 320,
    height: 320,
    pointerEvents: 'none', // Ensures bubbles do not capture user interactions
  },
  topBubble: {
    top: -100,
    right: -100,
  },
  bottomBubble: {
    bottom: -120,
    left: -100,
  },
});
