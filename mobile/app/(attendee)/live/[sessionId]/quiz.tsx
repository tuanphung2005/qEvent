import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClockIcon,
  HourglassIcon,
  TrophyIcon,
  WifiIcon,
  WifiOffIcon,
  XCircleIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { api, serverNow } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  engagementKeys,
  useGame,
  useLeaderboard,
  type Game,
} from '@/features/engagement/data';
import {
  connectionNote,
  correctOption,
  currentGameQuestion,
  engagementErrorText,
  optionLetter,
  secondsLeft,
} from '@/features/engagement/lib';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { cn } from '@/lib/utils';

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : (value?.[0] ?? '');
}

function StatusLine({ label, tone }: { label: string; tone: 'success' | 'warning' | 'neutral' }) {
  const dot = {
    success: 'bg-success',
    warning: 'bg-warning',
    neutral: 'bg-muted-foreground',
  }[tone];
  return (
    <View className="flex-row items-center gap-1.5 rounded-badge bg-secondary px-2 py-1">
      <View className={cn('size-1.5 rounded-full', dot)} />
      <Text className="text-label text-foreground">{label}</Text>
    </View>
  );
}

function Leaderboard({
  game,
  currentUserId,
}: {
  game: Game;
  currentUserId: string | undefined;
}) {
  const board = useLeaderboard(game.status === 'FINISHED' ? game.id : undefined);

  if (board.isLoading) {
    return (
      <View className="gap-2">
        <Skeleton className="h-12 rounded-control" />
        <Skeleton className="h-12 rounded-control" />
        <Skeleton className="h-12 rounded-control" />
      </View>
    );
  }

  if (board.isError) {
    return (
      <Text className="text-label text-muted-foreground">
        Không tải được bảng xếp hạng. Kéo xuống để làm mới.
      </Text>
    );
  }

  const rows = board.data ?? [];
  if (rows.length === 0) {
    return (
      <Text className="text-label text-muted-foreground">
        Chưa có ai trả lời đúng. Cùng chơi lại ở phiên sau nhé.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {rows.map((entry) => {
        const mine = entry.userId === currentUserId;
        return (
          <View
            key={entry.userId}
            className={cn(
              'min-h-12 flex-row items-center gap-3 rounded-control bg-secondary px-3 py-2',
              mine && 'bg-primary/10'
            )}>
            <Text className={cn('w-7 text-label', mine ? 'text-primary' : 'text-muted-foreground')}>
              #{entry.rank}
            </Text>
            <Text className={cn('flex-1 text-body', mine ? 'text-primary' : 'text-foreground')}>
              {mine ? 'Bạn' : `Người chơi #${entry.rank}`}
            </Text>
            <View className="items-end">
              <Text className="text-body text-foreground">{entry.totalScore} điểm</Text>
              <Text className="text-label text-muted-foreground">
                {entry.correctCount} câu đúng
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function QuizScreen() {
  const params = useLocalSearchParams<{ sessionId: string; title?: string }>();
  const sessionId = param(params.sessionId);
  const sessionTitle = param(params.title);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const gameQuery = useGame(sessionId);
  const gameKey = engagementKeys.game(sessionId);

  const game = gameQuery.data;
  const question = currentGameQuestion(game);
  const correct = correctOption(game);
  const status = game?.status;

  const [now, setNow] = useState(() => serverNow());
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: gameKey });

  const realtime = useRealtime({
    path: '/ws/game',
    enabled: Boolean(game?.id),
    joinKey: game?.id,
    join: () => ({ type: 'JOIN_GAME', gameId: game?.id }),
    onEvent: refresh,
    onPoll: refresh,
    onReconnect: refresh,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const answer = useMutation({
    mutationFn: async ({
      questionId,
      selectedOption,
    }: {
      key: string;
      questionId: string;
      selectedOption: number;
    }) => {
      const gameId = game?.id ?? '';
      const result = await api.POST('/api/game/{gameId}/answer', {
        params: { path: { gameId } },
        body: { questionId, selectedOption },
      });
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      setSubmitted((current) => ({ ...current, [variables.key]: variables.selectedOption }));
      setActionError(null);
      refresh();
    },
    onError: (error, variables) => {
      if (error instanceof ApiError && error.code === 'ALREADY_ANSWERED') {
        setSubmitted((current) => ({
          ...current,
          [variables.key]: variables.selectedOption,
        }));
      }
      setActionError(engagementErrorText(error));
    },
  });

  const note = connectionNote(realtime);
  const left = question
    ? secondsLeft(question.questionStartedAt, question.timeLimitSec ?? 0, now)
    : 0;
  // Restarting a game keeps question ids; the start timestamp is the round key.
  const answerKey = question ? `${question.id}:${question.questionStartedAt ?? ''}` : '';
  const submittedOption = answerKey ? submitted[answerKey] : undefined;
  const selectedOption = answerKey ? selected[answerKey] : undefined;
  const answered = submittedOption !== undefined;
  const closedByTime = status === 'QUESTION_ACTIVE' && left <= 0;

  const gameNotFound =
    gameQuery.isError &&
    gameQuery.error instanceof ApiError &&
    gameQuery.error.code === 'GAME_NOT_FOUND';

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
            Quiz
          </Text>
          {sessionTitle ? (
            <Text className="text-label text-muted-foreground" numberOfLines={1}>
              {sessionTitle}
            </Text>
          ) : null}
        </View>
        {game?.status ? (
          <StatusLine
            label={
              game.status === 'WAITING'
                ? 'Chờ bắt đầu'
                : game.status === 'QUESTION_ACTIVE'
                  ? 'Đang hỏi'
                  : game.status === 'ROUND_REVEALED'
                    ? 'Đã công bố'
                    : 'Kết thúc'
            }
            tone={
              game.status === 'QUESTION_ACTIVE' || game.status === 'ROUND_REVEALED'
                ? 'success'
                : 'neutral'
            }
          />
        ) : null}
      </View>

      {gameQuery.isError ? (
        gameNotFound ? (
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <View className="size-14 items-center justify-center rounded-full bg-secondary">
              <Icon as={TrophyIcon} className="size-7 text-muted-foreground" />
            </View>
            <Text className="text-section text-foreground">Phiên này chưa có quiz</Text>
            <Text className="text-center text-body text-muted-foreground">
              Host chưa tạo trò chơi cho phiên này. Quay lại sau nhé.
            </Text>
            <Button variant="outline" className="mt-2 min-h-12" onPress={() => gameQuery.refetch()}>
              <Text>Tải lại</Text>
            </Button>
          </View>
        ) : (
          <ErrorState
            title="Không tải được quiz"
            message={gameQuery.error instanceof Error ? gameQuery.error.message : undefined}
            onRetry={() => gameQuery.refetch()}
          />
        )
      ) : gameQuery.isLoading || !game ? (
        <View className="gap-3 px-4 pt-2">
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-12 rounded-control" />
          <Skeleton className="h-12 rounded-control" />
          <Skeleton className="h-12 rounded-control" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}>
          <View className="gap-3">
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

              {status === 'WAITING' ? (
                <View className="items-center gap-3 rounded-card bg-card px-6 py-10 shadow-sm shadow-black/5">
                  <View className="size-14 items-center justify-center rounded-full bg-secondary">
                    <Icon as={HourglassIcon} className="size-7 text-muted-foreground" />
                  </View>
                  <Text className="text-section text-foreground">Đang chờ host bắt đầu</Text>
                  <Text className="text-center text-body text-muted-foreground">
                    {game.totalQuestions
                      ? `${game.totalQuestions} câu hỏi đã sẵn sàng.`
                      : 'Quiz sẽ bắt đầu khi host mở câu hỏi đầu tiên.'}
                  </Text>
                </View>
              ) : null}

              {question && (status === 'QUESTION_ACTIVE' || status === 'ROUND_REVEALED') ? (
                <View className="gap-4 rounded-card bg-card p-4 shadow-sm shadow-black/5">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-label text-muted-foreground">
                      Câu {(game.currentQuestionIndex ?? 0) + 1}
                      {game.totalQuestions ? `/${game.totalQuestions}` : ''}
                    </Text>
                    {status === 'QUESTION_ACTIVE' ? (
                      <View className="flex-row items-center gap-1.5 rounded-badge bg-secondary px-2 py-1">
                        <Icon
                          as={ClockIcon}
                          className={cn(
                            'size-4',
                            left <= 5 ? 'text-destructive-strong' : 'text-muted-foreground'
                          )}
                        />
                        <Text
                          className={cn(
                            'text-label',
                            left <= 5 ? 'text-destructive-strong' : 'text-foreground'
                          )}>
                          {left}s
                        </Text>
                      </View>
                    ) : (
                      <StatusLine label="Đã công bố đáp án" tone="success" />
                    )}
                  </View>

                  {question.content ? (
                    <Text className="text-section text-foreground">{question.content}</Text>
                  ) : (
                    <Text className="text-body text-muted-foreground">
                      Câu hỏi hiển thị trên màn hình chung. Chọn đáp án trên điện thoại.
                    </Text>
                  )}

                  <View className="gap-2">
                    {question.options.map((option, index) => {
                      const isCorrect = correct !== null && correct === index;
                      const isMine =
                        (answered ? submittedOption : selectedOption) === index;
                      const isWrongPick = answered && isMine && correct !== null && !isCorrect;
                      const reveal = status === 'ROUND_REVEALED';
                      return (
                        <Pressable
                          key={`${question.id}-${index}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Đáp án ${optionLetter(index)}`}
                          accessibilityState={{
                            selected: isMine,
                            disabled: answered || closedByTime || reveal,
                          }}
                          disabled={answered || closedByTime || reveal || answer.isPending}
                          onPress={() =>
                            setSelected((current) => ({ ...current, [answerKey]: index }))
                          }
                          className={cn(
                            'min-h-12 flex-row items-center gap-3 rounded-control bg-secondary px-3 py-2 active:opacity-70',
                            isMine && 'bg-primary/10',
                            reveal && isCorrect && 'bg-success/15',
                            isWrongPick && 'bg-destructive/10',
                            (answered || closedByTime || reveal) && 'opacity-90'
                          )}>
                          <View
                            className={cn(
                              'size-7 items-center justify-center rounded-badge bg-card',
                              isMine && 'bg-primary/15'
                            )}>
                            <Text
                              className={cn(
                                'text-label',
                                isMine ? 'text-primary' : 'text-muted-foreground'
                              )}>
                              {optionLetter(index)}
                            </Text>
                          </View>
                          {question.displayMode === 'LETTERS' || option === optionLetter(index) ? null : (
                            <Text
                              className={cn(
                                'flex-1 text-body',
                                reveal && isCorrect ? 'text-foreground' : 'text-foreground'
                              )}>
                              {option}
                            </Text>
                          )}
                          {reveal && isCorrect ? (
                            <Icon as={CheckIcon} className="size-4 text-success" />
                          ) : null}
                          {isWrongPick ? (
                            <Icon as={XCircleIcon} className="size-4 text-destructive-strong" />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>

                  {status === 'QUESTION_ACTIVE' ? (
                    answered ? (
                      <View className="flex-row items-center gap-2 rounded-control bg-success/10 px-3 py-2">
                        <Icon as={CheckCircle2Icon} className="size-4 text-success" />
                        <Text className="flex-1 text-label text-foreground">
                          Đã gửi câu trả lời. Chờ host công bố đáp án.
                        </Text>
                      </View>
                    ) : (
                      <View className="gap-2">
                        {closedByTime ? (
                          <Text className="text-label text-destructive-strong">
                            Hết giờ trả lời câu này.
                          </Text>
                        ) : null}
                        <Button
                          className="min-h-12"
                          disabled={
                            selectedOption === undefined || closedByTime || answer.isPending
                          }
                          onPress={() => {
                            if (selectedOption === undefined) return;
                            setActionError(null);
                            answer.mutate({
                              key: answerKey,
                              questionId: question.id,
                              selectedOption,
                            });
                          }}>
                          <Text>{answer.isPending ? 'Đang gửi…' : 'Gửi câu trả lời'}</Text>
                        </Button>
                      </View>
                    )
                  ) : null}

                  {status === 'ROUND_REVEALED' && correct !== null ? (
                    <Text className="text-label text-muted-foreground">
                      Đáp án đúng: {optionLetter(correct)}
                      {question.options[correct] && question.displayMode !== 'LETTERS'
                        ? ` — ${question.options[correct]}`
                        : ''}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {status === 'FINISHED' ? (
                <View className="gap-3 rounded-card bg-card p-4 shadow-sm shadow-black/5">
                  <View className="flex-row items-center gap-2">
                    <Icon as={TrophyIcon} className="size-5 text-primary" />
                    <Text className="text-section text-foreground">Bảng xếp hạng</Text>
                  </View>
                  <Leaderboard game={game} currentUserId={user?.id} />
                </View>
              ) : null}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
