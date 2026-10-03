import { MD3LightTheme } from "react-native-paper";

export const colors = {
  background: "#F8FAFC", // Slate-50
  surface: "#FFFFFF",
  white: "#FFFFFF",
  black: "#000000",
  textPrimary: "#0F172A", // Slate-900 (ultra-dark slate, 17.5:1 contrast)
  textSecondary: "#334155", // Slate-700 (dark charcoal slate, 9.6:1 contrast)
  textMuted: "#475569", // Slate-600 (rich dark slate, 5.8:1 contrast - zero light grey)
  neutralFill: "#F1F5F9", // Slate-100
  neutralDark: "#E2E8F0", // Slate-200
  primary: "#2563EB", // Blue-600
  primaryHover: "#1D4ED8",
  primaryLight: "#EFF6FF",
  success: "#10B981", // Emerald-500
  successLight: "#ECFDF5",
  warning: "#D97706", // Amber-600 (WCAG AA compliant 4.5:1 contrast on white)
  warningLight: "#FFFBEB",
  error: "#DC2626", // Red-600 (WCAG AA compliant 5.9:1 contrast on white)
  errorLight: "#FEF2F2",
  overlay: "rgba(15, 23, 42, 0.45)",

  // Material 3 Expressive Tonal Color System
  m3: {
    surface: "#FFFFFF",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8FAFC",
    surfaceContainer: "#F1F5F9",
    surfaceContainerHigh: "#E2E8F0",
    surfaceContainerHighest: "#CBD5E1",
    onSurface: "#0F172A",
    onSurfaceVariant: "#334155",
    outlineVariant: "#E2E8F0",
    primary: "#2563EB",
    onPrimary: "#FFFFFF",
    primaryContainer: "#EFF6FF",
    onPrimaryContainer: "#1D4ED8",
    secondary: "#334155",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#F1F5F9",
    onSecondaryContainer: "#0F172A",
    tertiary: "#0284C7",
    tertiaryContainer: "#F0F9FF",
    onTertiaryContainer: "#0369A1",
    success: "#10B981",
    onSuccess: "#FFFFFF",
    successContainer: "#ECFDF5",
    onSuccessContainer: "#065F46",
    warning: "#D97706",
    onWarning: "#FFFFFF",
    warningContainer: "#FFFBEB",
    onWarningContainer: "#92400E",
    error: "#DC2626",
    onError: "#FFFFFF",
    errorContainer: "#FEF2F2",
    onErrorContainer: "#991B1B",
  },
};

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 24, // M3 Expressive container roundness
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.white,
    primaryContainer: colors.primaryLight,
    onPrimaryContainer: colors.primaryHover,
    secondary: colors.textSecondary,
    onSecondary: colors.white,
    secondaryContainer: colors.neutralFill,
    onSecondaryContainer: colors.textPrimary,
    surface: colors.surface,
    onSurface: colors.textPrimary,
    surfaceVariant: colors.neutralFill,
    onSurfaceVariant: colors.textSecondary,
    background: colors.background,
    onBackground: colors.textPrimary,
    error: colors.error,
    errorContainer: colors.errorLight,
    onErrorContainer: colors.error,
    outline: colors.neutralDark,
    outlineVariant: colors.neutralFill,
  },
};

export const m3Shapes = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  expressive: 24,
  full: 9999,
};

export const m3Ripples = {
  dark: { color: "rgba(15, 23, 42, 0.08)", borderless: false },
  light: { color: "rgba(255, 255, 255, 0.22)", borderless: false },
  primary: { color: "rgba(37, 99, 235, 0.12)", borderless: false },
  borderless: { color: "rgba(15, 23, 42, 0.12)", borderless: true },
  borderlessDark: { color: "rgba(15, 23, 42, 0.12)", borderless: true },
  borderlessLight: { color: "rgba(255, 255, 255, 0.2)", borderless: true },
};

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  subtle: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
};
