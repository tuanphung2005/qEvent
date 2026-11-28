import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  MapPinIcon,
  WifiOffIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useEvent, useMyTickets, useQrToken } from '@/features/tickets/data';
import { ticketErrorText, ticketStatus, ticketTypeName } from '@/features/tickets/lib';
import { QrCountdown } from '@/features/tickets/components/qr-countdown';
import { QrGuard } from '@/features/tickets/components/qr-guard';
import { StatusPill } from '@/features/tickets/components/status-pill';
import { TicketQr } from '@/features/tickets/components/ticket-qr';
import { formatDateTime } from '@/lib/format';

function param(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

export default function TicketDetailScreen() {
  const params = useLocalSearchParams<{ ticketId: string; eventId?: string }>();
  const ticketId = param(params.ticketId) ?? '';
  const eventIdParam = param(params.eventId);

  const tickets = useMyTickets();
  const ticket = tickets.data?.find((item) => item.id === ticketId);
  const eventId = ticket?.eventId ?? eventIdParam;
  const event = useEvent(eventId);

  const status = ticket ? ticketStatus(ticket) : null;
  const unusable =
    ticket?.status === 'CANCELLED' ||
    ticket?.status === 'PENDING_PAYMENT' ||
    (ticket && ticket.orderStatus !== 'CONFIRMED');
  const blockedTitle =
    ticket?.status === 'CANCELLED'
      ? 'Vé đã bị huỷ'
      : ticket?.status === 'PENDING_PAYMENT'
        ? 'Vé chưa thanh toán'
        : 'Đơn hàng chưa xác nhận';
  const blockedBody =
    ticket?.status === 'CANCELLED'
      ? 'Vé này không còn mã QR. Liên hệ ban tổ chức nếu cần hỗ trợ.'
      : ticket?.status === 'PENDING_PAYMENT'
        ? 'Hoàn tất thanh toán để nhận mã QR vào cổng.'
        : 'Mã QR chỉ hiển thị khi đơn hàng được xác nhận.';

  const qr = useQrToken(
    ticketId,
    Boolean(ticketId) && !unusable && ticket?.status !== 'CHECKED_IN'
  );
  const qrStatus = qr.data?.status;
  const checkedIn = ticket?.status === 'CHECKED_IN' || qrStatus === 'CHECKED_IN';

  return (
    <Screen scroll contentClassName="gap-4 pb-8">
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => router.back()}
          className="size-12 items-center justify-center rounded-control bg-card shadow-sm shadow-black/5 active:bg-secondary">
          <Icon as={ArrowLeftIcon} className="size-5 text-foreground" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-title text-foreground" numberOfLines={1}>
            Vé của bạn
          </Text>
          <Text className="text-label text-muted-foreground" numberOfLines={1}>
            {ticket ? ticketTypeName(event.data, ticket.ticketTypeId) : 'Đang tải thông tin vé…'}
          </Text>
        </View>
        {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
      </View>

      <View className="gap-2 rounded-card bg-card p-4 shadow-sm shadow-black/5">
        <Text className="text-section text-foreground" numberOfLines={2}>
          {event.data?.name ?? 'Sự kiện'}
        </Text>
        <View className="flex-row items-center gap-2">
          <Icon as={MapPinIcon} className="size-4 text-muted-foreground" />
          <Text className="flex-1 text-body text-muted-foreground" numberOfLines={2}>
            {event.data?.venue ?? '—'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Icon as={CalendarDaysIcon} className="size-4 text-muted-foreground" />
          <Text className="text-body text-muted-foreground">
            {event.data ? formatDateTime(event.data.startTime) : '—'}
          </Text>
        </View>
      </View>

      {checkedIn ? (
        <View className="items-center gap-3 rounded-card bg-card px-6 py-8 shadow-sm shadow-black/5">
          <View className="size-14 items-center justify-center rounded-full bg-success/15">
            <Icon as={CheckCircle2Icon} className="size-7 text-success" />
          </View>
          <Text className="text-section text-foreground">Vé đã check-in</Text>
          <Text className="text-center text-body text-muted-foreground">
            Bạn đã vào sự kiện. Mã QR không còn hiệu lực để soát vé.
          </Text>
        </View>
      ) : unusable ? (
        <View className="items-center gap-3 rounded-card bg-card px-6 py-8 shadow-sm shadow-black/5">
          <View className="size-14 items-center justify-center rounded-full bg-warning/15">
            <Icon as={ClockIcon} className="size-7 text-warning-foreground" />
          </View>
          <Text className="text-section text-foreground">{blockedTitle}</Text>
          <Text className="text-center text-body text-muted-foreground">{blockedBody}</Text>
        </View>
      ) : qr.isLoading ? (
        <View className="items-center gap-4 rounded-card bg-card p-6 shadow-sm shadow-black/5">
          <Skeleton className="size-56 rounded-card" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-4 w-40" />
        </View>
      ) : qr.isError && !qr.data ? (
        <ErrorState
          title="Không lấy được mã QR"
          message={ticketErrorText(qr.error)}
          onRetry={() => qr.refetch()}
        />
      ) : qr.data ? (
        <View className="items-center gap-4 rounded-card bg-card p-6 shadow-sm shadow-black/5">
          <QrGuard />
          <TicketQr value={qr.data.qrToken} />
          <QrCountdown
            expiresAt={qr.data.expiresAt}
            totalSeconds={qr.data.expiresIn}
            onExpire={() => qr.refetch()}
          />
          {qr.isError ? (
            <View className="flex-row items-start gap-2 rounded-control bg-warning/10 px-3 py-2">
              <Icon as={WifiOffIcon} className="mt-0.5 size-4 text-warning-foreground" />
              <Text className="flex-1 text-label text-foreground">
                Mất kết nối. Mã hiện tại vẫn dùng được đến khi hết giờ; cần mạng để lấy mã mới.
              </Text>
            </View>
          ) : null}
          <Text className="text-center text-label text-muted-foreground">
            Đưa mã này cho nhân viên soát vé. Không chụp màn hình hoặc chia sẻ mã.
          </Text>
        </View>
      ) : null}

      {qrStatus ? (
        <View className="flex-row items-center justify-between rounded-card bg-card px-4 py-3 shadow-sm shadow-black/5">
          <Text className="text-label text-muted-foreground">Trạng thái vé</Text>
          <StatusPill
            label={
              qrStatus === 'CHECKED_IN'
                ? 'Đã check-in'
                : qrStatus === 'CANCELLED'
                  ? 'Đã huỷ'
                  : 'Hợp lệ'
            }
            tone={
              qrStatus === 'CHECKED_IN'
                ? 'success'
                : qrStatus === 'CANCELLED'
                  ? 'danger'
                  : 'success'
            }
          />
        </View>
      ) : null}

      {ticket ? (
        <Text className="text-center text-label text-muted-foreground">
          Mã vé {ticket.id.slice(0, 8).toUpperCase()}
        </Text>
      ) : null}
    </Screen>
  );
}
