import { View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/**
 * PLACEHOLDER owned by Thành (docs §7.2 A2). Replace with the real ticket list.
 * Exists so the Tuấn foundation can demo login/role/session end to end.
 */
export default function AttendeeTicketsPlaceholder() {
  const { user, logout } = useAuth();

  return (
    <Screen contentClassName="justify-center gap-4">
      <Text className="text-title text-foreground">Xin chào, {user?.fullName}</Text>
      <Text className="text-body text-muted-foreground">
        Khu vực attendee đang được Thành dựng: danh sách vé, QR động, live Q&A/poll/quiz.
      </Text>
      <View className="gap-2">
        <Text className="text-label text-muted-foreground">Vai trò: {user?.role}</Text>
        <Button variant="outline" onPress={logout}>
          <Text>Đăng xuất</Text>
        </Button>
      </View>
    </Screen>
  );
}
