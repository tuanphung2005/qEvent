import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeftIcon,
  MessageCircleIcon,
  SendIcon,
  ThumbsUpIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';

import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  engagementKeys,
  useQuestions,
  type QAQuestion,
  type QuestionsResponse,
} from '@/features/engagement/data';
import { connectionNote, engagementErrorText } from '@/features/engagement/lib';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { cn } from '@/lib/utils';

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : (value?.[0] ?? '');
}

function QuestionCard({
  question,
  voted,
  onVote,
  disabled,
}: {
  question: QAQuestion;
  voted: boolean;
  onVote: () => void;
  disabled: boolean;
}) {
  return (
    <View className="gap-3 rounded-card bg-card p-4 shadow-sm shadow-black/5">
      <Text className="text-body text-foreground">{question.content}</Text>
      <View className="flex-row items-center justify-between">
        <Text className="text-label text-muted-foreground">{question.upvotes} lượt thích</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voted ? 'Bỏ thích câu hỏi' : 'Thích câu hỏi'}
          accessibilityState={{ selected: voted, disabled }}
          disabled={disabled}
          onPress={onVote}
          className={cn(
            'min-h-12 flex-row items-center gap-2 rounded-control px-3 active:opacity-70',
            voted ? 'bg-primary/10' : 'bg-secondary',
            disabled && 'opacity-50'
          )}>
          <Icon
            as={ThumbsUpIcon}
            className={cn('size-4', voted ? 'text-primary' : 'text-muted-foreground')}
          />
          <Text className={cn('text-label', voted ? 'text-primary' : 'text-foreground')}>
            {voted ? 'Đã thích' : 'Thích'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function QaScreen() {
  const params = useLocalSearchParams<{ sessionId: string; title?: string }>();
  const sessionId = param(params.sessionId);
  const sessionTitle = param(params.title);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const questions = useQuestions(sessionId);
  const listKey = engagementKeys.questions(sessionId);

  const [draft, setDraft] = useState('');
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

  const createQuestion = useMutation({
    mutationFn: async (content: string) => {
      const result = await api.POST('/api/sessions/{sessionId}/questions', {
        params: { path: { sessionId } },
        body: { content },
      });
      return unwrap(result);
    },
    onSuccess: () => {
      setDraft('');
      setActionError(null);
      refresh();
    },
    onError: (error) => setActionError(engagementErrorText(error)),
  });

  const vote = useMutation({
    mutationFn: async (questionId: string) => {
      const result = await api.PUT('/api/questions/{questionId}/votes', {
        params: { path: { questionId } },
      });
      return unwrap(result);
    },
    onMutate: async (questionId) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<QuestionsResponse>(listKey);
      if (previous && user) {
        const voted = previous.questions
          .find((question) => question.id === questionId)
          ?.votedUserIds?.includes(user.id);
        queryClient.setQueryData<QuestionsResponse>(listKey, {
          ...previous,
          questions: previous.questions.map((question) => {
            if (question.id !== questionId) return question;
            const ids = question.votedUserIds ?? [];
            return {
              ...question,
              upvotes: Math.max(0, question.upvotes + (voted ? -1 : 1)),
              votedUserIds: voted
                ? ids.filter((id) => id !== user.id)
                : [...ids, user.id],
            };
          }),
        });
      }
      return { previous };
    },
    onError: (error, _questionId, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
      setActionError(engagementErrorText(error));
    },
    onSettled: () => refresh(),
  });

  const note = connectionNote(realtime);
  const questionsData = questions.data?.questions ?? [];
  const readOnly = questions.isError;
  const canSend = draft.trim().length > 0 && !createQuestion.isPending && !readOnly;

  const submit = () => {
    const content = draft.trim();
    if (!content || readOnly) return;
    setActionError(null);
    createQuestion.mutate(content);
  };

  return (
    <Screen contentClassName="p-0" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
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
              Hỏi đáp
            </Text>
            {sessionTitle ? (
              <Text className="text-label text-muted-foreground" numberOfLines={1}>
                {sessionTitle}
              </Text>
            ) : null}
          </View>
        </View>

        {questions.isError ? (
          <ErrorState
            title="Không mở được hỏi đáp"
            message={
              questions.error instanceof Error ? questions.error.message : undefined
            }
            onRetry={() => questions.refetch()}
          />
        ) : (
          <FlatList
            data={questionsData}
            keyExtractor={(question) => question.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
            keyboardShouldPersistTaps="handled"
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
              questions.isLoading ? (
                <View className="gap-3 pt-2">
                  <Skeleton className="h-24 rounded-card" />
                  <Skeleton className="h-24 rounded-card" />
                  <Skeleton className="h-24 rounded-card" />
                </View>
              ) : (
                <View className="items-center gap-2 rounded-card bg-card px-6 py-10 shadow-sm shadow-black/5">
                  <View className="size-14 items-center justify-center rounded-full bg-secondary">
                    <Icon as={MessageCircleIcon} className="size-7 text-muted-foreground" />
                  </View>
                  <Text className="text-section text-foreground">Chưa có câu hỏi</Text>
                  <Text className="text-center text-body text-muted-foreground">
                    Gửi câu hỏi đầu tiên cho diễn giả ở ô bên dưới.
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <QuestionCard
                question={item}
                voted={Boolean(user && item.votedUserIds?.includes(user.id))}
                onVote={() => vote.mutate(item.id)}
                disabled={vote.isPending}
              />
            )}
          />
        )}

        {!readOnly ? (
          <View className="gap-2 bg-card px-4 pb-4 pt-3 shadow-sm shadow-black/5">
            <Input
              accessibilityLabel="Nội dung câu hỏi"
              className="max-h-28 min-h-12 py-2 text-body"
              placeholder="Đặt câu hỏi cho diễn giả…"
              value={draft}
              onChangeText={setDraft}
              maxLength={500}
              multiline
              editable={!createQuestion.isPending}
            />
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-label text-muted-foreground">{draft.length}/500</Text>
              <Button
                size="icon"
                disabled={!canSend}
                accessibilityLabel="Gửi câu hỏi"
                onPress={submit}
                className="size-12 rounded-control">
                <Icon as={SendIcon} className="size-5 text-primary-foreground" />
              </Button>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
