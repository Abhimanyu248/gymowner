import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  RefreshControl,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAppStore } from "../store/useAppStore";
import { api } from "../utils/api";
import Button from "../components/Button";
import CustomAlert from "../components/CustomAlert";
import { radius, spacing, typography } from "../theme/theme";
import { useThemeColors } from "../theme/palette";
import { Share2 } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export default function AddEditMemberScreen({ route, navigation }) {
  const { memberId } = route.params || {};
  const {
    members,
    plans,
    addMember,
    updateMember,
    isLoadingData,
    fetchAppData,
  } = useAppStore();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const placeholderColor =
    colors.background === "#141A22" ? "#FFFFFF" : colors.textMuted;

  const existingMember = memberId
    ? members.find((m) => m.id === memberId)
    : null;
  const isEditing = !!existingMember;

  const [form, setForm] = useState({
    name: existingMember?.name || "",
    phone: existingMember?.phone != null ? existingMember.phone.toString() : "",
    email: existingMember?.email || "",
    age: existingMember?.age ? existingMember.age.toString() : "",
    gender: existingMember?.gender || "male",
    address: existingMember?.address || "",
    emergencyContact: existingMember?.emergencyContact != null ? existingMember.emergencyContact.toString() : "",
    planId:
      existingMember?.planId?._id ||
      existingMember?.planId ||
      (plans.length > 0 ? plans[0]._id || plans[0].id : ""),
    photo: existingMember?.photo || existingMember?.imageUrl || "",
    joinDate: existingMember?.joinDate
      ? new Date(existingMember.joinDate)
      : new Date(),
    paymentMethod: "cash",
  });

  const hasSaved = React.useRef(false);

  useEffect(() => {
    // Only check if we are adding a NEW member, the phone number is fully typed (10 digits), and we haven't just saved
    if (!isEditing && form.phone.length === 10 && !hasSaved.current) {
      const existing = members.find(
        (m) => String(m.phone) === String(form.phone),
      );
      if (existing) {
        showAlert(
          "Member Already Registered",
          `A member named "${existing.name}" is already registered with this phone number.`,
          [
            {
              text: "Clear",
              style: "cancel",
              onPress: () => updateForm("phone", ""),
            },
            {
              text: "View Profile",
              onPress: () => {
                // Navigate to detail and remove this screen from history
                navigation.replace("MemberDetail", {
                  memberId: existing.id || existing._id,
                });
              },
            },
          ],
          "warning",
        );
      }
    }
  }, [form.phone, isEditing, members, navigation]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alertConfig, setAlertConfig] = useState({ visible: false });

  const showAlert = (
    title,
    message,
    buttons = [{ text: "OK" }],
    type = "info",
  ) => {
    setAlertConfig({ visible: true, title, message, buttons, type });
  };

  const hideAlert = () =>
    setAlertConfig((prev) => ({ ...prev, visible: false }));

  const updateForm = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleShareInvoice = (payment, memberName, memberPhone) => {
    if (!payment) {
      showAlert(
        "Error",
        "Initial payment record could not be found to generate an invoice.",
        [{ text: "OK", onPress: () => navigation.goBack() }],
        "error",
      );
      return;
    }

    showAlert(
      "Invoice Options",
      `Choose how you would like to share the invoice for Rs ${Number(payment.amount || 0).toLocaleString()}:`,
      [
        {
          text: "Send via WhatsApp",
          onPress: async () => {
            if (!memberPhone) {
              showAlert(
                "Error",
                "Member has no phone number registered.",
                [{ text: "OK", onPress: () => navigation.goBack() }],
                "error",
              );
              return;
            }

            const invoiceUrl = api.getInvoiceUrl(payment._id || payment.id);
            const message = `🏋️‍♂️ *GYM PRO RECEIPT* 🏋️‍♂️\n\n*Dear ${memberName},*\n\nThank you for your payment! Here are your transaction details:\n\n💰 *Amount Paid:* Rs ${Number(payment.amount).toLocaleString()}\n📅 *Date:* ${new Date(payment.paidOn || payment.createdAt).toLocaleDateString("en-IN")}\n💳 *Payment Method:* ${(payment.paymentMethod || "cash").toUpperCase()}\n\n📄 *Download Invoice PDF:* ${invoiceUrl}\n\nKeep grinding! 💪💯`;

            try {
              await Linking.openURL(
                `https://wa.me/+91${memberPhone}?text=${encodeURIComponent(message)}`,
              );
            } catch (err) {
              showAlert(
                "Error",
                "Could not open WhatsApp. Make sure it is installed.",
                [{ text: "OK" }],
                "error",
              );
            } finally {
              navigation.goBack();
            }
          },
        },
        {
          text: "Share PDF Document",
          onPress: async () => {
            setLoading(true);
            try {
              const base64Data = await api.downloadInvoice(
                payment._id || payment.id,
              );
              const fileUri = `${FileSystem.documentDirectory}invoice_${payment._id || payment.id}.pdf`;

              await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
              });

              await Sharing.shareAsync(fileUri, {
                mimeType: "application/pdf",
                dialogTitle: `Share Invoice for ${memberName}`,
              });
            } catch (err) {
              showAlert(
                "Error",
                err.message || "Failed to generate and share invoice PDF",
                [{ text: "OK" }],
                "error",
              );
            } finally {
              setLoading(false);
              navigation.goBack();
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => navigation.goBack(),
        },
      ],
      "action",
    );
  };

  const pickImage = () => {
    showAlert(
      "Select Photo",
      "Choose an option",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            const { granted } =
              await ImagePicker.requestCameraPermissionsAsync();
            if (!granted) {
              setError("Camera permission is required!");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.5,
            });
            if (!result.canceled && result.assets.length > 0) {
              updateForm("photo", result.assets[0].uri);
            }
          },
        },
        {
          text: "Choose from Library",
          onPress: async () => {
            const { granted } =
              await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!granted) {
              setError("Media library permission is required!");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.5,
            });
            if (!result.canceled && result.assets.length > 0) {
              updateForm("photo", result.assets[0].uri);
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      "action",
    );
  };

  const handleSave = async () => {
    if (!form.name || !form.phone || (!isEditing && !form.planId)) {
      showAlert(
        "Error",
        isEditing
          ? "Name and Phone are required fields."
          : "Name, Phone, and Plan are required fields.",
        [{ text: "OK" }],
        "error",
      );
      return;
    }

    setLoading(true);

    let uploadedImageUrl = form.photo;

    // Check if the photo is a local URI and upload it to Supabase first
    if (
      form.photo &&
      (form.photo.startsWith("file://") ||
        form.photo.startsWith("content://") ||
        form.photo.startsWith("ph://"))
    ) {
      try {
        // Step 1: Compress and resize image at client-side to save bandwidth and storage
        const compressedUri = await ImageManipulator.manipulateAsync(
          form.photo,
          [{ resize: { width: 800, height: 900 } }], // Resize profile image to a standardized 500x500
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        )
          .then((res) => res.uri)
          .catch((err) => {
            console.warn(
              "Image manipulation failed, falling back to original uri:",
              err,
            );
            return form.photo;
          });

        // Step 2: Upload the compressed image to backend
        const uploadRes = await api.uploadImage(compressedUri);
        uploadedImageUrl = uploadRes.publicUrl;
      } catch (uploadErr) {
        console.error("Failed to upload profile photo:", uploadErr);
        setLoading(false);
        showAlert(
          "Image Upload Failed",
          uploadErr.message ||
            "An error occurred while uploading the member profile photo. Please try again.",
          [{ text: "OK" }],
          "error",
        );
        return;
      }
    }

    let payload;
    if (isEditing) {
      payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        age: form.age ? parseInt(form.age, 10) : undefined,
        gender: form.gender,
        address: form.address,
        emergencyContact: form.emergencyContact,
        photo: uploadedImageUrl,
        status: existingMember?.status || "active",
        planId: existingMember?.planId?._id || existingMember?.planId,
        joinDate: existingMember?.joinDate,
        expiryDate: existingMember?.expiryDate,
      };
    } else {
      const joinDate = new Date(form.joinDate);
      joinDate.setHours(13, 0, 0, 0);

      let calculatedExpiryDate = new Date();
      const selectedPlan = plans.find(
        (p) => p.id === form.planId || p._id === form.planId,
      );
      if (selectedPlan && selectedPlan.durationMonths) {
        calculatedExpiryDate = new Date(joinDate);
        calculatedExpiryDate.setMonth(
          calculatedExpiryDate.getMonth() + selectedPlan.durationMonths,
        );
        calculatedExpiryDate.setDate(calculatedExpiryDate.getDate() - 1);
        calculatedExpiryDate.setHours(23, 59, 59, 999);
      }

      payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        age: form.age ? parseInt(form.age, 10) : undefined,
        gender: form.gender,
        address: form.address,
        emergencyContact: form.emergencyContact,
        planId: form.planId,
        photo: uploadedImageUrl,
        status: "active",
        joinDate: joinDate.toISOString(),
        expiryDate: calculatedExpiryDate.toISOString(),
        paymentMethod: form.paymentMethod,
      };
    }

    try {
      hasSaved.current = true;
      if (isEditing) {
        await updateMember(memberId, payload);
        setTimeout(
          () =>
            showAlert(
              "Success",
              "Member successfully updated!",
              [{ text: "OK", onPress: () => navigation.goBack() }],
              "success",
            ),
          320,
        );
      } else {
        const createdMember = await addMember(payload);
        setTimeout(() => {
          // Find the newly created member's initial payment
          const latestPayments = useAppStore.getState().payments;
          const initialPayment = latestPayments.find((p) => {
            const pMemberId =
              typeof p.memberId === "object"
                ? p.memberId?._id || p.memberId?.id
                : p.memberId;
            return pMemberId === (createdMember._id || createdMember.id);
          });

          showAlert(
            "Member Added",
            `Member "${form.name}" has been successfully added! Would you like to share their initial membership invoice?`,
            [
              {
                text: "Skip",
                style: "cancel",
                onPress: () => navigation.goBack(),
              },
              {
                text: "Share Invoice",
                onPress: () => {
                  setTimeout(
                    () =>
                      handleShareInvoice(
                        initialPayment,
                        createdMember.name,
                        createdMember.phone,
                      ),
                    100,
                  );
                },
              },
            ],
            "success",
          );
        }, 320);
      }
    } catch (err) {
      hasSaved.current = false;
      showAlert(
        "Error",
        err.message || "Failed to save member",
        [{ text: "OK" }],
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={fetchAppData}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.photoContainer}>
        <TouchableOpacity onPress={pickImage} style={styles.photoBtn}>
          {form.photo ? (
            <Image source={{ uri: form.photo }} style={styles.photo} />
          ) : (
            <Text style={styles.photoPlaceholder}>Add Photo</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Personal Details</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(val) => updateForm("name", val)}
          placeholder="Enter Full Name"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>Phone *</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(val) => updateForm("phone", val)}
          placeholder="Enter Phone Number"
          keyboardType="phone-pad"
          maxLength={10}
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={(val) => updateForm("email", val)}
          placeholder="Enter Email Address"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={placeholderColor}
        />

        {!isEditing && (
          <>
            <Text style={styles.label}>Joining Date *</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>
                {form.joinDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={form.joinDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  if (Platform.OS === "android") {
                    setShowDatePicker(false);
                  }
                  if (selectedDate) {
                    updateForm("joinDate", selectedDate);
                  }
                }}
              />
            )}

            {Platform.OS === "ios" && showDatePicker && (
              <Button
                title="Done"
                onPress={() => setShowDatePicker(false)}
                style={{ marginBottom: spacing.md }}
              />
            )}
          </>
        )}

        <Text style={styles.label}>Gender</Text>
        <View
          style={{ flexDirection: "row", gap: 8, marginBottom: spacing.md }}
        >
          {["male", "female", "other"].map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.genderChip,
                form.gender === g && styles.genderChipActive,
              ]}
              onPress={() => updateForm("gender", g)}
            >
              <Text
                style={[
                  styles.genderChipText,
                  form.gender === g && styles.genderChipTextActive,
                ]}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          value={form.age}
          onChangeText={(val) => updateForm("age", val)}
          placeholder="Enter Age"
          keyboardType="numeric"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={form.address}
          onChangeText={(val) => updateForm("address", val)}
          placeholder="Enter Address"
          placeholderTextColor={placeholderColor}
        />

        <Text style={styles.label}>Emergency Contact</Text>
        <TextInput
          style={styles.input}
          value={form.emergencyContact}
          onChangeText={(val) => updateForm("emergencyContact", val)}
          placeholder="Phone"
          keyboardType="phone-pad"
          maxLength={10}
          placeholderTextColor={placeholderColor}
        />
      </View>

      {!isEditing && (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Membership Plan *</Text>
            {plans.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontStyle: "italic" }}>
                No plans available. Please create a plan first.
              </Text>
            ) : (
              plans.map((plan) => (
                <TouchableOpacity
                  key={plan.id || plan._id}
                  style={[
                    styles.planOption,
                    (form.planId === plan.id || form.planId === plan._id) &&
                      styles.planOptionActive,
                  ]}
                  onPress={() => updateForm("planId", plan.id || plan._id)}
                >
                  <Text
                    style={[
                      styles.planText,
                      (form.planId === plan.id || form.planId === plan._id) &&
                        styles.planTextActive,
                    ]}
                  >
                    {plan.name}
                  </Text>
                  <Text
                    style={[
                      styles.planText,
                      (form.planId === plan.id || form.planId === plan._id) &&
                        styles.planTextActive,
                    ]}
                  >
                    ₹{plan.amount}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["cash", "upi", "bank_transfer"].map(
                (method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.genderChip,
                      { flex: 0, paddingHorizontal: spacing.md },
                      form.paymentMethod === method && styles.genderChipActive,
                    ]}
                    onPress={() => updateForm("paymentMethod", method)}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        form.paymentMethod === method &&
                          styles.genderChipTextActive,
                      ]}
                    >
                      {method === "upi"
                        ? "UPI"
                        : method
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
          </View>
        </>
      )}

      <Button
        title={isEditing ? "Update Member" : "Save Member"}
        onPress={handleSave}
        loading={loading}
        style={styles.saveBtn}
      />

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

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.md,
    },
    photoContainer: {
      alignItems: "center",
      marginVertical: spacing.md,
    },
    photoBtn: {
      width: 100,
      height: 100,
      borderRadius: radius.full,
      backgroundColor: `${colors.accent}20`,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    photo: {
      width: "100%",
      height: "100%",
    },
    photoPlaceholder: {
      color: colors.accent,
      fontWeight: "600",
    },
    card: {
      backgroundColor: colors.surface,
      padding: spacing.md,
      borderRadius: radius.card,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      ...typography.heading,
      fontSize: typography.sizes.md,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    label: {
      ...typography.body,
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: 4,
      fontWeight: "500",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      height: 44,
      marginBottom: spacing.md,
      color: colors.textPrimary,
    },
    dateInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      height: 44,
      marginBottom: spacing.md,
      justifyContent: "center",
    },
    dateText: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
    },
    planOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      marginBottom: spacing.sm,
    },
    planOptionActive: {
      borderColor: colors.accent,
      backgroundColor: `${colors.accent}10`,
    },
    planText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    planTextActive: {
      color: colors.accent,
      fontWeight: "700",
    },
    errorText: {
      color: colors.danger,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    genderChip: {
      flex: 1,
      height: 38,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    genderChipActive: {
      borderColor: colors.accent,
      backgroundColor: `${colors.accent}15`,
    },
    genderChipText: {
      color: colors.textSecondary,
      fontWeight: "600",
      fontSize: 13,
    },
    genderChipTextActive: {
      color: colors.accent,
    },
    saveBtn: {
      marginTop: spacing.sm,
    },
    loadingInline: {
      marginTop: spacing.sm,
      alignItems: "center",
    },
  });
