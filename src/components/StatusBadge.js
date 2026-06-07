import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius } from '../theme/theme';
import { useThemeColors } from '../theme/palette';

export default function StatusBadge({ status, expiryDate }) {
  const colors = useThemeColors();
  const styles = getStyles();
  let finalStatus = status ? status.toLowerCase() : 'unknown';

  if (expiryDate) {
    const daysLeft = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 4) {
      finalStatus = 'active';
    } else if (daysLeft >= 1 && daysLeft <= 4) {
      finalStatus = 'expire soon';
    } else {
      finalStatus = 'expired';
    }
  }

  let bgColor   = `${colors.textMuted}22`;
  let textColor = colors.textMuted;
  let dot       = colors.textMuted;

  if (finalStatus === 'active') {
    bgColor   = `${colors.success}22`;
    textColor = colors.success;
    dot       = colors.success;
  } else if (finalStatus === 'expired') {
    bgColor   = `${colors.danger}22`;
    textColor = colors.danger;
    dot       = colors.danger;
  } else if (finalStatus === 'suspended' || finalStatus === 'expire soon') {
    bgColor   = `${colors.warning}22`;
    textColor = colors.warning;
    dot       = colors.warning;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor: `${textColor}40` }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.text, { color: textColor }]}>
        {finalStatus.toUpperCase()}
      </Text>
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
