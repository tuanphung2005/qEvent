import { Tabs } from 'expo-router';
import { RadioIcon, TicketIcon, UserRoundIcon } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { colors } from '@/theme/tokens';

/** Attendee tabs: Vé · Live · Tài khoản (docs/MOBILE_APP_TEAM_SPLIT_3.md §2). */
export default function AttendeeTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="tickets/index"
        options={{
          title: 'Vé',
          tabBarIcon: ({ color }) => <Icon as={TicketIcon} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="live/index"
        options={{
          title: 'Live',
          tabBarIcon: ({ color }) => <Icon as={RadioIcon} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color }) => <Icon as={UserRoundIcon} size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
