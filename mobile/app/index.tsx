import { Redirect, type Href } from 'expo-router';

import { isStaffRole } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { FullScreenLoader } from '@/components/full-screen-loader';

/**
 * Single entry point. Role redirects live here so every deep link funnels
 * through one gate instead of each group re-checking auth.
 */
export default function Index() {
  const { status, user } = useAuth();

  if (status === 'restoring') {
    return <FullScreenLoader label="Đang kiểm tra phiên đăng nhập…" />;
  }

  if (status === 'signedOut' || !user) {
    return <Redirect href={'/(auth)/login' as Href} />;
  }

  const target = isStaffRole(user.role) ? '/(staff)/events' : '/(attendee)/tickets';
  return <Redirect href={target as Href} />;
}
