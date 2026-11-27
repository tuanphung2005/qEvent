import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Không tìm thấy' }} />
      <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
        <Text className="text-section text-foreground">Màn hình này không tồn tại.</Text>
        <Link href="/">
          <Text className="text-body text-primary">Về trang chính</Text>
        </Link>
      </View>
    </>
  );
}
