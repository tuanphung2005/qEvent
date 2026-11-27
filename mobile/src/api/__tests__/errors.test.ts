import { ApiError, messageFor, toApiError, toNetworkError, unwrap } from '@/api/errors';

describe('API error copy', () => {
  it('maps known backend codes to Vietnamese', () => {
    expect(messageFor('ALREADY_CHECKED_IN')).toContain('check-in');
    expect(messageFor('SESSION_NOT_LIVE')).toContain('chưa mở');
    expect(messageFor('SOMETHING_NEW', 'Raw backend message')).toBe('Raw backend message');
    expect(messageFor(undefined)).toContain('lỗi');
  });

  it('builds errors from HTTP responses and network failures', () => {
    const forbidden = toApiError({ code: 'FORBIDDEN', message: 'nope' }, 403);
    expect(forbidden).toBeInstanceOf(ApiError);
    expect(forbidden.status).toBe(403);
    expect(forbidden.message).toContain('quyền');

    const offline = toNetworkError(new TypeError('Network request failed'));
    expect(offline.code).toBe('NETWORK');

    expect(() =>
      unwrap({ error: { code: 'TICKET_NOT_FOUND' }, response: new Response('{}', { status: 404 }) })
    ).toThrow('Không tìm thấy vé');
  });
});
