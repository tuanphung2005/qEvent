import { LogOutIcon, ShieldCheckIcon, UserRoundIcon } from 'lucide-react-native';
import { Alert, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Screen } from '@/components/screen';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Role } from '@/api/types';

const ROLE_LABEL: Record<Role, string> = {
  ATTENDEE: 'Khán giả',
  STAFF: 'Nhân viên soát vé',
  ORGANIZER: 'Ban tổ chức',
  HOST: 'Host',
};

function initials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn sẽ cần đăng nhập lại để xem vé và tham gia phiên live.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <Screen scroll contentClassName="gap-4 pb-8">
      <View className="gap-1">
        <Text className="text-display text-foreground">Tài khoản</Text>
        <Text className="text-body text-muted-foreground">
          Thông tin đăng nhập và phiên làm việc trên thiết bị này.
        </Text>
      </View>

      <View className="items-center gap-3 rounded-card bg-card px-6 py-8 shadow-sm shadow-black/5">
        <Avatar alt="Ảnh đại diện" className="size-16">
          <AvatarFallback className="bg-primary/10">
            <Text className="text-title text-primary">{initials(user?.fullName)}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="items-center gap-1">
          <Text className="text-section text-foreground">{user?.fullName ?? '—'}</Text>
          <Text className="text-body text-muted-foreground">{user?.email ?? '—'}</Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-badge bg-secondary px-2 py-1">
          <Icon as={ShieldCheckIcon} className="size-4 text-muted-foreground" />
          <Text className="text-label text-foreground">
            {user ? ROLE_LABEL[user.role] : '—'}
          </Text>
        </View>
      </View>

      <View className="gap-3 rounded-card bg-card p-4 shadow-sm shadow-black/5">
        <View className="flex-row items-center gap-2">
          <Icon as={UserRoundIcon} className="size-4 text-muted-foreground" />
          <Text className="text-body text-foreground">Phiên đăng nhập</Text>
        </View>
        <Text className="text-body text-muted-foreground">
          Mã QR vé được máy chủ ký và làm mới mỗi 30 giây. Không chia sẻ mã cho người khác.
        </Text>
      </View>

      <Button
        variant="outline"
        className="min-h-12"
        accessibilityLabel="Đăng xuất"
        onPress={confirmLogout}>
        <Icon as={LogOutIcon} className="size-5 text-secondary-foreground" />
        <Text>Đăng xuất</Text>
      </Button>
    </Screen>
  );
}
