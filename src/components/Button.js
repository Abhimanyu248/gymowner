import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { radius, spacing, shadows, typography } from '../theme/theme';
import { useThemeColors } from '../theme/palette';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style
}) {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const isPrimary   = variant === 'primary';
  const isDanger    = variant === 'danger';
  const isSecondary = variant === 'secondary';

  let bgColor    = colors.primary;
  let textColor  = colors.textInverted;
  let borderColor = 'transparent';
  let extraShadow = isPrimary ? shadows.glow : {};

  if (isDanger) {
    bgColor = colors.danger;
    textColor = '#FFFFFF';
    extraShadow = {};
  } else if (isSecondary) {
    bgColor = 'transparent';
    textColor = colors.textPrimary;
    borderColor = colors.border;
    extraShadow = {};
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: bgColor, borderColor, borderWidth: isSecondary ? 1 : 0 },
        extraShadow,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const getStyles = (colors) => StyleSheet.create({
  button: {
    height: 50,
    borderRadius: radius.btn,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
  },
  text: {
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.45,
  },
});
