import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WifiOff, ServerCrash } from 'lucide-react-native';
import { useThemeColors } from '../theme/palette';
import { useAppStore } from '../store/useAppStore';
import { shadows } from '../theme/theme';

const NetworkErrorScreen = () => {
  const colors = useThemeColors();
  const [isRetrying, setIsRetrying] = useState(false);
  
  const isNetworkError = useAppStore(state => state.isNetworkError);
  const networkErrorMessage = useAppStore(state => state.networkErrorMessage);
  const retryConnection = useAppStore(state => state.retryConnection);

  if (!isNetworkError) return null;

  const isNoInternet = networkErrorMessage.toLowerCase().includes('internet');

  const handleRetry = async () => {
    setIsRetrying(true);
    await retryConnection();
    setIsRetrying(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconContainer, { backgroundColor: `${colors.error}15` }]}>
        {isNoInternet ? (
          <WifiOff size={48} color={colors.error} />
        ) : (
          <ServerCrash size={48} color={colors.error} />
        )}
      </View>
      
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {isNoInternet ? 'No Internet Connection' : 'Server Unreachable'}
      </Text>
      
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {isNoInternet 
          ? 'Please check your network settings and try again.'
          : 'Our servers are currently experiencing issues. We are working to resolve this.'}
      </Text>
      
      <TouchableOpacity 
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
        onPress={handleRetry}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.retryText}>Retry Connection</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10000, // Make sure it sits on top of everything
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    ...shadows.medium,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NetworkErrorScreen;
