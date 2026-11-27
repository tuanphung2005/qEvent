const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

const TICKET_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Hợp lệ',
  CHECKED_IN: 'Đã check-in',
  CANCELLED: 'Đã huỷ',
};

export function ticketStatusLabel(status: string): string {
  return TICKET_STATUS_LABEL[status] ?? status;
}

/** Staff result labels — always paired with an icon per DESIGN.md. */
export function scanStatusLabel(status: string): string {
  switch (status) {
    case 'SYNCED':
      return 'Hợp lệ';
    case 'CONFLICT':
      return 'Đã check-in trước đó';
    case 'DUPLICATE':
      return 'Quét trùng';
    case 'ERROR':
      return 'Lỗi';
    default:
      return status;
  }
}
