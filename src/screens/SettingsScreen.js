import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, ActivityIndicator,
  Animated, PanResponder, TextInput, Platform, Image
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAppStore } from '../store/useAppStore';
import { useThemeColors } from '../theme/palette';
import Button from '../components/Button';
import { colors, radius, spacing, typography } from '../theme/theme';
import { api } from '../utils/api';
import CustomAlert from '../components/CustomAlert';
import { FolderEdit } from 'lucide-react-native';

export default function SettingsScreen({ navigation }) {
  const { user, logout, themeMode, setThemeMode, isLoadingData, fetchAppData } = useAppStore();
  const isDark = themeMode === 'dark';
  const themeColors = useThemeColors();

  // Extend the canonical theme tokens with a few modal-specific extras
  const palette = {
    ...themeColors,
    surfaceElevated: themeColors.surfaceAlt,
    modalBg: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)',
    checkboxBg: themeColors.surfaceAlt,
  };
  const styles = getStyles(palette, isDark);

  // ── Download modal state ────────────────────────────────────────────────
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [includeMembers, setIncludeMembers] = useState(true);
  const [includeTransactions, setIncludeTransactions] = useState(true);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [isDownloading, setIsDownloading] = useState(false);

  // ── Edit Profile states ────────────────────────────────────────────────
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    image: '',
    address: '',
    gstNumber: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [alertConfig, setAlertConfig] = useState({ visible: false });

  const showAlert = (title, message, type, buttons = null) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK', style: 'default', onPress: () => setAlertConfig({ visible: false }) }]
    });
  };

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
        showAlert('Error', 'Could not open or share file: ' + shareErr.message, 'error');
      }
    }
  };

  // ── Slide-down gesture ─────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(600)).current;

  // Animate in when modal opens
  useEffect(() => {
    if (showDownloadModal) {
      slideAnim.setValue(600);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 5,
        speed: 14,
      }).start();
    }
  }, [showDownloadModal]);

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(600);
      setShowDownloadModal(false);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 4,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) slideAnim.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          closeModal();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;


  const handleLogout = () => {
    setAlertConfig({
      visible: true,
      title: 'Confirm Logout',
      message: 'Are you sure you want to log out?',
      type: 'warning',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setAlertConfig({ visible: false }),
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            setAlertConfig({ visible: false });
            logout();
          },
        },
      ],
    });
  };

  const pickProfileImage = () => {
    setAlertConfig({
      visible: true,
      title: 'Select Logo',
      message: 'Choose an option',
      type: 'action',
      buttons: [
        {
          text: 'Take Photo',
          onPress: async () => {
            setAlertConfig({ visible: false });
            const { granted } = await ImagePicker.requestCameraPermissionsAsync();
            if (!granted) {
              showAlert('Permission Denied', 'Camera permission is required!', 'warning');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.5,
            });
            if (!result.canceled && result.assets.length > 0) {
              setProfileForm(prev => ({ ...prev, image: result.assets[0].uri }));
            }
          }
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            setAlertConfig({ visible: false });
            const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!granted) {
              showAlert('Permission Denied', 'Media library permission is required!', 'warning');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.5,
            });
            if (!result.canceled && result.assets.length > 0) {
              setProfileForm(prev => ({ ...prev, image: result.assets[0].uri }));
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setAlertConfig({ visible: false })
        }
      ]
    });
  };

  const handleUpdateProfile = async () => {
    if (!profileForm.name.trim()) {
      showAlert('Error', 'Name is required.', 'error');
      return;
    }
    setIsUpdating(true);
    try {
      let uploadedImageUrl = profileForm.image;

      // Upload if it's a local URI
      if (profileForm.image && (profileForm.image.startsWith('file://') || profileForm.image.startsWith('content://') || profileForm.image.startsWith('ph://'))) {
        try {
          const compressedUri = await ImageManipulator.manipulateAsync(
            profileForm.image,
            [{ resize: { width: 500, height: 500 } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          ).then(res => res.uri).catch(() => profileForm.image);

          const uploadRes = await api.uploadImage(compressedUri);
          uploadedImageUrl = uploadRes.publicUrl;
        } catch (uploadErr) {
          console.warn('Failed to upload logo image:', uploadErr);
        }
      }

      const updatedUser = await api.updateProfile({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        image: uploadedImageUrl,
        address: profileForm.address.trim(),
        gstNumber: profileForm.gstNumber.trim(),
      });

      useAppStore.setState({ user: updatedUser });
      await api.setStoredUser(updatedUser);
      setShowEditProfileModal(false);
      showAlert('Success', 'Profile details updated.', 'success');
    } catch (err) {
      showAlert('Error', err.message || 'Failed to update profile', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert('Error', 'Please fill in all fields.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Error', 'New passwords do not match.', 'error');
      return;
    }
    setIsUpdating(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showAlert('Success', ' password changed successfully.', 'password');
    } catch (err) {
      showAlert('Error', err.message || 'Failed to change password', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangeExportDirectory = async () => {
    if (Platform.OS !== 'android') {
      showAlert('Not Supported', 'Custom folder selection is only supported on Android. On iOS, you can select folder paths directly via the native Save to Files share sheet.', 'info');
      return;
    }

    try {
      const { StorageAccessFramework } = FileSystem;
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        await AsyncStorage.setItem('exportDirectoryUri', permissions.directoryUri);
        showAlert('Folder Updated', 'Export folder path successfully changed!', 'success');
      }
    } catch (err) {
      showAlert('Error', 'Failed to change folder path: ' + err.message, 'error');
    }
  };

  // ── Download handler ───────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!includeMembers && !includeTransactions) {
      showAlert('Select Data', 'Please select at least one type.', 'warning');
      return;
    }

    setIsDownloading(true);
    try {
      const base64Data = await api.downloadReport({ 
        includeMembers, 
        includeTransactions,
        format: downloadFormat 
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      const ext = downloadFormat === 'excel' ? 'xlsx' : 'pdf';
      const filename = `gym_report_${timestamp}.${ext}`;
      const mimeType = downloadFormat === 'excel' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        : 'application/pdf';

      if (Platform.OS === 'android') {
        const { StorageAccessFramework } = FileSystem;
        let directoryUri = await AsyncStorage.getItem('exportDirectoryUri');

        if (!directoryUri) {
          // First time: request directory selection to let user choose path
          const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            setIsDownloading(false);
            showAlert('Permission Denied', 'You must choose a folder to save the report.', 'warning');
            return;
          }
          directoryUri = permissions.directoryUri;
          await AsyncStorage.setItem('exportDirectoryUri', directoryUri);
        }

        // Cache the file locally to allow opening/viewing it
        const cacheFileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(cacheFileUri, base64Data, {
          encoding: 'base64',
        });

        const openButtons = [
          { text: 'OK', style: 'cancel', onPress: () => setAlertConfig({ visible: false }) },
          {
            text: 'Open File',
            style: 'default',
            onPress: async () => {
              setAlertConfig({ visible: false });
              await openFile(cacheFileUri, mimeType);
            },
          },
        ];

        try {
          // Create the file in the selected directory path
          const fileUri = await StorageAccessFramework.createFileAsync(
            directoryUri,
            filename,
            mimeType
          );

          // Write base64 data to it
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: 'base64',
          });

          setShowDownloadModal(false);
          showAlert(
            'Download Complete',
            `Report successfully saved as ${filename} in your selected folder.`,
            'download',
            openButtons
          );
        } catch (writeErr) {
          // If write fails (e.g. permission was revoked or folder deleted), clear stored path and re-ask
          await AsyncStorage.removeItem('exportDirectoryUri');
          
          const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            setIsDownloading(false);
            showAlert('Permission Denied', 'You must choose a folder to save the report.', 'warning');
            return;
          }
          directoryUri = permissions.directoryUri;
          await AsyncStorage.setItem('exportDirectoryUri', directoryUri);

          const fileUri = await StorageAccessFramework.createFileAsync(
            directoryUri,
            filename,
            mimeType
          );

          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: 'base64',
          });

          setShowDownloadModal(false);
          showAlert(
            'Download Complete',
            `Report successfully saved as ${filename} in your selected folder.`,
            'download',
            openButtons
          );
        }
      } else {
        // iOS or other platforms: Use standard sharing options (Save to Files)
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: 'base64',
        });

        setShowDownloadModal(false);

        const canShare = await Sharing.isAvailableAsync();
        const UTI = downloadFormat === 'excel' ? 'com.microsoft.excel.xls' : 'com.adobe.pdf';
        
        const openButtons = [
          { text: 'OK', style: 'cancel', onPress: () => setAlertConfig({ visible: false }) },
          {
            text: 'Open File',
            style: 'default',
            onPress: async () => {
              setAlertConfig({ visible: false });
              await openFile(fileUri, mimeType);
            },
          },
        ];

        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType,
            dialogTitle: 'Save or Share Report',
            UTI,
          });
          showAlert(
            'Download Complete',
            `Report successfully exported.`,
            'download',
            openButtons
          );
        } else {
          showAlert('Downloaded', `Report saved to:\n${fileUri}`, 'download', openButtons);
        }
      }
    } catch (err) {
      showAlert('Download Failed', err.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Checkbox component ─────────────────────────────────────────────────
  const Checkbox = ({ label, checked, onToggle, description }) => (
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkboxLabel}>{label}</Text>
        {description ? (
          <Text style={styles.checkboxDescription}>{description}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const SettingRow = ({ title, value }) => (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetchAppData} tintColor={palette.success} />}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              {user?.image ? (
                <Image source={{ uri: user.image }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.profileAvatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                </Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name?.toUpperCase() || 'Admin'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'admin@gym.com'}</Text>
              {user?.phone ? <Text style={styles.profileMetaText}>{user.phone}</Text> : null}
              {user?.gstNumber ? <Text style={styles.profileMetaText}>GSTIN: {user.gstNumber}</Text> : null}
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{(user?.role || 'admin').toUpperCase()}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.profileActions}>
            <TouchableOpacity 
              style={styles.profileActionBtn}
              onPress={() => {
                setProfileForm({
                  name: user?.name || '',
                  phone: user?.phone || '',
                  image: user?.image || '',
                  address: user?.address || '',
                  gstNumber: user?.gstNumber || '',
                });
                setShowEditProfileModal(true);
              }}
            >
              <Text style={styles.profileActionText}>Edit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.profileActionBtn, styles.profileActionBtnSecondary]}
              onPress={() => {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setShowPasswordModal(true);
              }}
            >
              <Text style={[styles.profileActionText, styles.profileActionTextSecondary]}>Change Password</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Admin Controls</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Plans')}>
            <Text style={styles.rowTitle}>Plans &amp; Pricing</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.rowTitle}>Notifications</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('BackupRestore')}>
            <Text style={styles.rowTitle}>Backup &amp; Restore</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 0 }]}
            onPress={() => setShowDownloadModal(true)}
          >
            <View style={styles.downloadRowLeft}>
              <Text style={styles.rowTitle}>Export Data</Text>
            </View>
            <View style={styles.pdfBadge}>
              <Text style={styles.pdfBadgeText}>PDF / XLS</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>System</Text>
        <View style={styles.card}>
          <SettingRow title="Version" value="1.0.0" />
          <View style={styles.themeRow}>
            <Text style={styles.rowTitle}>Theme</Text>
            <View style={styles.segmentedToggle}>
              <TouchableOpacity
                style={[styles.segmentButton, themeMode === 'light' && styles.segmentButtonActive]}
                onPress={() => setThemeMode('light')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    themeMode === 'light' && styles.segmentButtonTextActive,
                  ]}
                >
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, themeMode === 'dark' && styles.segmentButtonActive]}
                onPress={() => setThemeMode('dark')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    themeMode === 'dark' && styles.segmentButtonTextActive,
                  ]}
                >
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Button
          title="Logout"
          variant="danger"
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      </ScrollView>

      {/* ── Download Data Modal ─────────────────────────────────────────── */}
      <Modal
        visible={showDownloadModal}
        transparent
        animationType="none"
        onRequestClose={() => !isDownloading && closeModal()}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}
          >
            {/* Draggable handle bar */}
            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={styles.modalHandle} />
            </View>

            {/* Title */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.modalTitle}>Export Data</Text>
                  <Text style={styles.modalSubtitle}>Choose content and format for the report</Text>
                </View>
                {Platform.OS === 'android' && (
                  <TouchableOpacity 
                    style={styles.changeDirBtn} 
                    onPress={handleChangeExportDirectory}
                    activeOpacity={0.7}
                  >
                    <FolderEdit size={20} color={palette.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Format Toggle */}
            <View style={styles.formatToggleContainer}>
              <Text style={styles.formatLabel}>Format</Text>
              <View style={styles.segmentedToggle}>
                <TouchableOpacity
                  style={[styles.segmentButton, downloadFormat === 'pdf' && styles.segmentButtonActive]}
                  onPress={() => !isDownloading && setDownloadFormat('pdf')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentButtonText, downloadFormat === 'pdf' && styles.segmentButtonTextActive]}>
                    📄 PDF
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentButton, downloadFormat === 'excel' && styles.segmentButtonActive]}
                  onPress={() => !isDownloading && setDownloadFormat('excel')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentButtonText, downloadFormat === 'excel' && styles.segmentButtonTextActive]}>
                    📊 Excel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.modalDivider} />

            {/* Checkboxes */}
            <View style={styles.checkboxContainer}>
              <Checkbox
                label="Members"
                description="Name, phone, plan, join & expiry date, status"
                checked={includeMembers}
                onToggle={() => !isDownloading && setIncludeMembers((v) => !v)}
              />
              <Checkbox
                label="Transactions"
                description="Member, amount, method, date, notes"
                checked={includeTransactions}
                onToggle={() => !isDownloading && setIncludeTransactions((v) => !v)}
              />
            </View>

            {/* Divider */}
            <View style={styles.modalDivider} />

            {/* Info note */}
            <View style={styles.infoNote}>
              <Text style={styles.infoNoteText}>
                {downloadFormat === 'pdf' 
                  ? "📄 The report will be saved as a PDF file and opened with your device's share sheet."
                  : "📊 The report will be saved as an Excel spreadsheet and opened with your device's share sheet."}
              </Text>
            </View>

            {/* Action button */}
            {isDownloading ? (
              <View style={styles.downloadingRow}>
                <ActivityIndicator color={palette.accent} size="small" />
                <Text style={styles.downloadingText}>
                  Generating {downloadFormat === 'pdf' ? 'PDF' : 'Excel'}…
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.downloadBtn,
                  (!includeMembers && !includeTransactions) && styles.downloadBtnDisabled,
                ]}
                onPress={handleDownload}
                activeOpacity={0.8}
              >
                <Text style={styles.downloadBtnText}>
                  ⬇  Download {downloadFormat === 'pdf' ? 'PDF' : 'Excel'}
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* ── Edit Profile Modal ─────────────────────────────────────────── */}
      <Modal visible={showEditProfileModal} transparent animationType="fade" onRequestClose={() => !isUpdating && setShowEditProfileModal(false)}>
        <View style={styles.centeredModalOverlay}>
          <View style={[styles.centeredModalContent, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Edit Gym / Profile Details</Text>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
              
              {/* Profile/Logo Image picker */}
              <View style={{ alignItems: 'center', marginVertical: 16 }}>
                <TouchableOpacity onPress={pickProfileImage} style={styles.modalLogoPickerBtn}>
                  {profileForm.image ? (
                    <Image source={{ uri: profileForm.image }} style={{ width: '100%', height: '100%', borderRadius: 40 }} />
                  ) : (
                    <Text style={{ color: palette.accent, fontWeight: '600', fontSize: 13 }}>Add Logo</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Gym / Owner Name</Text>
              <TextInput
                style={[styles.input, { marginTop: 4 }]}
                value={profileForm.name}
                onChangeText={(val) => setProfileForm(p => ({ ...p, name: val }))}
                placeholder="Enter Gym/Owner Name"
                placeholderTextColor={palette.textMuted}
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Phone Number</Text>
              <TextInput
                style={[styles.input, { marginTop: 4 }]}
                value={profileForm.phone}
                onChangeText={(val) => setProfileForm(p => ({ ...p, phone: val }))}
                placeholder="Enter Contact Phone Number"
                keyboardType="phone-pad"
                placeholderTextColor={palette.textMuted}
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Address</Text>
              <TextInput
                style={[styles.input, { marginTop: 4 }]}
                value={profileForm.address}
                onChangeText={(val) => setProfileForm(p => ({ ...p, address: val }))}
                placeholder="Enter Gym Address"
                placeholderTextColor={palette.textMuted}
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>GST Number</Text>
              <TextInput
                style={[styles.input, { marginTop: 4 }]}
                value={profileForm.gstNumber}
                onChangeText={(val) => setProfileForm(p => ({ ...p, gstNumber: val }))}
                placeholder="Enter GST Number"
                autoCapitalize="characters"
                placeholderTextColor={palette.textMuted}
              />
            </ScrollView>

            <View style={styles.modalActionRow}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowEditProfileModal(false)} disabled={isUpdating} style={{flex: 1, marginRight: 8}} />
              <Button title="Save" onPress={handleUpdateProfile} loading={isUpdating} style={{flex: 1, marginLeft: 8}} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Change Password Modal ─────────────────────────────────────────── */}
      <Modal visible={showPasswordModal} transparent animationType="fade">
        <View style={styles.centeredModalOverlay}>
          <View style={styles.centeredModalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current Password"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
            />
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm New Password"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
            />
            {confirmPassword ? (
              <Text style={[
                styles.indicatorText,
                newPassword === confirmPassword ? styles.matchText : styles.mismatchText
              ]}>
                {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </Text>
            ) : null}
            <View style={styles.modalActionRow}>
              <Button 
                title="Cancel" 
                variant="secondary" 
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }} 
                disabled={isUpdating} 
                style={{flex: 1, marginRight: 8}} 
              />
              <Button title="Update" onPress={handleChangePassword} loading={isUpdating} style={{flex: 1, marginLeft: 8}} />
            </View>
          </View>
        </View>
      </Modal>

      <CustomAlert 
        {...alertConfig} 
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })} 
      />
    </>
  );
}

const getStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
      paddingHorizontal: 18,
      paddingTop: 16,
    },
    sectionTitle: {
      ...typography.heading,
      fontSize: typography.sizes.md,
      color: palette.textPrimary,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
      letterSpacing: 0.3,
    },
    card: {
      backgroundColor: palette.surface,
      borderRadius: 24,
      padding: 20,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.24 : 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    profileCard: {
      backgroundColor: palette.surface,
      borderRadius: 24,
      padding: 20,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    profileAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: palette.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
      borderWidth: 1,
      borderColor: palette.primary + '40',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 32,
    },
    profileAvatarText: {
      fontSize: 28,
      fontWeight: '800',
      color: palette.primary,
    },
    profileMetaText: {
      fontSize: 13,
      color: palette.textSecondary,
      marginTop: 2,
    },
    modalLogoPickerBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: palette.primary + '15',
      borderWidth: 1,
      borderColor: palette.primary + '30',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: palette.textSecondary,
      marginTop: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.textPrimary,
      marginBottom: 2,
    },
    profileEmail: {
      fontSize: 14,
      color: palette.textSecondary,
    },
    roleBadge: {
      alignSelf: 'flex-start',
      backgroundColor: palette.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: palette.border,
      marginTop: 7,
    },
    roleBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: palette.textMuted,
      letterSpacing: 0.5,
    },
    profileActions: {
      flexDirection: 'row',
      gap: 12,
    },
    profileActionBtn: {
      flex: 1,
      backgroundColor: palette.primary,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileActionText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    profileActionBtnSecondary: {
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.border,
    },
    profileActionTextSecondary: {
      color: palette.textPrimary,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    rowChevron: {
      fontSize: 20,
      color: palette.textSecondary,
    },
    themeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
    },
    rowTitle: {
      ...typography.body,
      fontSize: 16,
      color: palette.textPrimary,
    },
    rowValue: {
      ...typography.body,
      fontSize: 15,
      color: palette.textSecondary,
    },

    // Download row
    downloadRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    downloadIconBadge: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: isDark ? '#1E3A5F' : '#DBEAFE',
      alignItems: 'center',
      justifyContent: 'center',
    },
    downloadIconText: {
      fontSize: 14,
    },
    pdfBadge: {
      backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    pdfBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#FCA5A5' : '#DC2626',
      letterSpacing: 0.5,
    },

    // Segmented theme toggle
    segmentedToggle: {
      flexDirection: 'row',
      backgroundColor: palette.surfaceElevated,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 4,
    },
    segmentButton: {
      minWidth: 74,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentButtonActive: {
      backgroundColor: isDark ? '#00D26A' : colors.primary,
    },
    segmentButtonText: {
      ...typography.label,
      fontSize: 14,
      color: palette.textSecondary,
    },
    segmentButtonTextActive: {
      color: '#FFFFFF',
    },
    logoutBtn: {
      marginTop: spacing.lg,
      marginBottom: spacing.xxl,
      borderRadius: radius.full,
    },
    loadingInline: {
      marginTop: spacing.sm,
      alignItems: 'center',
    },

    // ── Modal ─────────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: palette.modalBg,
    },
    modalSheet: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 12,
      paddingHorizontal: 24,
      paddingBottom: 36,
      borderTopWidth: 1,
      borderColor: palette.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 20,
    },
    handleArea: {
      alignItems: 'center',
      paddingBottom: 14,
      paddingTop: 4,
      marginHorizontal: -24,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.border,
    },
    modalHeader: {
      flexDirection: 'column',
      marginBottom: 16,
    },
    changeDirBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: palette.surfaceAlt,
      borderWidth: 1,
      borderColor: palette.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.textPrimary,
      letterSpacing: 0.2,
    },
    modalSubtitle: {
      fontSize: 13,
      color: palette.textSecondary,
      marginTop: 3,
    },
    modalDivider: {
      height: 1,
      backgroundColor: palette.border,
      marginVertical: 16,
    },
    formatToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    formatLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.textPrimary,
    },
    centeredModalOverlay: {
      flex: 1,
      backgroundColor: palette.modalBg,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    centeredModalContent: {
      backgroundColor: palette.surface,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 24,
      elevation: 24,
    },
    input: {
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: palette.textPrimary,
      marginTop: 16,
    },
    modalActionRow: {
      flexDirection: 'row',
      marginTop: 24,
    },

    // Checkboxes
    checkboxContainer: {
      gap: 16,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: palette.checkboxBg || palette.surfaceElevated,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    checkboxBox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    checkmark: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    checkboxLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.textPrimary,
    },
    checkboxDescription: {
      fontSize: 12,
      color: palette.textSecondary,
      marginTop: 2,
    },

    // Info note — uses a tinted version of the primary color
    infoNote: {
      backgroundColor: isDark ? palette.primary + '20' : palette.primary + '12',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.primary + '50',
      marginBottom: 20,
    },
    infoNoteText: {
      fontSize: 12.5,
      color: palette.primary,
      lineHeight: 18,
    },

    // Download button — uses app primary color
    downloadBtn: {
      backgroundColor: palette.primary,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    downloadBtnDisabled: {
      backgroundColor: palette.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    downloadBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    downloadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 15,
    },
    downloadingText: {
      fontSize: 15,
      color: palette.textSecondary,
      fontWeight: '500',
    },
    indicatorText: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '500',
    },
    matchText: {
      color: palette.success,
    },
    mismatchText: {
      color: palette.danger,
    },
  });
