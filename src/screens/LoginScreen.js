import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ImageBackground, Animated, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import Button from '../components/Button';
import { radius, spacing, shadows } from '../theme/theme';
import { useThemeColors } from '../theme/palette';
import { api } from '../utils/api';

const BACKGROUND_IMAGE = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop';

export default function LoginScreen() {
  const login = useAppStore((state) => state.login);
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [isLogin, setIsLogin]   = useState(true);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Simple entry animation for the form card
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

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !name)) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await api.register(name, email, password);
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Check your connection.');
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
            {/* Logo / Branding */}
            <Animated.View style={[styles.brand, { opacity: fadeAnim, transform: [{ translateY }] }]}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>💪</Text>
              </View>
              <Text style={styles.brandName}>GymPro</Text>
              <Text style={styles.brandTagline}>Your gym. Your data.</Text>
            </Animated.View>

            <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY }] }]}>
              <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Admin'}</Text>
              <Text style={styles.subtitle}>
                {isLogin ? 'Sign in to manage your gym.' : 'Set up the master account.'}
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {!isLogin && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Admin Name"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              )}

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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {isLogin && (
                <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPasswordContainer}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              <Button
                title={isLogin ? 'Sign In' : 'Register'}
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitBtn}
              />
              <Button
                title={isLogin ? 'Create an account' : 'Back to Sign In'}
                variant="secondary"
                onPress={() => { setIsLogin(!isLogin); setError(''); }}
                disabled={loading}
              />
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
  brandTagline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  forgotPasswordText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
