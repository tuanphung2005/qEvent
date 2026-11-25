import type { components } from "./generated";

type Schemas = components["schemas"];

export type ApiError = { code: string; message: string; status: number };
export type ListResponse<T> = { items: T[]; nextCursor: string | null };

/** Every list screen shares this filter; it lives on the URL, never in a store. */
export type ListFilter = {
  eventId?: string | null;
  status?: string | null;
  q?: string | null;
  cursor?: string | null;
  limit?: number | null;
  since?: string | null;
  gate?: string | null;
};

export type User = Schemas["User"];
export type UserRole = User["role"];
export type StaffRole = Extract<UserRole, "STAFF" | "ORGANIZER" | "HOST">;

export type Attendee = Schemas["Attendee"];
export type AuthMeResponse = Schemas["AuthMeResponse"];
export type AuthResponse = Schemas["AuthResponse"];
export type LoginRequest = Schemas["LoginRequest"];

export type EventSummary = Schemas["Event"];
export type EventListResponse = Schemas["EventListResponse"];
export type EventHost = Schemas["EventHost"];
export type EventHostListResponse = Schemas["EventHostListResponse"];
export type UserListResponse = Schemas["UserListResponse"];
export type Session = Schemas["Session"];
export type Room = Schemas["Room"];
export type TicketType = Schemas["TicketType"];

export type OrderListItem = Schemas["StaffOrder"];
export type OrderDetail = Schemas["StaffOrderDetail"];
export type OrderListResponse = Schemas["OrderListResponse"];
export type TicketListItem = Schemas["StaffTicket"];
export type TicketListResponse = Schemas["StaffTicketListResponse"];
export type TicketDetailResponse = Schemas["TicketDetailResponse"];
export type CheckinLog = Schemas["CheckinLog"];
export type CheckinListItem = Schemas["CheckinFeedItem"];
export type CheckinFeedResponse = Schemas["CheckinFeedResponse"];
export type AdmissionStats = Schemas["AdmissionStatsResponse"];

export type SessionStats = Schemas["SessionStatsResponse"];
export type QAQuestion = Schemas["QAQuestion"];
export type Poll = Schemas["Poll"];
export type PollOption = Schemas["PollOption"];
export type Game = Schemas["Game"];
export type GameQuestion = Schemas["GameQuestion"];
export type LeaderboardEntry = Schemas["LeaderboardEntry"];
export type QuizDisplayMode = NonNullable<Game["displayMode"]>;
