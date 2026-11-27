import { useNetworkState } from 'expo-network';
import { WifiOffIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/**
 * Always-on connectivity banner. Staff need to know a scan is queued before
 * they read the result colour, not after.
 */
export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkState();
  const insets = useSafeAreaInsets();
  const offline = isConnected === false || isInternetReachable === false;

  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      style={{ paddingTop: insets.top }}
      className="absolute inset-x-0 top-0 z-50 bg-warning px-4 pb-2">
      <View className="flex-row items-center justify-center gap-2">
        <Icon as={WifiOffIcon} className="size-4 text-warning-foreground" />
        <Text className="text-label text-warning-foreground">
          Không có kết nối — thao tác sẽ được xếp hàng
        </Text>
      </View>
    </View>
  );
}
