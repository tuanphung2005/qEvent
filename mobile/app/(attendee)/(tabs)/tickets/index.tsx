import { router, type Href } from 'expo-router';
import { ChevronRightIcon, TicketIcon } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { formatDateTime } from '@/lib/format';
import { StatusPill } from '@/features/tickets/components/status-pill';
import {
  ticketStatus,
  ticketTypeName,
  type Event,
  type TicketSummary,
} from '@/features/tickets/lib';
import { useEvents, useMyTickets } from '@/features/tickets/data';
import { colors } from '@/theme/tokens';

function TicketCard({ ticket, event }: { ticket: TicketSummary; event: Event | undefined }) {
  const status = ticketStatus(ticket);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Vé ${ticketTypeName(event, ticket.ticketTypeId)}, ${status.label}`}
      onPress={() =>
        router.push({
          pathname: '/(attendee)/tickets/[ticketId]',
          params: { ticketId: ticket.id, eventId: ticket.eventId },
        } as Href)
      }
      className="rounded-card bg-card p-4 shadow-sm shadow-black/5 active:bg-secondary/60">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-section text-foreground" numberOfLines={2}>
            {event?.name ?? 'Sự kiện'}
          </Text>
          <Text className="text-label text-muted-foreground" numberOfLines={1}>
            {event?.venue ?? 'Đang tải địa điểm…'}
          </Text>
        </View>
        <StatusPill label={status.label} tone={status.tone} />
      </View>

      <View className="mt-3 flex-row items-end justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-body text-foreground" numberOfLines={1}>
            {ticketTypeName(event, ticket.ticketTypeId)}
          </Text>
          <Text className="text-label text-muted-foreground" numberOfLines={1}>
            {event ? formatDateTime(event.startTime) : '—'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1 pb-0.5">
          <Text className="text-label text-primary">Xem vé</Text>
          <Icon as={ChevronRightIcon} className="size-4 text-primary" />
        </View>
      </View>
    </Pressable>
  );
}

function TicketSkeleton() {
  return (
    <View className="gap-3 rounded-card bg-card p-4 shadow-sm shadow-black/5">
      <View className="flex-row justify-between gap-3">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-5 w-16" />
      </View>
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-4 w-1/2" />
    </View>
  );
}

export default function AttendeeTicketsScreen() {
  const { user } = useAuth();
  const tickets = useMyTickets();
  const events = useEvents(tickets.data?.map((ticket) => ticket.eventId) ?? []);
  const loading = tickets.isLoading || (events.isLoading && tickets.data?.length !== 0);

  return (
    <Screen contentClassName="p-0" edges={['top', 'left', 'right']}>
      {tickets.isError ? (
        <ErrorState
          title="Không tải được vé"
          message={tickets.error instanceof Error ? tickets.error.message : undefined}
          onRetry={() => tickets.refetch()}
        />
      ) : (
        <FlatList
          data={loading ? [] : (tickets.data ?? [])}
          keyExtractor={(ticket) => ticket.id}
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
              <Text className="text-display text-foreground">Vé của tôi</Text>
              <Text className="text-body text-muted-foreground">
                Xin chào, {user?.fullName ?? 'bạn'}.
              </Text>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View className="gap-3">
                <TicketSkeleton />
                <TicketSkeleton />
                <TicketSkeleton />
              </View>
            ) : (
              <View className="items-center gap-3 rounded-card bg-card px-6 py-10 shadow-sm shadow-black/5">
                <View className="size-14 items-center justify-center rounded-full bg-secondary">
                  <Icon as={TicketIcon} className="size-7 text-muted-foreground" />
                </View>
                <Text className="text-section text-foreground">Chưa có vé nào</Text>
                <Text className="text-center text-body text-muted-foreground">
                  Vé sẽ xuất hiện ở đây sau khi đơn hàng của bạn được xác nhận.
                </Text>
                <Button variant="outline" className="mt-1 min-h-12" onPress={() => tickets.refetch()}>
                  <Text>Tải lại</Text>
                </Button>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TicketCard ticket={item} event={events.byId.get(item.eventId)} />
          )}
        />
      )}
    </Screen>
  );
}
