import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/**
 * Attendee shell: a stack so ticket/QR/live detail screens hide the tab bar and
 * pop back to the tab the attendee came from.
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
