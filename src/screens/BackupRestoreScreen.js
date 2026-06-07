import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store/useAppStore';
import CustomAlert from '../components/CustomAlert';
import { radius, spacing, typography } from '../theme/theme';
import { useThemeColors } from '../theme/palette';
import { Download, Upload, ShieldCheck, Database, FolderEdit } from 'lucide-react-native';
import { api } from '../utils/api';

export default function BackupRestoreScreen() {
  const { members, plans, payments, user, fetchAppData } = useAppStore();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [alertConfig, setAlertConfig] = useState({ visible: false });

  const showAlert = (title, message, buttons = [{ text: 'OK' }], type = 'info') => {
    setAlertConfig({ visible: true, title, message, buttons, type });
  };

  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const openFile = async (fileUri, mimeType) => {
    try {
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
          type: mimeType,
        });
      } else {
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: 'Open File',
        });
      }
    } catch (err) {
      console.warn('Failed to open file directly:', err);
      try {
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: 'Open File',
        });
      } catch (shareErr) {
        showAlert('Error', 'Could not open or share file: ' + shareErr.message, [{ text: 'OK' }], 'error');
      }
    }
  };

  const handleChangeBackupDirectory = async () => {
    if (Platform.OS !== 'android') {
      showAlert(
        'Not Supported',
        'Custom folder selection is only supported on Android. On iOS, you can select folder paths directly via the native Save to Files share sheet.',
        [{ text: 'OK' }],
        'info'
      );
      return;
    }

    try {
      const { StorageAccessFramework } = FileSystem;
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        await AsyncStorage.setItem('backupDirectoryUri', permissions.directoryUri);
        showAlert('Folder Updated', 'Backup folder path successfully changed!', [{ text: 'OK' }], 'success');
      }
    } catch (err) {
      showAlert('Error', 'Failed to change folder path: ' + err.message, [{ text: 'OK' }], 'error');
    }
  };

  // ── BACKUP (JSON Format) ──────────────────────────────────────────────
  const handleBackup = async () => {
    if(plans.length === 0 || members.length === 0 || payments.length === 0){
      showAlert('No Data', 'Please add some data (plans, members, payments) before creating a backup.', [{ text: 'OK' }], 'warning');
      return;
    }
    setLoading(true);
    setLoadingText('Preparing backup data...');
    try {
      // Create the JSON data payload
      const backupData = {
        version: '2.0.0',
        format: 'json_backup',
        timestamp: new Date().toISOString(),
        userEmail: user?.email,
        data: {
          plans,
          members,
          payments,
        },
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const fileName = `GymApp_Backup_${new Date().toISOString().split('T')[0]}.json`;
      const mimeType = 'application/json';

      if (Platform.OS === 'android') {
        const { StorageAccessFramework } = FileSystem;
        let directoryUri = await AsyncStorage.getItem('backupDirectoryUri');

        if (!directoryUri) {
          // First time: request directory selection to let user choose path
          setLoadingText('Selecting backup folder...');
          const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            setLoading(false);
            showAlert('Permission Denied', 'You must choose a folder to save the backup.', [{ text: 'OK' }], 'warning');
            return;
          }
          directoryUri = permissions.directoryUri;
          await AsyncStorage.setItem('backupDirectoryUri', directoryUri);
        }

        // Cache the file locally to allow opening/viewing it
        const cacheFileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(cacheFileUri, jsonString);

        const openButtons = [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Open File',
            onPress: async () => {
              await openFile(cacheFileUri, mimeType);
            }
          }
        ];

        setLoadingText('Saving backup to folder...');
        try {
          // Create the file in the selected directory path
          const fileUri = await StorageAccessFramework.createFileAsync(
            directoryUri,
            fileName,
            mimeType
          );

          // Write json string to it
          await FileSystem.writeAsStringAsync(fileUri, jsonString);

          showAlert(
            'Backup Created',
            `Backup successfully saved as "${fileName}" in your selected folder.\nSaved: ${members.length} members, ${plans.length} plans, and ${payments.length} payments.`,
            openButtons,
            'download'
          );
        } catch (writeErr) {
          // If write fails (e.g. permission was revoked or folder deleted), clear stored path and re-ask
          await AsyncStorage.removeItem('backupDirectoryUri');
          
          const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            setLoading(false);
            showAlert('Permission Denied', 'You must choose a folder to save the backup.', [{ text: 'OK' }], 'warning');
            return;
          }
          directoryUri = permissions.directoryUri;
          await AsyncStorage.setItem('backupDirectoryUri', directoryUri);

          const fileUri = await StorageAccessFramework.createFileAsync(
            directoryUri,
            fileName,
            mimeType
          );

          await FileSystem.writeAsStringAsync(fileUri, jsonString);

          showAlert(
            'Backup Created',
            `Backup successfully saved as "${fileName}" in your selected folder.\nSaved: ${members.length} members, ${plans.length} plans, and ${payments.length} payments.`,
            openButtons,
            'download'
          );
        }
      } else {
        // iOS or other platforms: Use standard sharing options (Save to Files)
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonString);

        setLoadingText('Sharing backup...');
        const canShare = await Sharing.isAvailableAsync();
        
        const openButtons = [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Open File',
            onPress: async () => {
              await openFile(fileUri, mimeType);
            }
          }
        ];

        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType,
            dialogTitle: 'Save Backup',
            UTI: 'public.json',
          });
          showAlert(
            'Backup Created',
            `Backup saved with ${members.length} members, ${plans.length} plans, and ${payments.length} payments.`,
            openButtons,
            'success'
          );
        } else {
          showAlert('Error', 'Sharing is not available on this device.', [{ text: 'OK' }], 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showAlert('Backup Failed', err.message, [{ text: 'OK' }], 'error');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  // ── RESTORE (JSON Format) ───────────────────────────────────────────
  const handleRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;

      setLoading(true);
      setLoadingText('Reading backup...');

      const content = await FileSystem.readAsStringAsync(fileUri);
      const backupData = JSON.parse(content);

      setLoading(false);
      setLoadingText('');

      if (!backupData.data || !backupData.data.plans || !backupData.data.members) {
        showAlert('Restore Failed', 'Invalid backup file format. Missing plans or members data.', [{ text: 'OK' }], 'error');
        return;
      }

      if (backupData.userEmail && backupData.userEmail.toLowerCase() !== user?.email?.toLowerCase()) {
        showAlert('Restore Failed', 'This backup file belongs to another account. You can only restore backups created by your own account.', [{ text: 'OK' }], 'error');
        return;
      }

      const plansCount = backupData.data.plans.length;
      const membersCount = backupData.data.members.length;
      const paymentsCount = backupData.data.payments?.length || 0;

      showAlert(
        'Confirm Restore',
        `Backup contains:\n• ${plansCount} Plans\n• ${membersCount} Members\n• ${paymentsCount} Payments\n\nRestore now? This will append data to your current records.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore Now', onPress: () => performRestore(backupData.data) },
        ],
        'warning'
      );
    } catch (err) {
      console.error(err);
      setLoading(false);
      setLoadingText('');
      showAlert('Restore Failed', err.message || 'Could not read the backup file.', [{ text: 'OK' }], 'error');
    }
  };

  /**
   * Performs restore for JSON backups.
   */
  const performRestore = async (data) => {
    setLoading(true);
    setLoadingText('Uploading backup to server...');
    try {
      const response = await api.restoreBackup(data);
      await fetchAppData();

      const { restoredPlans, restoredMembers,restoredPayments, skippedCount } = response.summary || {};

      showAlert(
        'Success',
        `Data restoration completed.\n\n• Plans Restored: ${restoredPlans}\n• Members Restored: ${restoredMembers}\n• Payments Restored: ${restoredPayments}\n• Skipped (Duplicates): ${skippedCount}`,
        [{ text: 'OK' }],
        'success'
      );
    } catch (err) {
      console.error(err);
      showAlert('Restore Error', err.message || 'Failed to restore data', [{ text: 'OK' }], 'error');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {Platform.OS === 'android' && (
          <TouchableOpacity 
            style={styles.changeDirBtn} 
            onPress={handleChangeBackupDirectory}
            activeOpacity={0.7}
          >
            <FolderEdit size={20} color={colors.accent} />
          </TouchableOpacity>
        )}
        <ShieldCheck size={48} color={colors.accent} />
        <Text style={styles.title}>Data Backup & Restore</Text>
        <Text style={styles.subtitle}>Protect your gym records with a secure backup file.</Text>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Database size={20} color={colors.textSecondary} />
          <Text style={styles.statLabel}>Current Data:</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statText}>{members.length} Members</Text>
          <Text style={styles.statText}>{plans.length} Plans</Text>
          <Text style={styles.statText}>{payments.length} Payments</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.actionCard} onPress={handleBackup} disabled={loading}>
        <View style={[styles.iconBox, { backgroundColor: `${colors.accent}15` }]}>
          <Download color={colors.accent} size={24} />
        </View>
        <View style={styles.actionInfo}>
          <Text style={styles.actionTitle}>Backup to Device</Text>
          <Text style={styles.actionDesc}>Export all data as a .json backup file.</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={handleRestore} disabled={loading}>
        <View style={[styles.iconBox, { backgroundColor: `${colors.secondary}15` }]}>
          <Upload color={colors.secondary} size={24} />
        </View>
        <View style={styles.actionInfo}>
          <Text style={styles.actionTitle}>Restore from Backup</Text>
          <Text style={styles.actionDesc}>Import data from a .json backup file.</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Note: Restoring data will append records to your current database. Duplicate members (same phone) will be skipped.
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingMsg}>{loadingText}</Text>
        </View>
      )}

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
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
    position: 'relative',
    width: '100%',
  },
  changeDirBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    ...typography.heading,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  statsCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.card,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.label,
    marginLeft: spacing.xs,
    color: colors.textSecondary,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  actionCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.card,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  actionTitle: {
    ...typography.heading,
    fontSize: 16,
    color: colors.textPrimary,
  },
  actionDesc: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  warningBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: `${colors.warning}10`,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  warningText: {
    ...typography.body,
    fontSize: 12,
    color: colors.warning,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingMsg: {
    color: '#fff',
    marginTop: spacing.md,
    fontWeight: '600',
  },
});
