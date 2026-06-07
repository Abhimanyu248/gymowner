// ─── EARTHY MODERN GYM THEME ───────────────────────────────────────────────
// Warm light beige base · Deep Teal primary · Burnt Orange accent
// Highly rounded corners, soft shadows, and high contrast typography

export const colors = {
  // Core palette
  primary:    '#1F3C34',   // Deep Teal/Dark Green
  secondary:  '#D17934',   // Burnt Orange/Rust
  accent:     '#D17934',   // Burnt Orange/Rust (Secondary action/Active)
  danger:     '#C9483B',   // Deep Red
  warning:    '#E08A1E',   // Bright Orange
  success:    '#2E9B5F',   // Vibrant Green

  // Backgrounds
  background: '#F4EFE7',   // Main App Background (Safe Area)
  surface:    '#FFFDF9',   // Panels & Cards (Primary)
  surfaceAlt: '#F8F3EC',   // Secondary Surfaces (Inputs, Stats Cards)
  surfaceTint: '#E8F1EB',  // Light tint for chips
  glass:      'rgba(255,255,255,0.05)',

  // Text
  textPrimary:   '#1D2A24',  // Primary Heading/Text
  textSecondary: '#625A4F',  // Subtitles & Secondary Text
  textMuted:     '#8A8174',  // Hints / very muted
  textInverted:  '#FFFFFF',  // Inverted text for dark buttons

  // Borders & dividers
  border:       '#E3DACE',   // Soft border
  borderGlow:   '#E9E0D4', 
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  heading: {
    fontFamily: 'System',
    fontWeight: '800',
  },
  body: {
    fontFamily: 'System',
    fontWeight: '600',
  },
  label: {
    fontFamily: 'System',
    fontWeight: '700',
  },
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
};

export const radius = {
  xs:   6,
  sm:   10,
  btn:  18,
  card: 24,
  lg:   24,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  glow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
};

export const gradientBorder = {
  borderWidth: 1,
  borderColor: '#E3DACE',
};
