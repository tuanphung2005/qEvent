import { router, type Href } from 'expo-router';
import {
  BarChart3Icon,
  MessageCircleIcon,
  RadioIcon,
  TicketIcon,
  TrophyIcon,
} from 'lucide-react-native';
import { FlatList, RefreshControl, View } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useEvents, useMyTickets } from '@/features/tickets/data';
import { formatSessionTime, type Event } from '@/features/tickets/lib';
import type { EventSession } from '@/features/tickets/data';
import { colors } from '@/theme/tokens';

type LiveSession = { session: EventSession; event: Event };

function sessionLink(
  screen: 'qa' | 'polls' | 'quiz',
  entry: LiveSession
): Href {
  return {
    pathname: `/(attendee)/live/[sessionId]/${screen}`,
    params: { sessionId: entry.session.id, title: entry.session.title },
  } as Href;
}

function SessionCard({ entry }: { entry: LiveSession }) {
  return (
    <View className="gap-3 rounded-card bg-card p-4 shadow-sm shadow-black/5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-label text-muted-foreground" numberOfLines={1}>
          {entry.event.name}
        </Text>
        <View className="flex-row items-center gap-1.5 rounded-badge bg-success/15 px-2 py-1">
          <View className="size-1.5 rounded-full bg-success" />
          <Text className="text-label text-foreground">Đang live</Text>
        </View>
      </View>

      <View className="gap-1">
        <Text className="text-section text-foreground" numberOfLines={2}>
          {entry.session.title}
        </Text>
        <Text className="text-body text-muted-foreground" numberOfLines={1}>
          {entry.session.speaker}
        </Text>
        <Text className="text-label text-muted-foreground">
          {formatSessionTime(entry.session.startTime, entry.session.endTime)}
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Button
          variant="secondary"
          className="min-h-12 flex-1 px-2"
          onPress={() => router.push(sessionLink('qa', entry))}
          accessibilityLabel={`Hỏi đáp cho ${entry.session.title}`}>
          <Icon as={MessageCircleIcon} className="size-4 text-secondary-foreground" />
          <Text className="text-label">Hỏi đáp</Text>
        </Button>
        <Button
          variant="secondary"
          className="min-h-12 flex-1 px-2"
          onPress={() => router.push(sessionLink('polls', entry))}
          accessibilityLabel={`Bình chọn cho ${entry.session.title}`}>
          <Icon as={BarChart3Icon} className="size-4 text-secondary-foreground" />
          <Text className="text-label">Bình chọn</Text>
        </Button>
        <Button
          variant="secondary"
          className="min-h-12 flex-1 px-2"
          onPress={() => router.push(sessionLink('quiz', entry))}
          accessibilityLabel={`Quiz cho ${entry.session.title}`}>
          <Icon as={TrophyIcon} className="size-4 text-secondary-foreground" />
          <Text className="text-label">Quiz</Text>
        </Button>
      </View>
    </View>
  );
}

function SessionSkeleton() {
  return (
    <View className="gap-3 rounded-card bg-card p-4 shadow-sm shadow-black/5">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <View className="flex-row gap-2">
        <Skeleton className="h-12 flex-1 rounded-control" />
        <Skeleton className="h-12 flex-1 rounded-control" />
        <Skeleton className="h-12 flex-1 rounded-control" />
      </View>
    </View>
  );
}

export default function AttendeeLiveScreen() {
  const tickets = useMyTickets();
  const checkedIn = (tickets.data ?? []).filter((ticket) => ticket.status === 'CHECKED_IN');
  const events = useEvents(checkedIn.map((ticket) => ticket.eventId));

  const bySession = new Map<string, LiveSession>();
  checkedIn.forEach((ticket) => {
    const event = events.byId.get(ticket.eventId);
    event?.sessions
      .filter((session) => session.isLive)
      .forEach((session) => {
        if (!bySession.has(session.id)) bySession.set(session.id, { session, event });
      });
  });
  const sessions = Array.from(bySession.values());

  const loading = tickets.isLoading || (events.isLoading && checkedIn.length > 0);

  return (
    <Screen contentClassName="p-0" edges={['top', 'left', 'right']}>
      {tickets.isError ? (
        <ErrorState
          title="Không tải được phiên live"
          message={tickets.error instanceof Error ? tickets.error.message : undefined}
          onRetry={() => tickets.refetch()}
        />
      ) : (
        <FlatList
          data={loading ? [] : sessions}
          keyExtractor={(entry) => entry.session.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={tickets.isRefetching}
              onRefresh={() => tickets.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View className="gap-1 pb-2">
              <Text className="text-display text-foreground">Đang diễn ra</Text>
              <Text className="text-body text-muted-foreground">
                Hỏi đáp, bình chọn và quiz trong các phiên bạn đã check-in.
              </Text>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View className="gap-3">
                <SessionSkeleton />
                <SessionSkeleton />
              </View>
            ) : checkedIn.length === 0 ? (
              <View className="items-center gap-3 rounded-card bg-card px-6 py-10 shadow-sm shadow-black/5">
                <View className="size-14 items-center justify-center rounded-full bg-secondary">
                  <Icon as={TicketIcon} className="size-7 text-muted-foreground" />
                </View>
                <Text className="text-section text-foreground">Chưa check-in sự kiện nào</Text>
                <Text className="text-center text-body text-muted-foreground">
                  Check-in tại cổng soát vé để mở phần hỏi đáp, bình chọn và quiz.
                </Text>
                <Button
                  variant="outline"
                  className="mt-1 min-h-12"
                  onPress={() => router.push('/(attendee)/tickets' as Href)}>
                  <Text>Xem vé của tôi</Text>
                </Button>
              </View>
            ) : (
              <View className="items-center gap-3 rounded-card bg-card px-6 py-10 shadow-sm shadow-black/5">
                <View className="size-14 items-center justify-center rounded-full bg-secondary">
                  <Icon as={RadioIcon} className="size-7 text-muted-foreground" />
                </View>
                <Text className="text-section text-foreground">Chưa có phiên nào live</Text>
                <Text className="text-center text-body text-muted-foreground">
                  Kéo xuống để làm mới khi host bắt đầu phiên tiếp theo.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => <SessionCard entry={item} />}
        />
      )}
    </Screen>
  );
}
