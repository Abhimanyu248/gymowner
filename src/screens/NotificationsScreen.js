import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import Button from '../components/Button';
import CustomAlert from '../components/CustomAlert';
import { radius, spacing, typography } from '../theme/theme';
import { useThemeColors } from '../theme/palette';
import { Bell, Send, Clock, Users } from 'lucide-react-native';

export default function NotificationsScreen() {
  const { sendBroadcast, triggerRenewals } = useAppStore();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [targetStatus, setTargetStatus] = useState('active');
  const [loadingBroadcast, setLoadingBroadcast] = useState(false);
  
  const [renewalDays, setRenewalDays] = useState('7');
  const [loadingRenewal, setLoadingRenewal] = useState(false);

  const [alertConfig, setAlertConfig] = useState({ visible: false });

  const showAlert = (title, message, type = 'info') => {
    setAlertConfig({ visible: true, title, message, buttons: [{ text: 'OK' }], type });
  };

  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const handleSendBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) {
      showAlert('Error', 'Title and message are required', 'error');
      return;
    }
    
    setLoadingBroadcast(true);
    try {
      const res = await sendBroadcast({
        title: broadcastTitle,
        message: broadcastMessage,
        targetStatus,
      });
      showAlert('Success', res?.message || 'Broadcast sent successfully', 'success');
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err) {
      showAlert('Error', err.message || 'Failed to send broadcast', 'error');
    } finally {
      setLoadingBroadcast(false);
    }
  };

  const handleTriggerRenewals = async () => {
    const days = parseInt(renewalDays, 10);
    if (isNaN(days) || days < 0) {
      showAlert('Error', 'Please enter a valid number of days', 'error');
      return;
    }

    setLoadingRenewal(true);
    try {
      const res = await triggerRenewals(days);
      showAlert('Success', res?.message || 'Renewal reminders sent successfully', 'success');
    } catch (err) {
      showAlert('Error', err.message || 'Failed to trigger renewals', 'error');
    } finally {
      setLoadingRenewal(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
      
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.accent}15` }]}>
          <Bell color={colors.accent} size={28} />
        </View>
        <Text style={styles.title}>SMS Notifications</Text>
        <Text style={styles.subtitle}>Automated via Twilio Integration</Text>
      </View>

      {/* Broadcast Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Send color={colors.accent} size={20} />
          <Text style={styles.cardTitle}>Send Broadcast / Offer</Text>
        </View>
        <Text style={styles.cardDesc}>Send a custom SMS to multiple members simultaneously.</Text>
        
        <Text style={styles.label}>Audience</Text>
        <View style={styles.statusChips}>
          {['all', 'active', 'expired'].map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.chip, targetStatus === status && styles.chipActive]}
              onPress={() => setTargetStatus(status)}
            >
              <Text style={[styles.chipText, targetStatus === status && styles.chipTextActive]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Title (Prefix)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. HOLIDAY NOTICE"
          placeholderTextColor={colors.textMuted}
          value={broadcastTitle}
          onChangeText={setBroadcastTitle}
        />

        <Text style={styles.label}>Message Body</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Type your message here..."
          placeholderTextColor={colors.textMuted}
          value={broadcastMessage}
          onChangeText={setBroadcastMessage}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Button 
          title="Send Broadcast SMS" 
          onPress={handleSendBroadcast} 
          loading={loadingBroadcast}
          style={styles.btn}
        />
      </View>

      {/* Renewals Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Clock color={colors.warning} size={20} />
          <Text style={styles.cardTitle}>Manual Renewal Reminders</Text>
        </View>
        <Text style={styles.cardDesc}>
          The system automatically sends renewal reminders (4 days before expiry) and expiry notifications (on the day of expiry) daily at 9 AM. You can also manually trigger reminders for a custom range.
        </Text>
        
        <Text style={styles.label}>Days until expiry</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 7"
          placeholderTextColor={colors.textMuted}
          value={renewalDays}
          onChangeText={setRenewalDays}
          keyboardType="numeric"
        />

        <Button 
          title="Trigger Reminders Now" 
          onPress={handleTriggerRenewals} 
          loading={loadingRenewal}
          style={[styles.btn, { backgroundColor: colors.warning }]}
        />
      </View>

      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onClose={hideAlert}
      />
    </ScrollView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
    fontSize: typography.sizes.xl,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colors.background === '#141A22' ? 0.2 : 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.heading,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
  },
  cardDesc: {
    ...typography.body,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  label: {
    ...typography.body,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  textArea: {
    height: 100,
    paddingTop: spacing.md,
  },
  statusChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: `${colors.accent}15`,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  btn: {
    marginTop: spacing.sm,
  }
});
