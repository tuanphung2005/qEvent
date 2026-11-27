import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/**
 * PLACEHOLDER shell owned by Thành (docs/MOBILE_APP_TEAM_SPLIT_3.md §7.2 A1).
 * Replace with the bottom-tab layout when attendee screens land.
 */
export default function AttendeeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
