import { useAppStore } from '../store/useAppStore';
import { colors as lightColors } from './theme';

export const darkColors = {
  primary: '#00D26A',
  secondary: '#EAB308',
  accent: '#00D26A',
  danger: '#FF3B4D',
  warning: '#EAB308',
  success: '#00D26A',
  background: '#141A22',
  surface: '#1D232D',
  surfaceAlt: '#252B35',
  surfaceTint: '#252B35',
  glass: 'rgba(255,255,255,0.05)',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#7C8798',
  textInverted: '#FFFFFF',
  border: '#2F3744',
  borderGlow: '#3A4352',
};

export const getThemeColors = (mode) => (mode === 'dark' ? darkColors : lightColors);

export const useThemeColors = () => {
  const themeMode = useAppStore((state) => state.themeMode);
  return getThemeColors(themeMode);
};

