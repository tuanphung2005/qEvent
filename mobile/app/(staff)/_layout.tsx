import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/**
 * PLACEHOLDER shell owned by Vũ (docs/MOBILE_APP_TEAM_SPLIT_3.md §7.3 S1).
 * Replace with the bottom-tab layout when gate screens land.
 */
export default function StaffLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
