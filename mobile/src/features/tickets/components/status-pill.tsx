import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { StatusTone } from '../lib';

const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  neutral: 'bg-muted-foreground',
};

/** Status is always a dot + label, never bare coloured text (DESIGN.md). */
export function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-badge bg-secondary px-2 py-1">
      <View className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
      <Text className="text-label text-foreground">{label}</Text>
    </View>
  );
}
