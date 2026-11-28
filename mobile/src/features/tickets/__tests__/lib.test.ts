import { ApiError } from '@/api/errors';
import {
  formatSessionTime,
  remainingSeconds,
  ticketErrorText,
  ticketStatus,
  ticketTypeName,
  type Event,
  type TicketSummary,
} from '../lib';

function ticket(overrides: Partial<TicketSummary>): TicketSummary {
  return {
    id: 'ticket-1',
    eventId: 'event-1',
    ticketTypeId: 'type-1',
    status: 'PAID',
    orderStatus: 'CONFIRMED',
    checkedInAt: null,
    createdAt: '2026-11-28T12:00:00.000Z',
    ...overrides,
  };
}

describe('ticketStatus', () => {
  it('marks a paid ticket from a confirmed order as usable', () => {
    expect(ticketStatus(ticket({}))).toEqual({ label: 'Hợp lệ', tone: 'success' });
  });

  it('lets cancellation win over a paid status', () => {
    expect(ticketStatus(ticket({ status: 'CANCELLED' }))).toEqual({
      label: 'Đã huỷ',
      tone: 'danger',
    });
  });

  it('blocks a ticket whose order is not confirmed', () => {
    expect(ticketStatus(ticket({ orderStatus: 'PENDING' }))).toEqual({
      label: 'Đơn chưa xác nhận',
      tone: 'warning',
    });
  });

  it('reports a checked-in ticket', () => {
    expect(ticketStatus(ticket({ status: 'CHECKED_IN' }))).toEqual({
      label: 'Đã check-in',
      tone: 'success',
    });
  });
});

describe('remainingSeconds', () => {
  it('rounds up so the final second stays visible', () => {
    expect(remainingSeconds(1_000, 0)).toBe(1);
    expect(remainingSeconds(1_000, 1)).toBe(1);
    expect(remainingSeconds(1_000, 1_001)).toBe(0);
    expect(remainingSeconds(30_000, 10_500)).toBe(20);
  });

  it('never returns a negative countdown', () => {
    expect(remainingSeconds(0, 5_000)).toBe(0);
  });
});

describe('ticketTypeName', () => {
  it('resolves the type name from the cached event', () => {
    const event = {
      ticketTypes: [{ id: 'type-1', name: 'Standard' }],
    } as unknown as Event;
    expect(ticketTypeName(event, 'type-1')).toBe('Standard');
  });

  it('falls back when the event is not loaded', () => {
    expect(ticketTypeName(undefined, 'type-1')).toBe('Vé sự kiện');
  });
});

describe('ticketErrorText', () => {
  it('explains a cancelled ticket in Vietnamese', () => {
    const error = new ApiError(409, 'TICKET_CANCELLED', 'Ticket has been cancelled');
    expect(ticketErrorText(error)).toContain('Vé đã bị huỷ');
  });
});

describe('formatSessionTime', () => {
  it('renders the day and the time range', () => {
    expect(
      formatSessionTime('2026-11-28T13:00:00.000Z', '2026-11-28T14:30:00.000Z')
    ).toMatch(/28[-/]11/);
  });
});
