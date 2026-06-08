import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Platform, TouchableOpacity, Linking, Modal, Pressable, RefreshControl, Animated, Easing, BackHandler } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Phone, MessageCircle, UserRound, ChevronRight, CalendarDays, MapPin, Activity, AlertCircle, Bell, Key, UserRoundPen, Share2, Mail } from 'lucide-react-native';
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
  const [loading, setLoading] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [renewForm, setRenewForm] = useState({ membershipType: '', joinDate: '', paymentMethod: 'cash' });
  const [renewError, setRenewError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const [activeTab, setActiveTab] = useState('details');
  const [showRenewSheet, setShowRenewSheet] = useState(false);
  const renewSheetY = React.useRef(new Animated.Value(520)).current;

  const showAlert = (title, message, buttons = [{ text: 'OK' }], type = 'info', icon) => {
    setAlertConfig({ visible: true, title, message, buttons, type, icon });
  };

  const hideAlert = () => setAlertConfig((prev) => ({ ...prev, visible: false }));

  const [credLoading, setCredLoading] = useState(false);

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
              const message = `🏋️‍♂️ *GYM PORTAL CREDENTIALS* 🏋️‍♂️\n\n*Dear ${member.name},*\n\nHere are your login credentials for the Gym Member Portal:\n\n👤 *Login ID:* ${res.loginId}\n🔑 *Password:* ${res.password}\n\nKeep grinding! 💪💯`;
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

  const member = members.find((m) => m.id === memberId) || deletedMembers.find((m) => m.id === memberId);

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

      await addPayment({
        memberId: member.id,
        amount: pickedPlan.amount || pickedPlan.price || 0,
        paymentMethod: renewForm.paymentMethod || 'cash',
        notes: `Renewal for ${member.name} (${pickedPlan.name})`,
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
            const message = `🏋️‍♂️ *GYM PRO RECEIPT* 🏋️‍♂️\n\n*Dear ${member.name},*\n\nThank you for your payment! Here are your transaction details:\n\n💰 *Amount Paid:* Rs ${Number(payment.amount).toLocaleString()}\n📅 *Date:* ${formatDate(payment.paidOn || payment.createdAt)}\n💳 *Payment Method:* ${(payment.paymentMethod || 'cash').toUpperCase()}\n\n📄 *Download Invoice PDF:* ${invoiceUrl}\n\nKeep grinding! 💪💯`;

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
      ? `🌟 ══════════════════ 🌟
   *MEMBERSHIP EXPIRED*   
🌟 ══════════════════ 🌟

🏋️‍♂️ *Dear ${member.name},*

We noticed your gym membership expired on *${expiryDate}*.

💪 *Don't lose your momentum!* 
It's time to get back on track and crush your fitness goals! 🚀

📌 *Member ID:* #${memberCode}
📅 *Expiry Date:* ${expiryDate}
🔴 *Status:* Expired

👉 *Reply to this message or visit the gym to renew!*
Let's get back to work! 💯`
      : `🌟 ══════════════════ 🌟
   *RENEWAL REMINDER*     
🌟 ══════════════════ 🌟

🏋️‍♂️ *Dear ${member.name},*

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
        {member.photo || member.imageUrl ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setShowImagePreview(true)}>
            <Image source={{ uri: member.photo || member.imageUrl }} style={styles.avatar} />
          </TouchableOpacity>
        ) : (
          <View style={styles.avatarPlaceholder}>
            <UserRound color={colors.textMuted} size={78} />
          </View>
        )}
        <Text style={styles.name}>{member.name}</Text>
        <View style={styles.idPill}>
          <Text style={styles.idPillLabel}>MEMBER ID</Text>
          <Text style={styles.idPillValue}>#{(member._id).slice(-5).toUpperCase()}</Text>
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

        <View style={styles.metricActions}>
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>TOTAL PAYMENTS</Text>
            <Text style={styles.metricValue}>Rs {totalPaymentAmount.toLocaleString()}</Text>
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
          <TouchableOpacity onPress={() => setActiveTab('details')}>
            <Text style={activeTab === 'details' ? styles.activeTab : styles.inactiveTab}>Details</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('payments')}>
            <Text style={activeTab === 'payments' ? styles.activeTab : styles.inactiveTab}>Payments</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.activeUnderline, activeTab === 'payments' && styles.activeUnderlinePayments]} />

        {activeTab === 'details' ? (
          <>
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
          </>
        ) : (
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
        )}
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


      {showRenewSheet && (
        <View style={styles.renewOverlay}>
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
        </View>
      )}
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
    tabsRow: {
      flexDirection: 'row',
      gap: 24,
      marginBottom: 7,
    },
    activeTab: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
    inactiveTab: {
      color: colors.textMuted,
      fontWeight: '600',
      fontSize: 14,
    },
    activeUnderline: {
      width: 60,
      height: 3,
      borderRadius: 3,
      backgroundColor: colors.textPrimary,
      marginBottom: 12,
    },
    activeUnderlinePayments: {
      marginLeft: 70,
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
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
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
  });
