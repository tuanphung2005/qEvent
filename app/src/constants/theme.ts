import { MD3LightTheme } from "react-native-paper";

// Google Material 3 Expressive Tonal Palette (Seed: Vibrant Indigo-Blue #1A56DB)
export const colors = {
  // Canvas & Surfaces
  background: "#F8F9FE", // Soft tinted Material 3 canvas (never cold sterile slate)
  surface: "#FFFFFF",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(15, 23, 42, 0.45)",

  // Typography - High Contrast M3 onSurface
  textPrimary: "#191C20", // M3 onSurface (high contrast ~17:1)
  textSecondary: "#43474E", // M3 onSurfaceVariant (~9:1)
  textMuted: "#73777F", // M3 outline (~5:1)

  // Neutral Fills & Tonal Containers
  neutralFill: "#EEF2FA", // surfaceContainer
  neutralDark: "#E2E7F2", // surfaceContainerHigh

  // Primary Brand Tones
  primary: "#1A56DB", // Vibrant Material Blue
  primaryHover: "#1545B3",
  primaryLight: "#E0EAFF", // primaryContainer

  // Semantic Status Tones (M3 Harmonized)
  success: "#00875A", // Emerald
  successLight: "#D1FADF", // successContainer
  warning: "#B54708", // Amber
  warningLight: "#FEF0C7", // warningContainer
  error: "#BA1A1A", // M3 Error Red
  errorLight: "#FFDAD6", // errorContainer

  // Material 3 Expressive System Roles
  m3: {
    surface: "#FFFFFF",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F2F4FB",
    surfaceContainer: "#ECF0F8",
    surfaceContainerHigh: "#E5EAF4",
    surfaceContainerHighest: "#DFE4EE",
    onSurface: "#191C20",
    onSurfaceVariant: "#43474E",
    outline: "#73777F",
    outlineVariant: "#C3C6CF",

    primary: "#1A56DB",
    onPrimary: "#FFFFFF",
    primaryContainer: "#E0EAFF",
    onPrimaryContainer: "#00174C",

    secondary: "#535E71",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#D9E3F8",
    onSecondaryContainer: "#101B2C",

    tertiary: "#6E5676",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#F7D8FE",
    onTertiaryContainer: "#271430",

    success: "#00875A",
    onSuccess: "#FFFFFF",
    successContainer: "#D1FADF",
    onSuccessContainer: "#024C33",

    warning: "#B54708",
    onWarning: "#FFFFFF",
    warningContainer: "#FEF0C7",
    onWarningContainer: "#712B03",

    error: "#BA1A1A",
    onError: "#FFFFFF",
    errorContainer: "#FFDAD6",
    onErrorContainer: "#410002",
  },
};

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 24, // M3 Expressive container roundness
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.white,
    primaryContainer: colors.m3.primaryContainer,
    onPrimaryContainer: colors.m3.onPrimaryContainer,

    secondary: colors.m3.secondary,
    onSecondary: colors.white,
    secondaryContainer: colors.m3.secondaryContainer,
    onSecondaryContainer: colors.m3.onSecondaryContainer,

    tertiary: colors.m3.tertiary,
    onTertiary: colors.white,
    tertiaryContainer: colors.m3.tertiaryContainer,
    onTertiaryContainer: colors.m3.onTertiaryContainer,

    surface: colors.surface,
    onSurface: colors.textPrimary,
    surfaceVariant: colors.m3.surfaceContainer,
    onSurfaceVariant: colors.textSecondary,

    background: colors.background,
    onBackground: colors.textPrimary,

    error: colors.error,
    onError: colors.white,
    errorContainer: colors.errorLight,
    onErrorContainer: colors.m3.onErrorContainer,

    outline: colors.m3.outline,
    outlineVariant: colors.m3.outlineVariant,

    elevation: {
      level0: "transparent",
      level1: "#FFFFFF",
      level2: "#FFFFFF",
      level3: "#FFFFFF",
      level4: "#FFFFFF",
      level5: "#FFFFFF",
    },
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
  card: 28,
  full: 9999,
};

export const m3Ripples = {
  dark: { color: "rgba(25, 28, 32, 0.08)", borderless: false },
  light: { color: "rgba(255, 255, 255, 0.24)", borderless: false },
  primary: { color: "rgba(26, 86, 219, 0.14)", borderless: false },
  borderless: { color: "rgba(25, 28, 32, 0.12)", borderless: true },
  borderlessDark: { color: "rgba(25, 28, 32, 0.12)", borderless: true },
  borderlessLight: { color: "rgba(255, 255, 255, 0.2)", borderless: true },
};

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
  },
  subtle: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
};
