import type { paths as AdmissionPaths } from './generated/admission';
import type { paths as EngagementPaths } from './generated/engagement';
import type { paths as EventPaths } from './generated/event';

/**
 * Gateway serves all three services under one origin, so the mobile client can
 * treat them as a single contract.
 */
export type ApiPaths = AdmissionPaths & EngagementPaths & EventPaths;

export type Role = 'ATTENDEE' | 'STAFF' | 'ORGANIZER' | 'HOST';

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

export type TicketStatus = 'PENDING_PAYMENT' | 'PAID' | 'CHECKED_IN' | 'CANCELLED';

/** The mobile app is staff-gate + attendee only. Hosts stay on the web console. */
export function isStaffRole(role: Role | null | undefined): boolean {
  return role === 'STAFF' || role === 'ORGANIZER';
}

export function isAttendeeRole(role: Role | null | undefined): boolean {
  return role === 'ATTENDEE';
}

export function isSupportedMobileRole(role: Role | null | undefined): boolean {
  return isStaffRole(role) || isAttendeeRole(role);
}
