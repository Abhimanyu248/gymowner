import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useThemeColors } from '../theme/palette';
import { radius, spacing, typography } from '../theme/theme';
import { formatDateLabel } from '../utils/memberUtils';

export default function RenewMembershipSection({
  member,
  membershipTypes,
  renewError,
  renewForm,
  onBack,
  onChange,
  onDatePress,
  onSave,
}) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View style={styles.panel}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
        <ChevronLeft color={colors.textPrimary} size={18} />
        <Text style={styles.backButtonText}>Back to Member</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Renew Membership</Text>
      <Text style={styles.subtitle}>Choose a new plan and joining date for {member.name}.</Text>

      <Text style={styles.fieldLabel}>Select Plan</Text>
      <View style={styles.membershipRow}>
        {membershipTypes.map((type) => {
          const active = renewForm.membershipType === type.name;
          return (
            <TouchableOpacity
              key={type.id || type._id || type.name}
              style={[styles.membershipChip, active && styles.membershipChipActive]}
              onPress={() => onChange('membershipType', type.name)}
              activeOpacity={0.85}
            >
              <Text style={[styles.membershipChipText, active && styles.membershipChipTextActive]}>{type.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.dateInput} onPress={onDatePress} activeOpacity={0.85}>
        <Text style={styles.dateInputLabel}>New Joining Date</Text>
        <Text style={[styles.dateInputValue, !renewForm.joinDate && styles.dateInputPlaceholder]}>
          {formatDateLabel(renewForm.joinDate)}
        </Text>
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>Payment Method</Text>
      <View style={styles.membershipRow}>
        {['cash', 'card', 'upi'].map((method) => {
          const active = renewForm.paymentMethod === method;
          return (
            <TouchableOpacity
              key={method}
              style={[styles.membershipChip, active && styles.membershipChipActive]}
              onPress={() => onChange('paymentMethod', method)}
              activeOpacity={0.85}
            >
              <Text style={[styles.membershipChipText, active && styles.membershipChipTextActive]}>
                {method.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {renewError ? <Text style={styles.errorText}>{renewError}</Text> : null}

      <TouchableOpacity style={styles.buttonPrimary} onPress={onSave} activeOpacity={0.9}>
        <Text style={styles.buttonText}>Confirm Renewal</Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    panel: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.md,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingRight: 8,
    },
    backButtonText: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
    sectionTitle: {
      ...typography.heading,
      color: colors.textPrimary,
      fontSize: 23,
      marginBottom: 4,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: spacing.md,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: spacing.sm,
    },
    membershipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    membershipChip: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 9,
      paddingHorizontal: 14,
    },
    membershipChipActive: {
      backgroundColor: `${colors.accent}22`,
      borderColor: colors.accent,
    },
    membershipChipText: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 13,
    },
    membershipChipTextActive: {
      color: colors.accent,
      fontWeight: '700',
    },
    dateInput: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    dateInputLabel: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 4,
    },
    dateInputValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    dateInputPlaceholder: {
      color: colors.textMuted,
      fontWeight: '500',
    },
    errorText: {
      color: colors.danger,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      textAlign: 'center',
      fontWeight: '600',
    },
    buttonPrimary: {
      marginTop: spacing.md,
      backgroundColor: colors.accent,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      height: 50,
    },
    buttonText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 16,
    },
  });

