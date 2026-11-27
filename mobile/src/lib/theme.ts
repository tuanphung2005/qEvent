import { DefaultTheme, type Theme } from 'expo-router/react-navigation';

import { colors } from '@/theme/tokens';

/** qEvent mobile is light-only; dark theme is intentionally not shipped. */
export const NAV_THEME: Record<'light', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: colors.background,
      border: colors.border,
      card: colors.card,
      notification: colors.error,
      primary: colors.primary,
      text: colors.text,
    },
  },
};
