import { View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/**
 * PLACEHOLDER owned by Vũ (docs §7.3 S1). Replace with event/gate selection,
 * cache download and the scanner.
 */
export default function StaffEventsPlaceholder() {
  const { user, logout } = useAuth();

  return (
    <Screen contentClassName="justify-center gap-4">
      <Text className="text-title text-foreground">Cổng soát vé</Text>
      <Text className="text-body text-muted-foreground">
        Khu vực staff đang được Vũ dựng: chọn sự kiện/cổng, tải cache, quét QR, hàng đợi offline.
      </Text>
      <View className="gap-2">
        <Text className="text-label text-muted-foreground">
          {user?.fullName} · {user?.role}
        </Text>
        <Button variant="outline" onPress={logout}>
          <Text>Đăng xuất</Text>
        </Button>
      </View>
    </Screen>
  );
}
