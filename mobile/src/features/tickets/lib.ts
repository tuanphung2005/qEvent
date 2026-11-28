import { ApiError, toNetworkError } from '@/api/errors';
import type { components as AdmissionComponents } from '@/api/generated/admission';
import type { components as EventComponents } from '@/api/generated/event';

export type TicketSummary = AdmissionComponents['schemas']['TicketSummary'];
export type Event = EventComponents['schemas']['Event'];

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export type TicketVisualStatus = {
  label: string;
  tone: StatusTone;
};

/** Order status wins: a paid ticket from an unconfirmed order cannot be used. */
export function ticketStatus(ticket: TicketSummary): TicketVisualStatus {
  if (ticket.status === 'CANCELLED') return { label: 'Đã huỷ', tone: 'danger' };
  if (ticket.orderStatus !== 'CONFIRMED') {
    return { label: 'Đơn chưa xác nhận', tone: 'warning' };
  }
  if (ticket.status === 'CHECKED_IN') return { label: 'Đã check-in', tone: 'success' };
  if (ticket.status === 'PENDING_PAYMENT') {
    return { label: 'Chờ thanh toán', tone: 'warning' };
  }
  return { label: 'Hợp lệ', tone: 'success' };
}

export function ticketTypeName(event: Event | undefined, ticketTypeId: string): string {
  return event?.ticketTypes.find((type) => type.id === ticketTypeId)?.name ?? 'Vé sự kiện';
}

export function ticketErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'TICKET_CANCELLED') return 'Vé đã bị huỷ nên không còn mã QR.';
    if (error.code === 'ORDER_NOT_CONFIRMED') {
      return 'Đơn hàng chưa được xác nhận. Liên hệ ban tổ chức nếu bạn đã thanh toán.';
    }
    return error.message;
  }
  return toNetworkError(error).message;
}

/** Seconds left before the QR refreshes. Ceil so the last second is visible. */
export function remainingSeconds(expiresAt: number, now: number): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function formatSessionTime(
  startTime: string | Date,
  endTime: string | Date
): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const day = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(start);
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} · ${time.format(start)}–${time.format(end)}`;
}
