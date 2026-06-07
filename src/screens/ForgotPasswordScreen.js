import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ImageBackground, Animated, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Button from '../components/Button';
import { radius, spacing, shadows } from '../theme/theme';
import { useThemeColors } from '../theme/palette';
import { api } from '../utils/api';
import { ChevronLeft } from 'lucide-react-native';

const BACKGROUND_IMAGE = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY]);

  const handleSendOtp = async () => {
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.forgotPassword(email);
      setSuccess(res.message || 'OTP sent successfully.');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp || !newPassword || !confirmPassword) {
      setError('Please enter OTP, new password, and confirm password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.resetPassword(email, otp, newPassword);
      setSuccess(res.message || 'Password reset successfully.');
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <ImageBackground 
        source={{ uri: BACKGROUND_IMAGE }} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        <SafeAreaView style={styles.safeAreaContent}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
          >
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft color="#fff" size={28} />
            </TouchableOpacity>

            <Animated.View style={[styles.brand, { opacity: fadeAnim, transform: [{ translateY }] }]}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>💪</Text>
              </View>
              <Text style={styles.brandName}>GymPro</Text>
            </Animated.View>

            <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY }] }]}>
              <Text style={styles.title}>{step === 1 ? 'Forgot Password' : 'Reset Password'}</Text>
              <Text style={styles.subtitle}>
                {step === 1 
                  ? 'Enter your email to receive an OTP.' 
                  : 'Enter the OTP sent to your email and your new password.'}
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {success ? <Text style={styles.successText}>{success}</Text> : null}

              {step === 1 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="admin@gym.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              )}

              {step === 2 && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>OTP</Text>
                    <TextInput
                      style={styles.input}
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="123456"
                      keyboardType="numeric"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="••••••••"
                      secureTextEntry
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      secureTextEntry
                      placeholderTextColor={colors.textMuted}
                    />
                    {confirmPassword ? (
                      <Text style={[
                        styles.indicatorText,
                        newPassword === confirmPassword ? styles.matchText : styles.mismatchText
                      ]}>
                        {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </Text>
                    ) : null}
                  </View>
                </>
              )}

              <Button
                title={step === 1 ? 'Send OTP' : 'Reset Password'}
                onPress={step === 1 ? handleSendOtp : handleResetPassword}
                loading={loading}
                style={styles.submitBtn}
              />
              
              {step === 2 && (
                <Button
                  title="Resend OTP"
                  variant="secondary"
                  onPress={handleSendOtp}
                  disabled={loading}
                  style={styles.resendBtn}
                />
              )}
            </Animated.View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  safeAreaContent: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    zIndex: 10,
    padding: spacing.xs,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.glow,
  },
  logoText: {
    fontSize: 32,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: `${colors.danger}15`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  successText: {
    color: colors.success,
    marginBottom: spacing.md,
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: `${colors.success}15`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    fontSize: 15,
  },
  submitBtn: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  resendBtn: {
    marginTop: spacing.sm,
  },
  indicatorText: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '500',
  },
  matchText: {
    color: colors.success,
  },
  mismatchText: {
    color: colors.danger,
  }
});
