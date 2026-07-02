import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Platform, TouchableOpacity, Linking, Modal, Pressable, RefreshControl, Animated, Easing, BackHandler, Switch, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import PagerView from 'react-native-pager-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Phone, MessageCircle, UserRound, ChevronRight, CalendarDays, MapPin, Activity, AlertCircle, Bell, Key, UserRoundPen, Share2, Mail, CalendarClock, Salad, ChefHat, Plus, Minus } from 'lucide-react-native';
import { useAppStore } from '../store/useAppStore';
import Button from '../components/Button';
import CustomAlert from '../components/CustomAlert';
import { radius, spacing, typography } from '../theme/theme';
import { useThemeColors } from '../theme/palette';
import RenewMembershipSection from '../sections/RenewMembershipSection';
import { formatStorageDate } from '../utils/memberUtils';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api } from '../utils/api';

export default function MemberDetailScreen({ route, navigation }) {
  const { memberId } = route.params;
  const { members, deletedMembers, deleteMember, restoreMember, plans, updateMember, addPayment, payments, isLoadingData, fetchAppData, sendMemberReminder, getMemberCredentials } = useAppStore();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const member = members.find((m) => m.id === memberId) || deletedMembers.find((m) => m.id === memberId);

  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [memberId, member?.photo, member?.imageUrl]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [renewForm, setRenewForm] = useState({ membershipType: '', joinDate: '', paymentMethod: 'cash', discount: '', notes: '' });
  const [renewError, setRenewError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const [activeTab, setActiveTab] = useState('details');
  const [showRenewSheet, setShowRenewSheet] = useState(false);
  const renewSheetY = React.useRef(new Animated.Value(520)).current;

  // Diet-specific states
  const [dietLoading, setDietLoading] = useState(false);
  const [memberDiet, setMemberDiet] = useState(null);
  const [localDietAccess, setLocalDietAccess] = useState(member?.hasDietAccess || false);
  const [localDietLimit, setLocalDietLimit] = useState(member?.dietGenerationDailyLimit ?? 3);
  const [limitUpdating, setLimitUpdating] = useState(false);

  const memberTabs = React.useMemo(
    () => [
      { key: 'details', label: 'Details' },
      { key: 'payments', label: 'Payments' },
      { key: 'diet', label: 'Diet Plan' },
    ],
    []
  );
  const pagerRef = React.useRef(null);
  const [tabHeights, setTabHeights] = useState({});
  const activeTabIndex = Math.max(memberTabs.findIndex((tab) => tab.key === activeTab), 0);
  const pagerHeight = Math.max(tabHeights[activeTab] || 420, 240);

  const handleTabPress = (tabKey) => {
    const nextIndex = memberTabs.findIndex((tab) => tab.key === tabKey);
    if (nextIndex < 0) return;
    setActiveTab(tabKey);
    pagerRef.current?.setPage(nextIndex);
  };

  const handleTabPageLayout = (tabKey, event) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setTabHeights((prev) => (prev[tabKey] === nextHeight ? prev : { ...prev, [tabKey]: nextHeight }));
  };

  const showAlert = (title, message, buttons = [{ text: 'OK' }], type = 'info', icon) => {
    setAlertConfig({ visible: true, title, message, buttons, type, icon });
  };

  const hideAlert = () => setAlertConfig((prev) => ({ ...prev, visible: false }));

  const [credLoading, setCredLoading] = useState(false);



  // Sync state if member details change
  React.useEffect(() => {
    if (member) {
      setLocalDietAccess(member.hasDietAccess || false);
      setLocalDietLimit(member.dietGenerationDailyLimit ?? 3);
    }
  }, [member]);

  React.useEffect(() => {
    if (activeTab === 'diet' && localDietAccess && member?.id) {
      fetchMemberDiet();
    }
  }, [activeTab, localDietAccess, member?.id]);

  const fetchMemberDiet = async () => {
    if (!member?.id) return;
    setDietLoading(true);
    try {
      const plan = await api.getDietPlan(member.id);
      setMemberDiet(plan);
    } catch (err) {
      console.warn('Failed to fetch diet plan:', err);
      setMemberDiet(null);
    } finally {
      setDietLoading(false);
    }
  };

  const handleToggleDietAccess = async (val) => {
    setLocalDietAccess(val);
    try {
      await updateMember(member.id, { hasDietAccess: val }, true);
    } catch (err) {
      setLocalDietAccess(!val);
      showAlert('Error', err.message || 'Failed to update diet access', [{ text: 'OK' }], 'error');
    }
  };

  const handleIncrementLimit = async () => {
    const nextLimit = (parseInt(localDietLimit, 10) || 3) + 1;
    if (nextLimit > 99) return;
    setLocalDietLimit(nextLimit);
    setLimitUpdating(true);
    try {
      await updateMember(member.id, { dietGenerationDailyLimit: nextLimit }, true);
      showAlert('Success', `Daily generation limit updated to ${nextLimit} successfully.`, [{ text: 'OK' }], 'success');
    } catch (err) {
      setLocalDietLimit(member?.dietGenerationDailyLimit ?? 3);
      showAlert('Error', err.message || 'Failed to update daily limit', [{ text: 'OK' }], 'error');
    } finally {
      setLimitUpdating(false);
    }
  };

  const handleDecrementLimit = async () => {
    const nextLimit = (parseInt(localDietLimit, 10) || 3) - 1;
    if (nextLimit < 1) return;
    setLocalDietLimit(nextLimit);
    setLimitUpdating(true);
    try {
      await updateMember(member.id, { dietGenerationDailyLimit: nextLimit }, true);
      showAlert('Success', `Daily generation limit updated to ${nextLimit} successfully.`, [{ text: 'OK' }], 'success');
    } catch (err) {
      setLocalDietLimit(member?.dietGenerationDailyLimit ?? 3);
      showAlert('Error', err.message || 'Failed to update daily limit', [{ text: 'OK' }], 'error');
    } finally {
      setLimitUpdating(false);
    }
  };

  const handleShowPassword = async () => {
    setCredLoading(true);
    try {
      const res = await getMemberCredentials(member.id);
      showAlert(
        'Member Credentials',
        `Login ID: ${res.loginId}\nPassword: ${res.password}`,
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Share',
            onPress: async () => {
              if (!member.phone) {
                showAlert('Error', 'Member has no phone number registered.', [{ text: 'OK' }], 'error');
                return;
              }
              const message = `Dear ${member.name},\n\nHere are your login credentials for the Gym Member Portal:\n\n👤 *Login ID:* ${res.loginId}\n🔑 *Password:* ${res.password}\n\nKeep grinding! 💪💯`;
              try {
                await Linking.openURL(`https://wa.me/+91${member.phone}?text=${encodeURIComponent(message)}`);
              } catch (err) {
                showAlert('Error', 'Could not open WhatsApp. Make sure it is installed.', [{ text: 'OK' }], 'error');
              }
            }
          }
        ],
        'password'
      );
    } catch (err) {
      showAlert('Error', err.message || 'Failed to retrieve credentials', [{ text: 'OK' }], 'error');
    } finally {
      setCredLoading(false);
    }
  };

  const selectedPlan = useMemo(() => {
    if (!member?.planId) return null;
    const pid = typeof member.planId === 'object' ? member.planId._id || member.planId.id : member.planId;
    return plans.find((p) => p.id === pid || p._id === pid) || null;
  }, [member, plans]);

  const paymentHistory = useMemo(() => {
    const list = (payments || []).filter((p) => {
      const paymentMemberId =
        typeof p?.memberId === 'object' ? p.memberId?._id || p.memberId?.id : p?.memberId;
      return paymentMemberId === memberId;
    });
    return list.sort((a, b) => new Date(b?.paidOn || b?.createdAt || 0) - new Date(a?.paidOn || a?.createdAt || 0));
  }, [payments, memberId]);

  const totalPaymentAmount = useMemo(
    () => paymentHistory.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0),
    [paymentHistory]
  );
  const lastPayment = paymentHistory[0];

  React.useEffect(() => {
    const onBackPress = () => {
      if (!showRenewSheet) return false;
      closeRenewSheet();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showRenewSheet]);

  if (!member) {
    return (
      <View style={styles.center}>
        {
         /* <Text style={{ color: colors.textPrimary, marginBottom: spacing.md }}>Member not found.</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} /> */}
        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          type={alertConfig.type}
          onClose={hideAlert}
        />
      </View>
    );
  }

  const isSoftDeleted = member?.status === 'deleted';
  const isExpired = new Date(member.expiryDate) < new Date();
  const statusText = isSoftDeleted ? 'Deleted' : (isExpired ? 'Expired' : 'Active');
  const memberCode = member.id?.slice(-4)?.toUpperCase() || '0000';
  const memberSince = member.joinDate ? new Date(member.joinDate).toDateString() : '-';
  const expiryDate = member.expiryDate ? new Date(member.expiryDate).toDateString() : '-';
  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleRenewPress = () => {
    let defaultJoinDate = new Date();
    if (member && member.expiryDate) {
      const expiry = new Date(member.expiryDate);
      if (!isNaN(expiry.getTime())) {
        defaultJoinDate = new Date(expiry);
        defaultJoinDate.setDate(defaultJoinDate.getDate() + 1);
      }
    }

    setRenewForm({
      membershipType: selectedPlan ? selectedPlan.name : plans[0]?.name || '',
      joinDate: formatStorageDate(defaultJoinDate),
      paymentMethod: 'cash',
      discount: '',
      notes: '',
    });
    setRenewError('');
    setShowRenewSheet(true);
    Animated.timing(renewSheetY, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeRenewSheet = () => {
    Animated.timing(renewSheetY, {
      toValue: 520,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowRenewSheet(false);
      setShowDatePicker(false);
      setRenewError('');
    });
  };

  const handleSaveRenew = async () => {
    const pickedPlan = plans.find((p) => p.name === renewForm.membershipType);
    if (!pickedPlan) return setRenewError('Please select a valid plan.');
    if (!renewForm.joinDate) return setRenewError('Please select a joining date.');

    setLoading(true);
    try {
      const joinDate = new Date(renewForm.joinDate);
      joinDate.setHours(13, 0, 0, 0);
      const nextExpiry = new Date(joinDate);
      nextExpiry.setMonth(nextExpiry.getMonth() + parseInt(pickedPlan.durationMonths || 1, 10));
      nextExpiry.setDate(nextExpiry.getDate() - 1);
      nextExpiry.setHours(23, 59, 59, 999);

      await updateMember(member.id, {
        planId: pickedPlan.id || pickedPlan._id,
        joinDate: joinDate.toISOString(),
        expiryDate: nextExpiry.toISOString(),
        status: 'active',
      });

      const basePrice = Number(pickedPlan.amount || pickedPlan.price || 0);
      const discountVal = Number(renewForm.discount) || 0;
      const finalAmount = Math.max(0, basePrice - discountVal);

      const paymentNotes = renewForm.notes
        ? `Renewal for ${pickedPlan.name} Plan - ${renewForm.notes.trim()}`
        : `Renewal for ${pickedPlan.name} Plan`;

      await addPayment({
        memberId: member.id,
        amount: finalAmount,
        paymentMethod: renewForm.paymentMethod || 'cash',
        notes: paymentNotes,
      });

      closeRenewSheet();
      setTimeout(() => showAlert('Success', 'Membership renewed successfully!', [{ text: 'OK' }], 'success'), 320);
    } catch (err) {
      setRenewError('Failed to renew membership.');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setRenewForm((prev) => ({ ...prev, joinDate: formatStorageDate(selectedDate) }));
  };

  const handleRestore = () => {
    showAlert(
      'Restore Member',
      'Are you sure you want to restore this member profile back to active?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setLoading(true);
            try {
              await restoreMember(memberId);
              setTimeout(() => showAlert('Success', 'Member restored successfully!', [{ text: 'OK', onPress: () => navigation.goBack() }], 'success'), 320);
            } catch (err) {
              showAlert('Error', err.message || 'Failed to restore member', [{ text: 'OK' }], 'error');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'info'
    );
  };

  const handleHardDelete = () => {
    showAlert(
      'Permanently Delete',
      'WARNING: This will permanently erase this member profile and all related credentials/images from the database. This action cannot be undone.\n\nAre you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteMember(memberId, true);
              setTimeout(() => showAlert('Success', 'Member permanently deleted!', [{ text: 'OK', onPress: () => navigation.goBack() }], 'success'), 320);
            } catch (err) {
              showAlert('Error', err.message || 'Failed to permanently delete member', [{ text: 'OK' }], 'error');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'delete'
    );
  };

  const handleInvoiceAction = (payment) => {
    showAlert(
      'Invoice Options',
      `Choose how you would like to share the invoice for Rs ${Number(payment.amount || 0).toLocaleString()}:`,
      [
        {
          text: 'Send via WhatsApp',
          onPress: async () => {
            if (!member.phone) {
              showAlert('Error', 'Member has no phone number registered.', [{ text: 'OK' }], 'error');
              return;
            }

            const invoiceUrl = api.getInvoiceUrl(payment.id || payment._id);
            const message = `Dear ${member.name},\n\nThank you for your payment! Here are your transaction details:\n\n💰 *Amount Paid:* Rs ${Number(payment.amount).toLocaleString()}\n📅 *Date:* ${formatDate(payment.paidOn || payment.createdAt)}\n💳 *Payment Method:* ${(payment.paymentMethod || 'cash').toUpperCase()}\n\n📄 *Download Invoice PDF:* ${invoiceUrl}\n\nKeep grinding! 💪💯`;

            try {
              await Linking.openURL(`https://wa.me/+91${member.phone}?text=${encodeURIComponent(message)}`);
            } catch (err) {
              showAlert('Error', 'Could not open WhatsApp. Make sure it is installed.', [{ text: 'OK' }], 'error');
            }
          }
        },
        {
          text: 'Share PDF Document',
          onPress: async () => {
            setLoading(true);
            try {
              const base64Data = await api.downloadInvoice(payment.id || payment._id);
              const fileUri = `${FileSystem.documentDirectory}invoice_${payment.id || payment._id}.pdf`;

              await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
              });

              await Sharing.shareAsync(fileUri, {
                mimeType: 'application/pdf',
                dialogTitle: `Share Invoice for ${member.name}`,
              });
            } catch (err) {
              showAlert('Error', err.message || 'Failed to generate and share invoice PDF', [{ text: 'OK' }], 'error');
            } finally {
              setLoading(false);
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ],
      'action'
    );
  };

  const handleDelete = () => {
    showAlert(
      'Delete Member',
      'Are you sure you want to delete this member? They will be moved to the Archived/Deleted list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteMember(memberId, false);
              setTimeout(() => showAlert('Success', 'Member deleted successfully!', [{ text: 'OK', onPress: () => navigation.goBack() }], 'success'), 320);
            } catch (err) {
              showAlert('Error', err.message || 'Failed to delete member', [{ text: 'OK' }], 'error');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'delete'
    );
  };

  const openPhone = async () => {
    if (!member.phone) return;
    await Linking.openURL(`tel:+91${member.phone}`);
  };

  const contactEmergency = async () => {
    if (!member.
      emergencyContact) return;
    await Linking.openURL(`tel:+91${member.
      emergencyContact}`);
  };

  const openWhatsapp = async () => {
    if (!member.phone) return;

    const posterMessage = isExpired
      ? `
Dear ${member.name},

We noticed your gym membership expired on ${expiryDate}.

💪 *Don't lose your momentum!* 
It's time to get back on track and crush your fitness goals! 🚀

📌 *Member ID:* #${memberCode}
📅 *Expiry Date:* ${expiryDate}
🔴 *Status:* Expired

👉 *Reply to this message or visit the gym to renew!*
Let's get back to work! 💯`
      : `
Dear ${member.name},

A quick reminder that your membership will expire on *${expiryDate}*.

💪 *Keep the momentum going!* 
Renew soon to ensure zero interruptions to your fitness journey! 🚀

📌 *Member ID:* #${memberCode}
📅 *Expiry Date:* ${expiryDate}
🟢 *Status:* Active (Expiring Soon)

👉 *Reply to this message or visit the gym to renew!*
Let's keep making gains! 💯`;

    await Linking.openURL(`https://wa.me/+91${member.phone}?text=${encodeURIComponent(posterMessage)}`);
  };

  let StatusTextColor = colors.success;
  if (isSoftDeleted) {
    StatusTextColor = colors.danger;
  } else if (isExpired) {
    StatusTextColor = colors.danger;
  } else if (Math.ceil(
    (new Date(member.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
  ) <= 4) {
    StatusTextColor = colors.warning;
  }

  const getGoalLabel = (g) => {
    switch (g) {
      case 'lose': return 'Lose Weight';
      case 'gain': return 'Gain Weight';
      case 'maintain': return 'Maintain Weight';
      default: return g || '-';
    }
  };

  const getDietStyleLabel = (s) => {
    switch (s) {
      case 'balanced': return 'Balanced';
      case 'high_protein': return 'High Protein';
      case 'high_carb': return 'High Carb';
      case 'high_fat': return 'High Fat / Keto';
      default: return s || '-';
    }
  };

  const getDietTypeLabel = (t) => {
    switch (t) {
      case 'veg': return 'Vegetarian';
      case 'non_veg': return 'Non-Vegetarian';
      default: return t || '-';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      scrollEnabled={!showRenewSheet}
      refreshControl={<RefreshControl refreshing={false} onRefresh={fetchAppData} tintColor={colors.accent} />}
    >
      {isSoftDeleted && (
        <View style={styles.archivedBanner}>
          <AlertCircle color={colors.danger} size={20} style={{ marginRight: 8 }} />
          <Text style={styles.archivedBannerText}>
            This profile is currently archived (soft-deleted). Restore it to reactivate.
          </Text>
        </View>
      )}

      <View style={styles.heroCard}>
        {(member.photo || member.imageUrl) && !imageError ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setShowImagePreview(true)}>
            <Image
              source={{ uri: member.photo || member.imageUrl }}
              style={styles.avatar}
              onError={() => setImageError(true)}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.avatarPlaceholder}>
            <UserRound color={colors.textMuted} size={78} />
          </View>
        )}
        <Text style={styles.name}>{member.name}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <View style={[styles.idPill, { marginBottom: 0, alignSelf: 'auto' }]}>
            <Text style={styles.idPillLabel}>MEMBER ID</Text>
            <Text style={styles.idPillValue}>#{(member._id).slice(-5).toUpperCase()}</Text>
          </View>
          {member.batch && (
            <View style={[styles.batchIndicator, { alignSelf: 'auto', justifyContent: 'center' }]}>
              <Text style={styles.batchIndicatorText}>{member.batch.toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={styles.joined}>Joined {memberSince}</Text>

        <View style={styles.planRow}>
          <View style={styles.planChipHighlight}><Text style={styles.planChipTextHighlight}>{selectedPlan?.name || 'No Plan'}</Text></View>
          <View style={styles.genderChip}><Text style={styles.genderChipText}>{member.gender?.toUpperCase() || 'MEMBER'}</Text></View>
        </View>

        <View style={[styles.expiryCard, (isExpired || isSoftDeleted) && styles.expiryCardExpired]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.expiryLabel}>Membership Expiry</Text>
            <Text style={styles.expiryDate}>{expiryDate}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${StatusTextColor}15` }]}>
            <Activity color={StatusTextColor} size={16} />
            <Text style={[styles.expiryStatus, { color: StatusTextColor }]}>
              {statusText.toUpperCase()}
            </Text>
          </View>
        </View>


        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactBtnCall} onPress={openPhone}>
            <Phone color="#16a34a" size={20} />
            <Text style={styles.contactTextCall}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactBtnWhatsApp} onPress={openWhatsapp}>
            <MessageCircle color="#25D366" size={20} />
            <Text style={styles.contactTextWhatsApp}>WhatsApp</Text>
          </TouchableOpacity>
        </View>





        <TouchableOpacity
          style={[styles.actionTile, isSoftDeleted && { opacity: 0.5 }]}
          onPress={() => !isSoftDeleted && navigation.navigate('AddEditMember', { memberId: member.id })}
          disabled={isSoftDeleted}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.fieldIconWrap, { marginRight: 12, width: 38, height: 38, borderRadius: 19 }]}>
              < UserRoundPen color={colors.accent} size={18} />
            </View>
            <View>
              <Text style={styles.actionTitle}>Edit Profile</Text>
              <Text style={styles.actionSub}>Update member details and contacts</Text>
            </View>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionTile, isSoftDeleted && { opacity: 0.5 }]}
          onPress={async () => {
            setReminderLoading(true);
            try {
              const res = await sendMemberReminder(member.id);
              showAlert('SMS Sent', res?.message || `Reminder SMS sent to ${member.name}`, [{ text: 'OK' }], 'sms');
            } catch (err) {
              showAlert('Failed', err.message || 'Could not send reminder SMS', [{ text: 'OK' }], 'error');
            } finally {
              setReminderLoading(false);
            }
          }}
          disabled={reminderLoading || isSoftDeleted}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.fieldIconWrap, { marginRight: 12, width: 38, height: 38, borderRadius: 19 }]}>
              <Bell color={colors.accent} size={18} />
            </View>
            <View>
              <Text style={styles.actionTitle}>{reminderLoading ? 'Sending...' : 'Send Reminder'}</Text>
              <Text style={styles.actionSub}>{isExpired ? 'Send plan expired SMS' : 'Send renewal reminder SMS'}</Text>
            </View>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionTile, isSoftDeleted && { opacity: 0.5 }]}
          onPress={handleShowPassword}
          disabled={credLoading || isSoftDeleted}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.fieldIconWrap, { marginRight: 12, width: 38, height: 38, borderRadius: 19 }]}>
              <Key color={colors.accent} size={18} />
            </View>
            <View>
              <Text style={styles.actionTitle}>{credLoading ? 'Retrieving...' : 'Show Portal Password'}</Text>
              <Text style={styles.actionSub}>View member portal login credentials</Text>
            </View>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionTile, (isSoftDeleted || paymentHistory.length === 0) && { opacity: 0.5 }]}
          onPress={() => {
            if (paymentHistory.length === 0) {
              showAlert('No Payments', 'There is no payment record found for this member to generate an invoice.', [{ text: 'OK' }], 'error');
              return;
            }
            handleInvoiceAction(paymentHistory[0]);
          }}
          disabled={isSoftDeleted || paymentHistory.length === 0}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.fieldIconWrap, { marginRight: 12, width: 38, height: 38, borderRadius: 19 }]}>
              <Share2 color={colors.accent} size={18} />
            </View>
            <View>
              <Text style={styles.actionTitle}>Generate Invoice</Text>
              <Text style={styles.actionSub}>Share invoice for the ongoing membership</Text>
            </View>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.detailsCard}>
        <View style={styles.tabsRow}>
          {memberTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handleTabPress(tab.key)}
              style={[styles.tabButton, activeTab === tab.key && styles.activeTabButton]}
              activeOpacity={0.8}
            >
              <Text style={activeTab === tab.key ? styles.activeTab : styles.inactiveTab}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <PagerView
          ref={pagerRef}
          style={[styles.pagerView, { height: pagerHeight }]}
          initialPage={activeTabIndex}
          offscreenPageLimit={2}
          scrollEnabled={!showRenewSheet}
          onPageSelected={(event) => {
            const nextTab = memberTabs[event.nativeEvent.position]?.key;
            if (nextTab) setActiveTab(nextTab);
          }}
        >
          <View key="details" style={styles.pagerPage}>
            <View style={styles.pagerPageInner} onLayout={(event) => handleTabPageLayout('details', event)}>
              <View style={styles.fieldWrapAttractive}>
                <View style={styles.fieldIconWrap}>
                  <Phone color={colors.accent} size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabelAttractive}>Phone Number</Text>
                  <Text style={styles.fieldValueAttractive}>{member.phone || '-'}</Text>
                </View>
              </View>

              <View style={styles.fieldWrapAttractive}>
                <View style={styles.fieldIconWrap}>
                  <Mail color={colors.accent} size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabelAttractive}>Email Address</Text>
                  <Text style={styles.fieldValueAttractive}>{member.email || '-'}</Text>
                </View>
              </View>

              <View style={styles.fieldWrapAttractive}>
                <View style={styles.fieldIconWrap}>
                  <UserRound color={colors.accent} size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabelAttractive}>Gender</Text>
                  <Text style={styles.fieldValueAttractive}>{member.gender?.toUpperCase() || '-'}</Text>
                </View>
              </View>

              <View style={styles.fieldWrapAttractive}>
                <View style={styles.fieldIconWrap}>
                  <CalendarClock color={colors.accent} size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabelAttractive}>Batch</Text>
                  <Text style={styles.fieldValueAttractive}>{member.batch ? (member.batch.charAt(0).toUpperCase() + member.batch.slice(1)) : '-'}</Text>
                </View>
              </View>

              <View style={styles.fieldWrapAttractive}>
                <View style={styles.fieldIconWrap}>
                  <CalendarDays color={colors.accent} size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabelAttractive}>Joining Date</Text>
                  <Text style={styles.fieldValueAttractive}>{memberSince}</Text>
                </View>
              </View>

              <View style={styles.fieldWrapAttractive}>
                <View style={styles.fieldIconWrap}>
                  <AlertCircle color={colors.accent} size={20} />
                </View>
                <View style={[styles.fieldContent, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <View>
                    <Text style={styles.fieldLabelAttractive}>Emergency Contact</Text>
                    <Text style={styles.fieldValueAttractive}>{member.emergencyContact || '-'}</Text>
                  </View>
                  {member.emergencyContact ? (
                    <TouchableOpacity style={styles.emergencyBtnAttractive} onPress={contactEmergency}>
                      <Phone color="#FFFFFF" size={16} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View style={styles.fieldWrapAttractive}>
                <View style={styles.fieldIconWrap}>
                  <MapPin color={colors.accent} size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabelAttractive}>Address</Text>
                  <Text style={styles.fieldValueAttractive}>{member.address || '-'}</Text>
                </View>
              </View>
            </View>
          </View>

          <View key="payments" style={styles.pagerPage}>
            <View style={styles.pagerPageInner} onLayout={(event) => handleTabPageLayout('payments', event)}>
              <View style={styles.paymentSummaryRow}>
                <View style={styles.paymentSummaryBox}>
                  <Text style={styles.paymentSummaryLabel}>Total Amount</Text>
                  <Text style={styles.paymentSummaryValue}>Rs {totalPaymentAmount.toLocaleString()}</Text>
                </View>
                <View style={styles.paymentSummaryBox}>
                  <Text style={styles.paymentSummaryLabel}>Last Paid</Text>
                  <Text style={styles.paymentSummaryValue}>
                    {lastPayment ? `Rs ${Number(lastPayment.amount || 0).toLocaleString()}` : 'Rs 0'}
                  </Text>
                </View>
              </View>
              <View style={styles.historyWrap}>
                {paymentHistory.length === 0 ? (
                  <Text style={styles.emptyHistory}>No payment history for this member yet.</Text>
                ) : (
                  paymentHistory.map((payment, idx) => (
                    <View
                      key={payment.id || payment._id || `${idx}-${payment.amount}`}
                      style={[styles.historyRow, idx === paymentHistory.length - 1 && styles.historyRowLast]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyDate}>{formatDate(payment.paidOn || payment.createdAt)}</Text>
                        <Text style={styles.historyMeta}>{(payment.paymentMethod || 'cash').toUpperCase()}</Text>
                        <Text style={styles.historyMeta}>{(payment.notes || 'payment received')}</Text>
                      </View>
                      <Text style={styles.historyAmount}>Rs {Number(payment.amount || 0).toLocaleString()}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>

          <View key="diet" style={styles.pagerPage}>
            <View style={styles.pagerPageInner} onLayout={(event) => handleTabPageLayout('diet', event)}>
              <View>
                {!localDietAccess ? (
                  <View style={styles.dietAccessDisabledContainer}>
                    <Salad color={colors.textMuted} size={48} style={{ marginBottom: 12 }} />
                    <Text style={styles.dietAccessDisabledText}>Diet Access is currently disabled</Text>
                    <Text style={styles.dietAccessDisabledSub}>Enable access to view the member's diet plan details.</Text>
                    <View style={styles.centeredToggleRow}>
                      <Text style={styles.toggleRowLabel}>Enable Access</Text>
                      <Switch
                        value={localDietAccess}
                        onValueChange={handleToggleDietAccess}
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                        disabled={isSoftDeleted}
                      />
                    </View>
                  </View>
                ) : dietLoading ? (
                  <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 40 }} />
                ) : (
                  <View>
                    <View style={styles.dietContentHeader}>
                      <Text style={styles.dietContentTitle}>Diet Summary</Text>
                    </View>

                    {/* Configuration Controls Card */}
                    <View style={styles.configControlsCard}>
                      {/* Row 1: Diet Access */}
                      <View style={styles.configItem}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.configItemTitle}>Diet Access</Text>
                          <Text style={styles.configItemDesc}>Allow member portal diet planning</Text>
                        </View>
                        <Switch
                          value={localDietAccess}
                          onValueChange={handleToggleDietAccess}
                          trackColor={{ false: colors.border, true: colors.accent }}
                          thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                          disabled={isSoftDeleted}
                        />
                      </View>
                      {/* Row 2: Daily Limit */}
                      <View style={styles.configItem}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.configItemTitle}>Daily Limit</Text>
                            {limitUpdating && (
                              <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} />
                            )}
                          </View>
                          <Text style={styles.configItemDesc}>Maximum plan generations per day</Text>
                        </View>
                        <View style={styles.counterContainer}>
                          <TouchableOpacity
                            style={[styles.counterBtn, (localDietLimit <= 1 || limitUpdating) && styles.counterBtnDisabled]}
                            onPress={handleDecrementLimit}
                            disabled={localDietLimit <= 1 || isSoftDeleted || limitUpdating}
                            activeOpacity={0.7}
                          >
                            <Minus size={14} color={(localDietLimit <= 1 || limitUpdating) ? colors.textMuted : colors.textPrimary} />
                          </TouchableOpacity>
                          <Text style={styles.counterValue}>{localDietLimit}</Text>
                          <TouchableOpacity
                            style={[styles.counterBtn, (localDietLimit >= 99 || limitUpdating) && styles.counterBtnDisabled]}
                            onPress={handleIncrementLimit}
                            disabled={localDietLimit >= 99 || isSoftDeleted || limitUpdating}
                            activeOpacity={0.7}
                          >
                            <Plus size={14} color={(localDietLimit >= 99 || limitUpdating) ? colors.textMuted : colors.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {(memberDiet && memberDiet.totalCalories) ? (
                      <View style={styles.dietPlanSummaryContainer}>
                        {/* Calories Card */}
                        <View style={styles.dietPlanItem}>
                          <Text style={styles.dietPlanLabel}>Daily Target Calories</Text>
                          <Text style={styles.dietPlanValue}>{memberDiet.totalCalories} kcal/day</Text>
                        </View>

                        {/* Macronutrients Grid */}
                        <View style={styles.macroSummaryGrid}>
                          <View style={[styles.macroSummaryBox, { borderColor: '#e74c3c' }]}>
                            <Text style={[styles.macroSummaryVal, { color: '#e74c3c' }]}>{memberDiet.totalProtein}g</Text>
                            <Text style={styles.macroSummaryLbl}>Protein</Text>
                          </View>
                          <View style={[styles.macroSummaryBox, { borderColor: '#f39c12' }]}>
                            <Text style={[styles.macroSummaryVal, { color: '#f39c12' }]}>{memberDiet.totalCarb}g</Text>
                            <Text style={styles.macroSummaryLbl}>Carbs</Text>
                          </View>
                          <View style={[styles.macroSummaryBox, { borderColor: '#3498db' }]}>
                            <Text style={[styles.macroSummaryVal, { color: '#3498db' }]}>{memberDiet.totalFat}g</Text>
                            <Text style={styles.macroSummaryLbl}>Fats</Text>
                          </View>
                        </View>

                        {/* Additional Info fields */}
                        <View style={styles.fieldWrapAttractive}>
                          <View style={styles.fieldIconWrap}>
                            <Activity color={colors.accent} size={20} />
                          </View>
                          <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabelAttractive}>Fitness Goal</Text>
                            <Text style={styles.fieldValueAttractive}>{getGoalLabel(memberDiet.goal)}</Text>
                          </View>
                        </View>

                        <View style={styles.fieldWrapAttractive}>
                          <View style={styles.fieldIconWrap}>
                            <ChefHat color={colors.accent} size={20} />
                          </View>
                          <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabelAttractive}>Diet Style</Text>
                            <Text style={styles.fieldValueAttractive}>{getDietStyleLabel(memberDiet.dietStyle)}</Text>
                          </View>
                        </View>

                        <View style={styles.fieldWrapAttractive}>
                          <View style={styles.fieldIconWrap}>
                            <Salad color={colors.accent} size={20} />
                          </View>
                          <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabelAttractive}>Diet Type</Text>
                            <Text style={styles.fieldValueAttractive}>{getDietTypeLabel(memberDiet.dietType)}</Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.noDietPlanContainer}>
                        <AlertCircle color={colors.textMuted} size={40} style={{ marginBottom: 10 }} />
                        <Text style={styles.noDietPlanText}>member has not generated diet plan</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        </PagerView>
      </View>

      <View style={styles.bottomActions}>
        {isSoftDeleted ? (
          <>
            <Button title="Restore Member" onPress={handleRestore} loading={loading} style={styles.bottomBtn} />
            <Button title="Permanently Delete" variant="danger" onPress={handleHardDelete} loading={loading} style={styles.bottomBtn} />
          </>
        ) : (
          <>
            <Button title="Renew Plan" onPress={handleRenewPress} loading={loading} style={styles.bottomBtn} />
            <Button title="Delete Member" variant="danger" onPress={handleDelete} loading={loading} style={styles.bottomBtn} />
          </>
        )}
      </View>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onClose={hideAlert}
      />

      <Modal visible={showImagePreview} transparent animationType="fade" onRequestClose={() => setShowImagePreview(false)}>
        <Pressable style={styles.previewOverlay} onPress={() => setShowImagePreview(false)}>
          <Image source={{ uri: member.photo || member.imageUrl }} style={styles.previewImage} resizeMode="contain" />
          <Text style={styles.previewHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>


      <Modal
        visible={showRenewSheet}
        transparent
        animationType="fade"
        onRequestClose={closeRenewSheet}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.renewOverlay}
        >
          <Pressable style={styles.renewBackdrop} onPress={closeRenewSheet} />
          <Animated.View style={[styles.renewSheet, { transform: [{ translateY: renewSheetY }] }]}>
            <RenewMembershipSection
              member={member}
              membershipTypes={plans}
              renewError={renewError}
              renewForm={renewForm}
              onBack={closeRenewSheet}
              onChange={(field, value) => setRenewForm((prev) => ({ ...prev, [field]: value }))}
              onDatePress={() => setShowDatePicker(true)}
              onSave={handleSaveRenew}
            />
            {showDatePicker && (
              <DateTimePicker
                value={renewForm.joinDate ? new Date(renewForm.joinDate) : new Date()}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>


    </ScrollView>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.md,
      paddingBottom: 140,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: spacing.md,
    },
    avatar: {
      width: 150,
      height: 150,
      borderRadius: 75,
      alignSelf: 'center',
      marginTop: 8,
    },
    avatarPlaceholder: {
      width: 150,
      height: 150,
      borderRadius: 75,
      alignSelf: 'center',
      marginTop: 8,
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    name: {
      ...typography.heading,
      color: colors.textPrimary,
      fontSize: 33,
      textAlign: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    idPill: {
      alignSelf: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    idPillLabel: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: 'center',
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    idPillValue: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'center',
    },
    batchIndicator: {
      backgroundColor: `${colors.accent}12`,
      borderColor: `${colors.accent}35`,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    batchIndicatorText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    joined: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    planRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: spacing.md,
    },
    planChipHighlight: {
      flex: 1.5,
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    planChipTextHighlight: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 15,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    genderChip: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    genderChipText: {
      color: colors.textSecondary,
      fontWeight: '700',
      fontSize: 14,
      letterSpacing: 0.5,
    },
    expiryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 18,
      marginBottom: spacing.md,
    },
    expiryCardExpired: {
      borderColor: `${colors.danger}50`,
      backgroundColor: `${colors.danger}05`,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    expiryLabel: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    expiryDate: {
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 22,
      marginTop: 2,
    },
    expiryStatus: {
      marginLeft: 6,
      fontSize: 13,
      fontWeight: '800',
    },
    metricActions: {
      flexDirection: 'row',
      backgroundColor: `${colors.success}10`,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: `${colors.success}30`,
      padding: 18,
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    metricBlock: {
      flex: 1,
      alignItems: 'center',
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: '800',
    },
    metricLabel: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 2,
      letterSpacing: 0.5,
    },
    contactRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: spacing.md,
    },
    contactBtnCall: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(34, 197, 94, 0.3)',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    contactBtnWhatsApp: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: 'rgba(37, 211, 102, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(37, 211, 102, 0.3)',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    contactTextCall: {
      color: '#16a34a',
      fontSize: 15,
      fontWeight: '700',
    },
    contactTextWhatsApp: {
      color: '#16a34a',
      fontSize: 15,
      fontWeight: '700',
    },
    actionTile: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    actionTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    actionSub: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    detailsCard: {
      backgroundColor: colors.surface,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginBottom: spacing.md,
    },
    tabsHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    tabsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 9999,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    activeTab: {
      color: colors.textInverted,
      fontWeight: '700',
      fontSize: 14,
    },
    inactiveTab: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 14,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 9999,
    },
    activeTabButton: {
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    pagerView: {
      width: '100%',
    },
    pagerPage: {
      width: '100%',
    },
    pagerPageInner: {
      width: '100%',
    },
    fieldWrapAttractive: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
    },
    fieldIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${colors.accent}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    fieldContent: {
      flex: 1,
    },
    fieldLabelAttractive: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 4,
      fontWeight: '500',
    },
    fieldValueAttractive: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    emergencyBtnAttractive: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.danger,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.danger,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    bottomActions: {
      gap: 10,
      marginBottom: 10,
    },
    bottomBtn: {
      borderRadius: 18,
    },
    previewOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    previewImage: {
      width: '100%',
      height: '78%',
      borderRadius: 16,
    },
    previewHint: {
      color: '#FFFFFF',
      marginTop: 14,
      fontSize: 13,
      opacity: 0.85,
    },
    paymentSummaryRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    paymentSummaryBox: {
      flex: 1,
      backgroundColor: `${colors.success}10`,
      borderWidth: 1,
      borderColor: `${colors.success}30`,
      borderRadius: 16,
      padding: 14,
    },
    paymentSummaryLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 6,
      textAlign: 'center',
    },
    paymentSummaryValue: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
    historyWrap: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    historyRowLast: {
      borderBottomWidth: 0,
    },
    historyDate: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    historyMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    historyAmount: {
      color: colors.success,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyHistory: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 14,
    },
    loadingInline: {
      marginTop: spacing.sm,
      alignItems: 'center',
    },
    invoiceBtn: {
      marginLeft: 12,
      backgroundColor: `${colors.accent}12`,
      padding: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${colors.accent}30`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    renewOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    renewBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.38)',
    },
    renewSheet: {
      width: '100%',
    },
    archivedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${colors.danger}12`,
      borderWidth: 1,
      borderColor: `${colors.danger}30`,
      borderRadius: 16,
      padding: 12,
      marginBottom: spacing.md,
    },
    archivedBannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.danger,
    },
    dietContentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    dietContentTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    configControlsCard: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
    },
    configItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    configItemTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    configItemDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    configDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    counterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 4,
    },
    counterBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    counterBtnDisabled: {
      opacity: 0.5,
    },
    counterValue: {
      width: 36,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    dietAccessDisabledContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
      paddingHorizontal: 16,
    },
    dietAccessDisabledText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12,
      textAlign: 'center',
    },
    dietAccessDisabledSub: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 4,
      marginBottom: 20,
      textAlign: 'center',
    },
    centeredToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    toggleRowLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    dietPlanSummaryContainer: {
      paddingVertical: 4,
    },
    dietPlanItem: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
    },
    dietPlanLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    dietPlanValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    macroSummaryGrid: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    macroSummaryBox: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderRadius: 14,
      padding: 10,
      alignItems: 'center',
    },
    macroSummaryVal: {
      fontSize: 18,
      fontWeight: '800',
    },
    macroSummaryLbl: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    noDietPlanContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    noDietPlanText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
