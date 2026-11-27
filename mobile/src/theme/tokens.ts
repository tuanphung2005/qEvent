/**
 * Runtime tokens for APIs that cannot take a Tailwind class (camera overlays,
 * QR SVG, StatusBar, navigation theme). Keep in sync with src/global.css.
 */
export const colors = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#475569',
  primary: '#2563EB',
  primaryForeground: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#E2E8F0',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  card: 12,
  control: 10,
  badge: 4,
} as const;

/** Downward-only elevation. No blur, no borders (DESIGN.md mobile rules). */
export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

/** Minimum hit target for gate use (gloves, one hand, bright light). */
export const MIN_TOUCH = 48;
export const MIN_GATE_ACTION = 56;
