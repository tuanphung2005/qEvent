import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { serverNow } from '@/api/client';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';
import { remainingSeconds } from '../lib';

type QrCountdownProps = {
  expiresAt: number;
  totalSeconds: number;
  onExpire?: () => void;
};

/**
 * Counts down the server-signed QR lifetime. Refetch is owned by the caller's
 * query interval; this only reports when the last second is gone.
 */
export function QrCountdown({ expiresAt, totalSeconds, onExpire }: QrCountdownProps) {
  const [now, setNow] = useState(() => serverNow());
  const expiredFor = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 1_000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const seconds = remainingSeconds(expiresAt, now);
  const ratio =
    totalSeconds > 0 ? Math.min(1, Math.max(0, seconds / totalSeconds)) : 0;

  useEffect(() => {
    if (seconds > 0 || expiredFor.current === expiresAt) return;
    expiredFor.current = expiresAt;
    onExpireRef.current?.();
  }, [seconds, expiresAt]);

  return (
    <View className="gap-2">
      <View className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <View
          className="h-full rounded-full"
          style={{
            width: `${ratio * 100}%`,
            backgroundColor: seconds <= 5 ? colors.error : colors.primary,
          }}
        />
      </View>
      <Text
        accessibilityLiveRegion="polite"
        className="text-center text-label text-muted-foreground">
        {seconds > 0 ? `Mã làm mới sau ${seconds} giây` : 'Đang lấy mã mới…'}
      </Text>
    </View>
  );
}
