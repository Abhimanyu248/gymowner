import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { useAppStore } from '../store/useAppStore';

const AUTO_BACKUP_META_KEY = 'automatic_backup_metadata';
const BACKUP_INTERVAL_MS = 168 * 60 * 60 * 1000; // 1 Week

export class AutoBackupManager {
  static async runAutomaticBackup() {
    try {
      const now = Date.now();

      // 1. Retrieve auto-backup metadata (last run time & last file URI)
      const metaRaw = await AsyncStorage.getItem(AUTO_BACKUP_META_KEY);
      let metadata = metaRaw ? JSON.parse(metaRaw) : { lastBackupTimestamp: 0, lastBackupFileUri: null };

      // 2. Check condition: Ensure 1 week have passed
      if (now - metadata.lastBackupTimestamp < BACKUP_INTERVAL_MS) {
        return;
      }

      // 3. Retrieve current state data
      const { plans, members, deletedMembers, payments, user } = useAppStore.getState();
      const totalMembers = members.length + (deletedMembers?.length || 0);
      if (plans.length === 0 || totalMembers === 0 || payments.length === 0) {
        return;
      }

      // 4. Construct JSON payload
      const backupData = {
        version: '2.0.0',
        format: 'auto_backup',
        timestamp: new Date().toISOString(),
        userEmail: user?.email,
        data: {
          plans,
          members: [...members, ...(deletedMembers || [])],
          payments,
        },
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const fileName = `GymApp_AutoBackup_${new Date().toISOString().split('T')[0]}.json`;
      const mimeType = 'application/json';

      let newFileUri = null;

      // 5. Save the file
      if (Platform.OS === 'android') {
        const { StorageAccessFramework } = FileSystem;
        const savedDirectoryUri = await AsyncStorage.getItem('backupDirectoryUri');

        if (savedDirectoryUri) {
          try {
            // Create a new backup file in the user-selected folder
            newFileUri = await StorageAccessFramework.createFileAsync(
              savedDirectoryUri,
              fileName,
              mimeType
            );
            await FileSystem.writeAsStringAsync(newFileUri, jsonString);
          } catch (writeErr) {
          }
        }
      }

      // Fallback for iOS or if Android directory URI is not yet selected/accessible
      if (!newFileUri) {
        const backupFolder = `${FileSystem.documentDirectory}automatic_backups/`;
        const folderInfo = await FileSystem.getInfoAsync(backupFolder);
        if (!folderInfo.exists) {
          await FileSystem.makeDirectoryAsync(backupFolder, { intermediates: true });
        }
        newFileUri = `${backupFolder}${fileName}`;
        await FileSystem.writeAsStringAsync(newFileUri, jsonString);
      }

      // 6. Delete the previous automatic backup file to prevent directory clutter
      if (metadata.lastBackupFileUri && metadata.lastBackupFileUri !== newFileUri) {
        try {
          if (Platform.OS === 'android' && metadata.lastBackupFileUri.startsWith('content://')) {
            // Delete from Android shared folder using SAF
            await FileSystem.StorageAccessFramework.deleteAsync(metadata.lastBackupFileUri);
          } else {
            // Delete from iOS/Android sandbox
            const fileInfo = await FileSystem.getInfoAsync(metadata.lastBackupFileUri);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(metadata.lastBackupFileUri, { idempotent: true });
            }
          }
        } catch (deleteErr) {
        }
      }

      // 7. Save new metadata
      const newMetadata = {
        lastBackupTimestamp: now,
        lastBackupFileUri: newFileUri,
      };
      await AsyncStorage.setItem(AUTO_BACKUP_META_KEY, JSON.stringify(newMetadata));

    } catch (err) {
    }
  }
}
