import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeftIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  engagementKeys,
  usePolls,
  type Poll,
  type PollsResponse,
} from '@/features/engagement/data';
import {
  connectionNote,
  engagementErrorText,
  pollPercent,
  pollTotal,
} from '@/features/engagement/lib';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { cn } from '@/lib/utils';

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : (value?.[0] ?? '');
}

function PollCard({
  poll,
  disabled,
  onVote,
}: {
  poll: Poll;
  disabled: boolean;
  onVote: (optionId: string) => void;
}) {
  const total = pollTotal(poll);
  const closed = !poll.isActive;

  return (
    <View className="gap-3 rounded-card bg-card p-4 shadow-sm shadow-black/5">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-section text-foreground">{poll.title}</Text>
        <View className="flex-row items-center gap-1.5 rounded-badge bg-secondary px-2 py-1">
          <View
            className={cn('size-1.5 rounded-full', closed ? 'bg-muted-foreground' : 'bg-success')}
          />
          <Text className="text-label text-foreground">
            {closed ? 'Đã đóng' : 'Đang mở'}
          </Text>
        </View>
      </View>

      <View className="gap-2">
        {poll.options.map((option) => {
          const selected = poll.userVotedOptionId === option.id;
          const percent = pollPercent(option.voteCount, total);
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`${option.content}, ${option.voteCount} phiếu`}
              accessibilityState={{ selected, disabled: closed || disabled }}
              disabled={closed || disabled}
              onPress={() => onVote(option.id)}
              className={cn(
                'min-h-12 flex-row items-center gap-2 overflow-hidden rounded-control bg-secondary px-3 py-2 active:opacity-70',
                selected && 'bg-primary/10',
                (closed || disabled) && 'opacity-70'
              )}>
              <View
                className="absolute inset-y-0 left-0 bg-primary/10"
                style={{ width: `${percent}%` }}
              />
              <Icon
                as={selected ? CheckCircle2Icon : BarChart3Icon}
                className={cn(
                  'size-4',
                  selected ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <Text
                className={cn(
                  'flex-1 text-body',
                  selected ? 'text-primary' : 'text-foreground'
                )}>
                {option.content}
              </Text>
              <Text className="text-label text-muted-foreground">
                {option.voteCount} · {percent}%
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-label text-muted-foreground">{total} lượt bình chọn</Text>
        <Text className="text-label text-muted-foreground">
          {closed ? 'Không nhận thêm phiếu' : 'Chạm lại để bỏ phiếu'}
        </Text>
      </View>
    </View>
  );
}

export default function PollsScreen() {
  const params = useLocalSearchParams<{ sessionId: string; title?: string }>();
  const sessionId = param(params.sessionId);
  const sessionTitle = param(params.title);

  const queryClient = useQueryClient();
  const polls = usePolls(sessionId);
  const listKey = engagementKeys.polls(sessionId);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: listKey });

  const realtime = useRealtime({
    path: '/ws/qa',
    enabled: Boolean(sessionId),
    joinKey: sessionId,
    join: () => ({ type: 'JOIN_SESSION', sessionId }),
    onEvent: refresh,
    onPoll: refresh,
    onReconnect: refresh,
  });

  const vote = useMutation({
    mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      const result = await api.POST('/api/polls/{pollId}/vote', {
        params: { path: { pollId } },
        body: { optionId },
      });
      return unwrap(result);
    },
    onMutate: async ({ pollId, optionId }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<PollsResponse>(listKey);
      if (previous) {
        queryClient.setQueryData<PollsResponse>(listKey, {
          ...previous,
          polls: previous.polls.map((poll) => {
            if (poll.id !== pollId) return poll;
            const current = poll.userVotedOptionId ?? null;
            return {
              ...poll,
              userVotedOptionId: current === optionId ? null : optionId,
              options: poll.options.map((option) => {
                if (option.id === optionId) {
                  return {
                    ...option,
                    voteCount: Math.max(
                      0,
                      option.voteCount + (current === optionId ? -1 : 1)
                    ),
                  };
                }
                if (current === option.id) {
                  return { ...option, voteCount: Math.max(0, option.voteCount - 1) };
                }
                return option;
              }),
            };
          }),
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
      setActionError(engagementErrorText(error));
    },
    onSettled: () => refresh(),
  });

  const note = connectionNote(realtime);

  return (
    <Screen contentClassName="p-0" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => router.back()}
          className="size-12 items-center justify-center rounded-control bg-card shadow-sm shadow-black/5 active:bg-secondary">
          <Icon as={ArrowLeftIcon} className="size-5 text-foreground" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-title text-foreground" numberOfLines={1}>
            Bình chọn
          </Text>
          {sessionTitle ? (
            <Text className="text-label text-muted-foreground" numberOfLines={1}>
              {sessionTitle}
            </Text>
          ) : null}
        </View>
      </View>

      {polls.isError ? (
        <ErrorState
          title="Không mở được bình chọn"
          message={polls.error instanceof Error ? polls.error.message : undefined}
          onRetry={() => polls.refetch()}
        />
      ) : (
        <FlatList
          data={polls.data?.polls ?? []}
          keyExtractor={(poll) => poll.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
          ListHeaderComponent={
            <View className="gap-2">
              {note ? (
                <View
                  className={cn(
                    'flex-row items-center gap-2 rounded-control px-3 py-2',
                    note.tone === 'success' ? 'bg-success/10' : 'bg-warning/10'
                  )}>
                  <Icon
                    as={note.tone === 'success' ? WifiIcon : WifiOffIcon}
                    className={cn(
                      'size-4',
                      note.tone === 'success' ? 'text-success' : 'text-warning-foreground'
                    )}
                  />
                  <Text className="flex-1 text-label text-foreground">{note.label}</Text>
                </View>
              ) : null}
              {actionError ? (
                <View className="flex-row items-start gap-2 rounded-control bg-destructive/10 px-3 py-2">
                  <Icon as={WifiOffIcon} className="mt-0.5 size-4 text-destructive-strong" />
                  <Text className="flex-1 text-label text-destructive-strong">{actionError}</Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            polls.isLoading ? (
              <View className="gap-3 pt-2">
                <Skeleton className="h-32 rounded-card" />
                <Skeleton className="h-32 rounded-card" />
              </View>
            ) : (
              <View className="items-center gap-2 rounded-card bg-card px-6 py-10 shadow-sm shadow-black/5">
                <View className="size-14 items-center justify-center rounded-full bg-secondary">
                  <Icon as={BarChart3Icon} className="size-7 text-muted-foreground" />
                </View>
                <Text className="text-section text-foreground">Chưa có bình chọn</Text>
                <Text className="text-center text-body text-muted-foreground">
                  Host chưa tạo bình chọn cho phiên này. Kéo xuống để làm mới.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <PollCard
              poll={item}
              disabled={vote.isPending}
              onVote={(optionId) => {
                setActionError(null);
                vote.mutate({ pollId: item.id, optionId });
              }}
            />
          )}
        />
      )}
    </Screen>
  );
}
