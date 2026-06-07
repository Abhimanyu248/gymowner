import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { radius, shadows, spacing } from '../theme/theme';
import StatusBadge from './StatusBadge';
import { useThemeColors } from '../theme/palette';

export default function MemberCard({ member, onPress }) {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const initials = member.name
    ? member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '??';

  const isExpired = new Date(member.expiryDate) < new Date();
  const status = isExpired ? 'expired' : (member.status || 'active');

  const daysLeft = Math.ceil(
    (new Date(member.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
  );
  const daysText = isExpired
    ? `Exp ${Math.abs(daysLeft)}d ago`
    : `${daysLeft}d left`;

  let accentColor = colors.success;
  if (isExpired) {
    accentColor = colors.danger;
  } else if (daysLeft <= 4) {
    accentColor = colors.warning;
  }


  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: `${accentColor}20` }]}
      onPress={() => onPress(member)}
      activeOpacity={0.75}
    >
      {/* Left accent strip */}
      <View style={[styles.strip, { backgroundColor: accentColor }]} />

      <View style={styles.content}>
        {/* Avatar */}
        {member.imageUrl || member.photo ? (
          <Image source={{ uri: member.imageUrl || member.photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: `${colors.primary}30` }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name}>{member.name}</Text>
          <Text style={styles.phone}>{member.phone || 'No phone'}</Text>
          <Text style={[styles.plan, { color: colors.accent }]}>
            {member.planId?.name || (typeof member.planId === 'string' && member.planId ? 'Plan' : 'No Plan')}
          </Text>
        </View>

        {/* Right side */}
        <View style={styles.right}>
          <StatusBadge status={status} expiryDate={member.expiryDate} />
          <View style={[styles.daysBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}35` }]}>
            <Text style={[styles.daysText, { color: accentColor }]}>{daysText}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadows.sm,
  },
  strip: {
    width: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    marginRight: spacing.md,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '800',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  phone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 3,
  },
  plan: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  daysBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    marginTop: 4,
  },
  daysText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
