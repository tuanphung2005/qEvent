import { AlertCircleIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  title = 'Không tải được dữ liệu',
  message,
  onRetry,
  retryLabel = 'Thử lại',
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6">
      <View className="size-12 items-center justify-center rounded-full bg-destructive/10">
        <Icon as={AlertCircleIcon} className="size-6 text-destructive-strong" />
      </View>
      <Text className="text-center text-section text-foreground">{title}</Text>
      {message ? (
        <Text className="text-center text-body text-muted-foreground">{message}</Text>
      ) : null}
      {onRetry ? (
        <Button className="mt-2 min-h-12" onPress={onRetry}>
          <Text>{retryLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
