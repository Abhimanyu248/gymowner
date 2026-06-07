import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, shadows, spacing } from '../theme/theme';
import { useThemeColors } from '../theme/palette';

export default function MetricCard({ title, value, icon, color }) {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const metricColor = color || colors.accent;
  return (
    <View style={[styles.card, { borderColor: `${metricColor}25` }]}>
      {/* Top coloured accent bar */}
      <View style={[styles.accentBar, { backgroundColor: metricColor }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {icon && (
            <View style={[styles.iconContainer, { backgroundColor: `${metricColor}18` }]}>
              {icon}
            </View>
          )}
        </View>
        <Text style={[styles.value, { color: metricColor }]}>{value}</Text>
      </View>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    flex: 1,
    margin: spacing.xs,
    overflow: 'hidden',
    borderWidth: 1,
    ...shadows.sm,
  },
  accentBar: {
    height: 3,
    borderRadius: 2,
  },
  body: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontWeight: '800',
    fontSize: 24,
    letterSpacing: -0.5,
  },
});
