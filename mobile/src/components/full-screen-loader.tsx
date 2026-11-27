import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

export function FullScreenLoader({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background">
      <ActivityIndicator color={colors.primary} />
      <Text className="text-body text-muted-foreground">{label}</Text>
    </View>
  );
}
