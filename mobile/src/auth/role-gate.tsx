import { router, useRootNavigationState, useSegments, type Href } from 'expo-router';
import { useEffect } from 'react';

import { isAttendeeRole, isStaffRole } from '@/api/types';
import { useAuth } from './auth-context';

/**
 * Deep-link guard. The index redirect handles the happy path; this stops an
 * attendee from opening a /(staff) URL (or vice versa) directly.
 */
export function RoleGate() {
  const { status, user } = useAuth();
  const segments = useSegments();
  const rootState = useRootNavigationState();

  useEffect(() => {
    if (status === 'restoring' || !rootState?.key) return;
    // The index route owns the initial redirect; only guard real destinations.
    if (!segments[0]) return;

    const inAuth = segments[0] === '(auth)';
    const inStaff = segments[0] === '(staff)';
    const inAttendee = segments[0] === '(attendee)';

    if (status === 'signedOut' || !user) {
      if (!inAuth) router.replace('/(auth)/login' as Href);
      return;
    }

    if (inAuth) {
      const home = isStaffRole(user.role) ? '/(staff)/events' : '/(attendee)/tickets';
      router.replace(home as Href);
      return;
    }

    if (isStaffRole(user.role) && inAttendee) {
      router.replace('/(staff)/events' as Href);
      return;
    }
    if (isAttendeeRole(user.role) && inStaff) {
      router.replace('/(attendee)/tickets' as Href);
    }
  }, [status, user, segments, rootState?.key]);

  return null;
}
