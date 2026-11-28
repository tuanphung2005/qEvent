import { act, render, screen } from '@testing-library/react-native';

import { serverNow } from '@/api/client';
import { QrCountdown } from '../components/qr-countdown';

// The UI Text primitive pulls in @rn-primitives, which jest-expo does not
// transform here. RN Text has the same rendering contract for this assertion.
jest.mock('@/components/ui/text', () => {
  const { Text } = jest.requireActual('react-native');
  return { Text };
});

describe('QrCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-28T14:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the remaining seconds from the token expiry', async () => {
    await render(
      <QrCountdown expiresAt={serverNow() + 3_000} totalSeconds={30} />
    );

    expect(screen.getByText('Mã làm mới sau 3 giây')).toBeTruthy();
  });

  it('ticks down and calls onExpire once when the token dies', async () => {
    const onExpire = jest.fn();
    await render(
      <QrCountdown
        expiresAt={serverNow() + 2_000}
        totalSeconds={30}
        onExpire={onExpire}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByText('Mã làm mới sau 1 giây')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(screen.getByText('Đang lấy mã mới…')).toBeTruthy();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
