import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/lib/utils';

type ScreenProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  scroll?: boolean;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
};

/** Shared shell: canvas background, safe area, and optional scroll for forms. */
export function Screen({
  children,
  className,
  contentClassName,
  scroll = false,
  edges = ['top', 'right', 'bottom', 'left'],
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-background', className)}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={cn('flex-grow p-4', contentClassName)}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View className={cn('flex-1 p-4', contentClassName)}>{children}</View>
      )}
    </SafeAreaView>
  );
}
