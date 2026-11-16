/**
 * GENERATED FILE — do not edit. Run `bun run gen:api` instead.
 * Source: services/{event,admission,engagement}-service/openapi.json
 */
export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Report service and database readiness */
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List events
         * @description Public. Returns events ordered by start time.
         */
        get: operations["listEvents"];
        put?: never;
        /**
         * Create an event with optional rooms, sessions and ticket types
         * @description Requires the ORGANIZER role. `startTime` must be before `endTime` and must not be in the past, otherwise `422 INVALID_EVENT_TIME` is returned.
         */
        post: operations["createEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/events/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an event with rooms, sessions and ticket types */
        get: operations["getEvent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update an event
         * @description Requires the ORGANIZER role. Capacity cannot be lowered below the number of reserved seats.
         */
        patch: operations["updateEvent"];
        trace?: never;
    };
    "/api/events/{id}/rooms/{roomId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update a room */
        patch: operations["updateRoom"];
        trace?: never;
    };
    "/api/events/{id}/sessions/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update a session, including its live flag
         * @description Partial update. When either time is supplied the merged start/end must still be valid. `isLive` toggles attendee interaction for that session.
         */
        patch: operations["updateSession"];
        trace?: never;
    };
    "/api/events/{id}/ticket-types/{ticketTypeId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update a ticket type
         * @description `quota` cannot be lower than the number of tickets already sold.
         */
        patch: operations["updateTicketType"];
        trace?: never;
    };
    "/api/events/{id}/rooms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add a room to an event */
        post: operations["addRoom"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/events/{id}/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add a session to an event */
        post: operations["addSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/events/{id}/ticket-types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add a ticket type to an event */
        post: operations["addTicketType"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/reservations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Atomically hold seats for an order
         * @description Used by the Admission Service saga. The operation is idempotent per `operationId`: replaying the same payload returns the stored reservation, while a different payload returns `409 IDEMPOTENCY_CONFLICT`. Capacity is enforced with conditional updates on the event and ticket type inside one transaction, so concurrent callers cannot oversell.
         */
        post: operations["createReservation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/reservations/{operationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Release a reservation and return its seats
         * @description Compensating action for the Admission saga. Releasing an already released reservation is idempotent and does not decrement the counters twice.
         */
        delete: operations["releaseReservation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/events/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read event metadata for another service */
        get: operations["getInternalEvent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read session metadata and its live flag */
        get: operations["getInternalSession"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Return the authenticated user
         * @description Restores the staff web session after a reload. The role always comes from the database, not from client input.
         */
        get: operations["getCurrentUser"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register an attendee
         * @description Creates an ATTENDEE account and returns a JWT. The optional `role` field is ignored.
         */
        post: operations["register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Log in and issue a JWT */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List orders for an event (staff)
         * @description Requires STAFF or ORGANIZER. Filters by status and searches by order id, attendee email or name. Cursor pagination.
         */
        get: operations["listOrders"];
        put?: never;
        /**
         * Place a ticket order through the Event Service saga
         * @description Requires a unique `Idempotency-Key` per user. Replaying the same key and payload returns the stored result; reusing it with a different payload returns `409 IDEMPOTENCY_CONFLICT`. When the downstream result is unknown (timeout or 5xx), the order stays pending and the response is `202` with `Location` for polling.
         */
        post: operations["placeOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get an order and its tickets
         * @description Attendees can read only their own orders; STAFF and ORGANIZER can read any order.
         */
        get: operations["getOrder"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List tickets for an event (staff)
         * @description Requires STAFF or ORGANIZER. Filters by status and searches by ticket id, attendee email or name. Attendees must use `/api/tickets/my`.
         */
        get: operations["listStaffTickets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tickets/my": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the caller's tickets */
        get: operations["listMyTickets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tickets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a ticket with its order and check-in logs (staff)
         * @description Requires STAFF or ORGANIZER. QR secrets are never returned; use `/api/tickets/{id}/qr-token` to reveal a fresh token.
         */
        get: operations["getStaffTicket"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tickets/{id}/qr-token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Issue a dynamic QR token
         * @description Only the ticket owner or STAFF/ORGANIZER may request it. The token expires after 30 seconds and is bound to the ticket and event.
         */
        get: operations["getTicketQrToken"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/checkins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the check-in feed for an event (staff)
         * @description Requires STAFF or ORGANIZER. Newest first; filter by `since` and gate (deviceId). Cursor pagination.
         */
        get: operations["listCheckins"];
        put?: never;
        /**
         * Check in one ticket online
         * @description Requires STAFF or ORGANIZER. Verifies the RSA signature and the 30-second TOTP before a compare-and-set update from PAID to CHECKED_IN. Concurrent scans accept exactly one request.
         */
        post: operations["checkIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/checkins/sync-offline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Synchronize offline check-in logs
         * @description Requires STAFF or ORGANIZER. Scans are applied in chronological order. The first scan per ticket wins; later scans are reported as CONFLICT. Replayed scans are reported as DUPLICATE and do not change state.
         */
        post: operations["syncOfflineCheckins"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/checkins/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Dashboard counters for an event (staff)
         * @description Requires STAFF or ORGANIZER. `byGate` groups check-in logs by deviceId; scanners should send a stable value such as `gate-1`.
         */
        get: operations["getCheckinStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/tickets/verify-access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check whether a user checked in to an event
         * @description Used by the Engagement Service to enforce BR-6. Requires the shared service token instead of a user JWT.
         */
        get: operations["verifyAccess"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}/questions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List questions for a session ordered by upvotes */
        get: operations["listQuestions"];
        put?: never;
        /**
         * Ask a question in a live session
         * @description Requires BR-6: the session must be live and the caller must have checked in to the session's real event. The event id is resolved from Event Service, never accepted from the client.
         */
        post: operations["createQuestion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/questions/{questionId}/votes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Toggle an upvote on a question
         * @description Requires BR-6 against the question's session. Calling it twice removes the vote.
         */
        put: operations["toggleQuestionVote"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/questions/{questionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a question (host only)
         * @description Staff and organizers can remove an inappropriate question. Its votes are removed by cascade.
         */
        delete: operations["deleteQuestion"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}/polls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List polls for a session */
        get: operations["listPolls"];
        put?: never;
        /** Create a poll (host only) */
        post: operations["createPoll"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/polls/{pollId}/vote": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cast, switch, or remove a poll vote
         * @description Requires BR-6 against the poll's session. Voting on a closed poll returns 400.
         */
        post: operations["votePoll"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/polls/{pollId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Open or close a poll (host only) */
        patch: operations["updatePoll"];
        trace?: never;
    };
    "/api/sessions/{sessionId}/game": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the game for a session */
        get: operations["getSessionGame"];
        put?: never;
        /** Create or return the session's quiz game (host only) */
        post: operations["createSessionGame"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/{gameId}/question": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add a question while the game is WAITING (host only) */
        post: operations["addGameQuestion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/{gameId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read game state (hosts also see correct answers)
         * @description Attendees never receive `correctOption` before ROUND_REVEALED; hosts receive the full question list.
         */
        get: operations["getGame"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/{gameId}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start the first question (host only, CAS) */
        post: operations["startGame"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/{gameId}/reveal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reveal the correct answer (host only, CAS) */
        post: operations["revealGameAnswer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/{gameId}/next": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Advance to the next question (host only, CAS) */
        post: operations["nextGameQuestion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/{gameId}/end": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Finish the game (host only) */
        post: operations["endGame"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/{gameId}/answer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit an answer for the active question
         * @description Requires BR-6. Identity comes from the JWT and timing from the server; `userId` and `responseTimeMs` in the body are ignored.
         */
        post: operations["submitGameAnswer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/{gameId}/leaderboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the game leaderboard */
        get: operations["getGameLeaderboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Dashboard counters for a session (host only) */
        get: operations["getSessionStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ErrorBody: {
            /** @example SOLD_OUT */
            code: string;
            /** @example Ticket type or event capacity is exhausted */
            message: string;
        };
        ValidationError: {
            /** @example validation */
            type: string;
            /** @example body */
            on: string;
            /** @example /maxCapacity */
            property: string;
            /** @example Expected number to be greater or equal to 1 */
            message: string;
            summary?: string;
            expected?: {
                [key: string]: unknown;
            };
            found?: {
                [key: string]: unknown;
            };
            errors?: {
                [key: string]: unknown;
            }[];
        };
        HealthResponse: {
            /** @enum {string} */
            status: "ok" | "degraded";
            /** @example event-service */
            service: string;
            /** @enum {string} */
            database: "ok" | "unavailable";
        };
        Room: {
            /** Format: uuid */
            id: string;
            /** @example Main Hall */
            name: string;
            /** @example 500 */
            capacity: number;
        };
        Session: {
            /** Format: uuid */
            id: string;
            /** @example Opening Keynote */
            title: string;
            /** @example Alex Nguyen */
            speaker: string;
            /** Format: date-time */
            startTime: string;
            /** Format: date-time */
            endTime: string;
            isLive: boolean;
        };
        TicketType: {
            /** Format: uuid */
            id: string;
            /** @example Standard */
            name: string;
            /** @example 25 */
            price: number;
            /** @example 500 */
            quota: number;
            /** @example 12 */
            soldCount: number;
            /** @example 488 */
            available: number;
        };
        Event: {
            /** Format: uuid */
            id: string;
            /** @example Tech Summit Vietnam 2026 */
            name: string;
            /** @example Saigon Exhibition and Convention Center */
            venue: string;
            /** Format: date-time */
            startTime: string;
            /** Format: date-time */
            endTime: string;
            /** @example 500 */
            maxCapacity: number;
            /** @example 12 */
            reservedCount: number;
            /** Format: date-time */
            createdAt: string;
            rooms: components["schemas"]["Room"][];
            sessions: components["schemas"]["Session"][];
            ticketTypes: components["schemas"]["TicketType"][];
        };
        EventResponse: {
            event: components["schemas"]["Event"];
        };
        EventListResponse: {
            events: components["schemas"]["Event"][];
        };
        RoomRequest: {
            name: string;
            capacity: number;
        };
        RoomResponse: {
            room: components["schemas"]["Room"];
        };
        SessionRequest: {
            title: string;
            speaker: string;
            /** Format: date-time */
            startTime: string;
            /** Format: date-time */
            endTime: string;
            isLive: boolean;
        };
        SessionResponse: {
            session: components["schemas"]["Session"];
        };
        TicketTypeRequest: {
            name: string;
            price: number;
            quota: number;
        };
        TicketTypeResponse: {
            ticketType: components["schemas"]["TicketType"];
        };
        CreateEventRequest: {
            name: string;
            venue: string;
            /** Format: date-time */
            startTime: string;
            /** Format: date-time */
            endTime: string;
            maxCapacity: number;
            rooms: components["schemas"]["RoomRequest"][];
            sessions: components["schemas"]["SessionRequest"][];
            ticketTypes: components["schemas"]["TicketTypeRequest"][];
        };
        UpdateEventRequest: {
            name?: string;
            venue?: string;
            /** Format: date-time */
            startTime?: string;
            /** Format: date-time */
            endTime?: string;
            maxCapacity?: number;
        };
        UpdateRoomRequest: {
            name?: string;
            capacity?: number;
        };
        UpdateSessionRequest: {
            title?: string;
            speaker?: string;
            /** Format: date-time */
            startTime?: string;
            /** Format: date-time */
            endTime?: string;
            isLive?: boolean;
        };
        UpdateTicketTypeRequest: {
            name?: string;
            price?: number;
            quota?: number;
        };
        ReservationRequest: {
            operationId: string;
            eventId: string;
            ticketTypeId: string;
            /** @example 1 */
            quantity: number;
        };
        Reservation: {
            /** Format: uuid */
            id: string;
            /** @example 3f6f2f0e-9b2a-4c6d-8e1a-2b3c4d5e6f70 */
            operationId: string;
            /** Format: uuid */
            eventId: string;
            /** Format: uuid */
            ticketTypeId: string;
            quantity: number;
            /** @enum {string} */
            status: "CONFIRMED" | "RELEASED";
            /** Format: date-time */
            expiresAt: string;
            /** Format: date-time */
            createdAt: string;
            /** @example 25 */
            unitPrice: number;
        };
        ReservationResponse: {
            reservation: components["schemas"]["Reservation"];
        };
        InternalSessionResponse: {
            session: {
                /** Format: uuid */
                id: string;
                /** @example Opening Keynote */
                title: string;
                /** @example Alex Nguyen */
                speaker: string;
                /** Format: date-time */
                startTime: string;
                /** Format: date-time */
                endTime: string;
                isLive: boolean;
                event: {
                    /** Format: uuid */
                    id: string;
                    /** @example Tech Summit Vietnam 2026 */
                    name: string;
                    /** Format: date-time */
                    startTime: string;
                    /** Format: date-time */
                    endTime: string;
                };
            };
        };
        AdmissionErrorBody: {
            /** @example ALREADY_CHECKED_IN */
            code: string;
            /** @example Ticket has already been checked in */
            message: string;
        };
        AdmissionValidationError: {
            /** @example validation */
            type: string;
            /** @example body */
            on: string;
            /** @example /password */
            property: string;
            /** @example Expected string length greater or equal to 8 */
            message: string;
            summary?: string;
            expected?: {
                [key: string]: unknown;
            };
            found?: {
                [key: string]: unknown;
            };
            errors?: {
                [key: string]: unknown;
            }[];
        };
        AdmissionHealthResponse: {
            /** @enum {string} */
            status: "ok" | "degraded";
            /** @example admission-service */
            service: string;
            /** @enum {string} */
            database: "ok" | "unavailable";
        };
        RegisterRequest: {
            /** Format: email */
            email: string;
            /** Format: password */
            password: string;
            fullName: string;
            /** @description Ignored; public registration always creates an ATTENDEE. */
            role?: string;
        };
        LoginRequest: {
            /** Format: email */
            email: string;
            password: string;
        };
        User: {
            /** Format: uuid */
            id: string;
            /** Format: email */
            email: string;
            fullName: string;
            /** @enum {string} */
            role: "ORGANIZER" | "STAFF" | "ATTENDEE";
        };
        AuthResponse: {
            /** @description JWT valid for 12 hours. */
            token: string;
            user: components["schemas"]["User"];
        };
        PlaceOrderRequest: {
            eventId: string;
            ticketTypeId: string;
            /** @default 1 */
            quantity: number;
        };
        OrderTicket: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "PENDING_PAYMENT" | "PAID" | "CHECKED_IN" | "CANCELLED";
            /** Format: uuid */
            eventId: string;
            /** Format: uuid */
            ticketTypeId: string;
            /** Format: date-time */
            checkedInAt: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        Order: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            userId: string;
            /** Format: uuid */
            eventId: string;
            /** Format: uuid */
            ticketTypeId: string;
            /** @enum {string} */
            status: "PENDING" | "PENDING_RECONCILIATION" | "COMPENSATING" | "CONFIRMED" | "FAILED";
            quantity: number;
            /** @example 50 */
            totalAmount: number;
            /** @example SOLD_OUT */
            failureCode: string | null;
            /** Format: date-time */
            createdAt: string;
            tickets: components["schemas"]["OrderTicket"][];
        };
        OrderResponse: {
            order: components["schemas"]["Order"];
        };
        TicketSummary: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            eventId: string;
            /** Format: uuid */
            ticketTypeId: string;
            /** @enum {string} */
            status: "PENDING_PAYMENT" | "PAID" | "CHECKED_IN" | "CANCELLED";
            /** @example CONFIRMED */
            orderStatus: string;
            /** Format: date-time */
            checkedInAt: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        TicketListResponse: {
            tickets: components["schemas"]["TicketSummary"][];
        };
        QrTokenResponse: {
            /** Format: uuid */
            ticketId: string;
            /** @description Ticket-bound JWT signed with RSA-SHA256 and carrying a TOTP code for the current 30-second step. */
            qrToken: string;
            /** @example 30 */
            expiresIn: number;
            /** @enum {string} */
            status: "PENDING_PAYMENT" | "PAID" | "CHECKED_IN" | "CANCELLED";
            /** Format: date-time */
            checkedInAt: string | null;
        };
        CheckinRequest: {
            qrToken: string;
            deviceId?: string;
            gate?: string;
        };
        CheckinTicket: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "CHECKED_IN";
            /** Format: date-time */
            checkedInAt: string;
            attendeeName: string;
        };
        CheckinSuccess: {
            /** @enum {string} */
            status: "CHECKIN_SUCCESS";
            /** @enum {string} */
            code: "CHECKIN_SUCCESS";
            ticket: components["schemas"]["CheckinTicket"];
            /** Format: uuid */
            logId: string;
        };
        CheckinConflict: {
            /** @enum {string} */
            code: "ALREADY_CHECKED_IN";
            message: string;
            ticket: {
                /** Format: uuid */
                id: string;
                /** @enum {string} */
                status: "CHECKED_IN";
                /** Format: date-time */
                checkedInAt: string | null;
                attendeeName: string;
            };
        };
        OfflineSyncRequest: {
            logs: {
                ticketId: string;
                /** Format: date-time */
                scannedAt: string;
                deviceId?: string;
            }[];
        };
        OfflineSyncResult: {
            ticketId: string;
            /** @enum {string} */
            status: "SYNCED" | "CONFLICT" | "DUPLICATE" | "ERROR";
            /** @example TICKET_NOT_FOUND */
            reason?: string;
            message?: string;
            attendeeName?: string;
            /** Format: uuid */
            logId?: string;
        };
        OfflineSyncResponse: {
            /** @example 2 */
            processed: number;
            /** @example 1 */
            synced: number;
            /** @example 1 */
            conflicts: number;
            /** @example 0 */
            duplicates: number;
            results: components["schemas"]["OfflineSyncResult"][];
        };
        InternalAccessResponse: {
            /** Format: uuid */
            userId: string;
            /** Format: uuid */
            eventId: string;
            checkedIn: boolean;
            hasAccess: boolean;
            /** Format: uuid */
            ticketId: string | null;
        };
        Attendee: {
            /** Format: uuid */
            id: string;
            /** Format: email */
            email: string;
            fullName: string;
        };
        AuthMeResponse: {
            user: components["schemas"]["User"];
        };
        StaffOrder: {
            /** Format: uuid */
            id: string;
            attendee: components["schemas"]["Attendee"];
            /** @enum {string} */
            status: "PENDING" | "PENDING_RECONCILIATION" | "COMPENSATING" | "CONFIRMED" | "FAILED";
            quantity: number;
            /** @example 50 */
            totalAmount: number;
            /** @example SOLD_OUT */
            failureCode: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            /** @example 2 */
            ticketsCount: number;
        };
        OrderListResponse: {
            orders: components["schemas"]["StaffOrder"][];
            nextCursor: string | null;
        };
        StaffTicket: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            eventId: string;
            /** Format: uuid */
            ticketTypeId: string;
            /** Format: uuid */
            orderId: string;
            /** @enum {string} */
            status: "PENDING_PAYMENT" | "PAID" | "CHECKED_IN" | "CANCELLED";
            /** @example CONFIRMED */
            orderStatus: string;
            /** Format: date-time */
            checkedInAt: string | null;
            /** Format: date-time */
            createdAt: string;
            attendee: components["schemas"]["Attendee"];
        };
        StaffTicketListResponse: {
            tickets: components["schemas"]["StaffTicket"][];
            nextCursor: string | null;
        };
        StaffOrderDetail: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "PENDING" | "PENDING_RECONCILIATION" | "COMPENSATING" | "CONFIRMED" | "FAILED";
            quantity: number;
            /** @example 50 */
            totalAmount: number;
            /** Format: date-time */
            createdAt: string;
        };
        CheckinLog: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            scannedBy: string;
            /** Format: date-time */
            scannedAt: string;
            isOffline: boolean;
            /** @example gate-1 */
            deviceId: string | null;
            /** @enum {string} */
            syncStatus: "SYNCED" | "CONFLICT";
        };
        TicketDetailResponse: {
            ticket: components["schemas"]["StaffTicket"];
            order: components["schemas"]["StaffOrderDetail"];
            checkinLogs: components["schemas"]["CheckinLog"][];
        };
        CheckinFeedItem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            ticketId: string;
            /** Format: date-time */
            scannedAt: string;
            isOffline: boolean;
            /** @enum {string} */
            syncStatus: "SYNCED" | "CONFLICT";
            /** @example gate-1 */
            deviceId: string | null;
            attendee: components["schemas"]["Attendee"];
            /** @enum {string} */
            ticketStatus: "PENDING_PAYMENT" | "PAID" | "CHECKED_IN" | "CANCELLED";
        };
        CheckinFeedResponse: {
            checkins: components["schemas"]["CheckinFeedItem"][];
            nextCursor: string | null;
        };
        AdmissionStatsResponse: {
            /** Format: uuid */
            eventId: string;
            tickets: {
                /** @example 100 */
                total: number;
                /** @example 42 */
                checkedIn: number;
                /** @example 58 */
                remaining: number;
            };
            orders: {
                /** @example 80 */
                total: number;
                /** @example 75 */
                confirmed: number;
                /** @example 3 */
                pending: number;
                /** @example 2 */
                failed: number;
                /** @example 100 */
                soldTickets: number;
            };
            byGate: {
                /** @example gate-1 */
                gate: string;
                /** @example 30 */
                count: number;
            }[];
            /** Format: date-time */
            lastCheckinAt: string | null;
        };
        EngagementErrorBody: {
            /** @example SESSION_NOT_LIVE */
            code: string;
            /** @example Session is not live yet */
            message: string;
        };
        EngagementValidationError: {
            /** @example validation */
            type: string;
            /** @example body */
            on: string;
            /** @example /content */
            property: string;
            /** @example Expected string to have a length of at least 1 */
            message: string;
            summary?: string;
            expected?: {
                [key: string]: unknown;
            };
            found?: {
                [key: string]: unknown;
            };
            errors?: {
                [key: string]: unknown;
            }[];
        };
        EngagementHealthResponse: {
            /** @enum {string} */
            status: "ok" | "degraded";
            /** @example engagement-service */
            service: string;
            /** @enum {string} */
            database: "ok" | "unavailable";
        };
        QAQuestion: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            sessionId: string;
            /** Format: uuid */
            userId: string;
            /** @example How does the circuit breaker recover? */
            content: string;
            /** @example 4 */
            upvotes: number;
            /** Format: date-time */
            createdAt: string;
        };
        QAQuestionListResponse: {
            /** Format: uuid */
            sessionId: string;
            questions: components["schemas"]["QAQuestion"][];
        };
        CreateQuestionRequest: {
            content: string;
        };
        CreateQuestionResponse: {
            question: components["schemas"]["QAQuestion"];
        };
        VoteResponse: {
            /** Format: uuid */
            questionId: string;
            /** @example 5 */
            upvotes: number;
            hasVoted: boolean;
        };
        PollOption: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            pollId: string;
            /** @example Very good */
            content: string;
            /** @example 12 */
            voteCount: number;
        };
        Poll: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            sessionId: string;
            /** @example How was the keynote? */
            title: string;
            isActive: boolean;
            /** Format: date-time */
            createdAt: string;
            options: components["schemas"]["PollOption"][];
        };
        PollListResponse: {
            /** Format: uuid */
            sessionId: string;
            polls: components["schemas"]["Poll"][];
        };
        PollResponse: {
            poll: components["schemas"]["Poll"];
        };
        PollVoteResponse: {
            /** Format: uuid */
            pollId: string;
            /** Format: uuid */
            optionId: string;
            voted: boolean;
        };
        CreatePollRequest: {
            title: string;
            options: string[];
        };
        UpdatePollRequest: {
            isActive: boolean;
        };
        SessionStatsResponse: {
            /** Format: uuid */
            sessionId: string;
            questions: {
                /** @example 12 */
                total: number;
                topQuestion: {
                    /** Format: uuid */
                    id: string;
                    /** @example How does the circuit breaker recover? */
                    content: string;
                    /** @example 7 */
                    upvotes: number;
                } | null;
            };
            activePoll: {
                /** Format: uuid */
                id: string;
                /** @example How was the keynote? */
                title: string;
                isActive: boolean;
                /** @example 31 */
                totalVotes: number;
            } | null;
            game: {
                /** @enum {string} */
                status: "WAITING" | "QUESTION_ACTIVE" | "ROUND_REVEALED" | "FINISHED";
                /** @example 1 */
                currentQuestionIndex: number;
                /** @example 3 */
                totalQuestions: number;
            } | null;
        };
        PollVoteRequest: {
            /** Format: uuid */
            optionId: string;
        };
        GameQuestion: {
            /** Format: uuid */
            id: string;
            /** @example 0 */
            orderNum: number;
            /** @example Which algorithm prevents double check-in? */
            content: string;
            options: string[];
            correctOption?: number;
            /** @example 30 */
            timeLimitSec?: number;
            /** Format: date-time */
            questionStartedAt?: string | null;
        };
        Game: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            sessionId: string;
            /** @enum {string} */
            status: "WAITING" | "QUESTION_ACTIVE" | "ROUND_REVEALED" | "FINISHED";
            /** @example 0 */
            currentQuestionIndex: number;
            /** @example 3 */
            totalQuestions?: number;
            questions?: components["schemas"]["GameQuestion"][];
            currentQuestion?: components["schemas"]["GameQuestion"];
        };
        GameResponse: {
            game: components["schemas"]["Game"];
        };
        AddQuestionRequest: {
            content: string;
            options: string[];
            correctOption: number;
            timeLimitSec: number;
        };
        QuizQuestionResponse: {
            question: components["schemas"]["GameQuestion"];
        };
        StartGameResponse: {
            game: components["schemas"]["Game"];
            currentQuestion: components["schemas"]["GameQuestion"];
        };
        RevealGameResponse: {
            game: components["schemas"]["Game"];
            correctOption: number;
        };
        AnswerRequest: {
            /** Format: uuid */
            questionId: string;
            selectedOption: number;
            /** @description Ignored; identity always comes from the JWT. */
            userId?: string;
            /** @description Ignored; the server measures elapsed time. */
            responseTimeMs?: number;
        };
        AnswerResponse: {
            isCorrect: boolean;
            /** @example 750 */
            score: number;
            /** @example 10000 */
            responseTimeMs: number;
        };
        LeaderboardEntry: {
            /** @example 1 */
            rank: number;
            /** Format: uuid */
            userId: string;
            /** @example 2750 */
            totalScore: number;
            /** @example 3 */
            correctCount: number;
        };
        LeaderboardResponse: {
            /** Format: uuid */
            gameId: string;
            leaderboard: components["schemas"]["LeaderboardEntry"][];
        };
    };
    responses: {
        /** @description Authentication is missing or the JWT is invalid. */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "UNAUTHORIZED",
                 *       "message": "Authentication is required"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorBody"];
            };
        };
        /** @description The caller is not an ORGANIZER. */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "FORBIDDEN",
                 *       "message": "Organizer role is required"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorBody"];
            };
        };
        /** @description The service token is missing or invalid. */
        ServiceUnauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "UNAUTHORIZED_SERVICE",
                 *       "message": "Valid service token is required"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorBody"];
            };
        };
        /** @description The request body or parameters do not satisfy the declared schema. */
        ValidationFailed: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "validation",
                 *       "on": "body",
                 *       "property": "/maxCapacity",
                 *       "message": "Expected number to be greater or equal to 1",
                 *       "summary": "string",
                 *       "expected": {},
                 *       "found": {},
                 *       "errors": [
                 *         {}
                 *       ]
                 *     }
                 */
                "application/json": components["schemas"]["ValidationError"];
            };
        };
        /** @description Authentication is missing or the JWT is invalid. */
        AdmissionUnauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "UNAUTHORIZED",
                 *       "message": "Authentication is required"
                 *     }
                 */
                "application/json": components["schemas"]["AdmissionErrorBody"];
            };
        };
        /** @description The service token is missing or invalid. */
        AdmissionServiceUnauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "UNAUTHORIZED_SERVICE",
                 *       "message": "Valid service token is required"
                 *     }
                 */
                "application/json": components["schemas"]["AdmissionErrorBody"];
            };
        };
        /** @description The request body or query does not satisfy the declared schema. */
        AdmissionValidationFailed: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "validation",
                 *       "on": "body",
                 *       "property": "/password",
                 *       "message": "Expected string length greater or equal to 8",
                 *       "summary": "string",
                 *       "expected": {},
                 *       "found": {},
                 *       "errors": [
                 *         {}
                 *       ]
                 *     }
                 */
                "application/json": components["schemas"]["AdmissionValidationError"];
            };
        };
        /** @description Authentication is missing or the JWT is invalid. */
        EngagementUnauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "UNAUTHORIZED",
                 *       "message": "Authentication is required"
                 *     }
                 */
                "application/json": components["schemas"]["EngagementErrorBody"];
            };
        };
        /** @description The caller is not a STAFF or ORGANIZER for the host-only action. */
        EngagementForbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "FORBIDDEN",
                 *       "message": "Only staff or organizer can perform this action"
                 *     }
                 */
                "application/json": components["schemas"]["EngagementErrorBody"];
            };
        };
        /** @description The request body or parameters do not satisfy the declared schema. */
        EngagementValidationFailed: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "validation",
                 *       "on": "body",
                 *       "property": "/content",
                 *       "message": "Expected string to have a length of at least 1",
                 *       "summary": "string",
                 *       "expected": {},
                 *       "found": {},
                 *       "errors": [
                 *         {}
                 *       ]
                 *     }
                 */
                "application/json": components["schemas"]["EngagementValidationError"];
            };
        };
        /** @description A dependency (Event Service or Admission Service) could not be reached. The client may retry with backoff. */
        UpstreamUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "EVENT_SERVICE_UNAVAILABLE",
                 *       "message": "Event Service is unavailable; try again later"
                 *     }
                 */
                "application/json": components["schemas"]["EngagementErrorBody"];
            };
        };
        /** @description A dependency did not answer within the internal timeout. The client may retry with backoff. */
        UpstreamTimeout: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["EngagementErrorBody"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service and database are reachable. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "status": "ok",
                     *       "service": "event-service",
                     *       "database": "ok"
                     *     }
                     */
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
            /** @description Database is unavailable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "status": "degraded",
                     *       "service": "event-service",
                     *       "database": "unavailable"
                     *     }
                     */
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    listEvents: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Events ordered by start time. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "events": [
                     *         {
                     *           "id": "00000000-0000-4000-8000-000000000001",
                     *           "name": "Tech Summit Vietnam 2026",
                     *           "venue": "Saigon Exhibition and Convention Center",
                     *           "startTime": "2026-11-09T08:00:00.000Z",
                     *           "endTime": "2026-11-09T08:00:00.000Z",
                     *           "maxCapacity": 500,
                     *           "reservedCount": 12,
                     *           "createdAt": "2026-11-09T08:00:00.000Z",
                     *           "rooms": [
                     *             {
                     *               "id": "00000000-0000-4000-8000-000000000002",
                     *               "name": "Main Hall",
                     *               "capacity": 500
                     *             }
                     *           ],
                     *           "sessions": [
                     *             {
                     *               "id": "00000000-0000-4000-8000-000000000003",
                     *               "title": "Opening Keynote",
                     *               "speaker": "Alex Nguyen",
                     *               "startTime": "2026-11-09T08:00:00.000Z",
                     *               "endTime": "2026-11-09T08:00:00.000Z",
                     *               "isLive": true
                     *             }
                     *           ],
                     *           "ticketTypes": [
                     *             {
                     *               "id": "44444444-4444-4444-8444-444444444444",
                     *               "name": "Standard",
                     *               "price": 25,
                     *               "quota": 500,
                     *               "soldCount": 12,
                     *               "available": 488
                     *             }
                     *           ]
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["EventListResponse"];
                };
            };
        };
    };
    createEvent: {
        parameters: {
            query?: never;
            header: {
                /** @description Forwarded by the API Gateway after JWT verification. The service rejects other roles with 403. */
                "x-user-role": "ORGANIZER";
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "name": "string",
                 *       "venue": "string",
                 *       "startTime": "2026-11-09T08:00:00.000Z",
                 *       "endTime": "2026-11-09T08:00:00.000Z",
                 *       "maxCapacity": 1,
                 *       "rooms": [
                 *         {
                 *           "name": "string",
                 *           "capacity": 1
                 *         }
                 *       ],
                 *       "sessions": [
                 *         {
                 *           "title": "string",
                 *           "speaker": "string",
                 *           "startTime": "2026-11-09T08:00:00.000Z",
                 *           "endTime": "2026-11-09T08:00:00.000Z",
                 *           "isLive": true
                 *         }
                 *       ],
                 *       "ticketTypes": [
                 *         {
                 *           "name": "string",
                 *           "price": 0,
                 *           "quota": 1
                 *         }
                 *       ]
                 *     }
                 */
                "application/json": components["schemas"]["CreateEventRequest"];
            };
        };
        responses: {
            /** @description Event created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "event": {
                     *         "id": "00000000-0000-4000-8000-000000000004",
                     *         "name": "Tech Summit Vietnam 2026",
                     *         "venue": "Saigon Exhibition and Convention Center",
                     *         "startTime": "2026-11-09T08:00:00.000Z",
                     *         "endTime": "2026-11-09T08:00:00.000Z",
                     *         "maxCapacity": 500,
                     *         "reservedCount": 12,
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "rooms": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000005",
                     *             "name": "Main Hall",
                     *             "capacity": 500
                     *           }
                     *         ],
                     *         "sessions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000006",
                     *             "title": "Opening Keynote",
                     *             "speaker": "Alex Nguyen",
                     *             "startTime": "2026-11-09T08:00:00.000Z",
                     *             "endTime": "2026-11-09T08:00:00.000Z",
                     *             "isLive": true
                     *           }
                     *         ],
                     *         "ticketTypes": [
                     *           {
                     *             "id": "44444444-4444-4444-8444-444444444444",
                     *             "name": "Standard",
                     *             "price": 25,
                     *             "quota": 500,
                     *             "soldCount": 12,
                     *             "available": 488
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["EventResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The event or session time is invalid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    getEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Event found. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "event": {
                     *         "id": "00000000-0000-4000-8000-000000000007",
                     *         "name": "Tech Summit Vietnam 2026",
                     *         "venue": "Saigon Exhibition and Convention Center",
                     *         "startTime": "2026-11-09T08:00:00.000Z",
                     *         "endTime": "2026-11-09T08:00:00.000Z",
                     *         "maxCapacity": 500,
                     *         "reservedCount": 12,
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "rooms": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000008",
                     *             "name": "Main Hall",
                     *             "capacity": 500
                     *           }
                     *         ],
                     *         "sessions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000009",
                     *             "title": "Opening Keynote",
                     *             "speaker": "Alex Nguyen",
                     *             "startTime": "2026-11-09T08:00:00.000Z",
                     *             "endTime": "2026-11-09T08:00:00.000Z",
                     *             "isLive": true
                     *           }
                     *         ],
                     *         "ticketTypes": [
                     *           {
                     *             "id": "44444444-4444-4444-8444-444444444444",
                     *             "name": "Standard",
                     *             "price": 25,
                     *             "quota": 500,
                     *             "soldCount": 12,
                     *             "available": 488
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["EventResponse"];
                };
            };
            /** @description The event does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "EVENT_NOT_FOUND",
                     *       "message": "Event was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    updateEvent: {
        parameters: {
            query?: never;
            header: {
                /** @description Forwarded by the API Gateway after JWT verification. The service rejects other roles with 403. */
                "x-user-role": "ORGANIZER";
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "name": "string",
                 *       "venue": "string",
                 *       "startTime": "2026-11-09T08:00:00.000Z",
                 *       "endTime": "2026-11-09T08:00:00.000Z",
                 *       "maxCapacity": 1
                 *     }
                 */
                "application/json": components["schemas"]["UpdateEventRequest"];
            };
        };
        responses: {
            /** @description Event updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "event": {
                     *         "id": "00000000-0000-4000-8000-000000000010",
                     *         "name": "Tech Summit Vietnam 2026",
                     *         "venue": "Saigon Exhibition and Convention Center",
                     *         "startTime": "2026-11-09T08:00:00.000Z",
                     *         "endTime": "2026-11-09T08:00:00.000Z",
                     *         "maxCapacity": 500,
                     *         "reservedCount": 12,
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "rooms": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000011",
                     *             "name": "Main Hall",
                     *             "capacity": 500
                     *           }
                     *         ],
                     *         "sessions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000012",
                     *             "title": "Opening Keynote",
                     *             "speaker": "Alex Nguyen",
                     *             "startTime": "2026-11-09T08:00:00.000Z",
                     *             "endTime": "2026-11-09T08:00:00.000Z",
                     *             "isLive": true
                     *           }
                     *         ],
                     *         "ticketTypes": [
                     *           {
                     *             "id": "44444444-4444-4444-8444-444444444444",
                     *             "name": "Standard",
                     *             "price": 25,
                     *             "quota": 500,
                     *             "soldCount": 12,
                     *             "available": 488
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["EventResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The event does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "EVENT_NOT_FOUND",
                     *       "message": "Event was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description The new capacity is lower than the reserved seats. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "CAPACITY_BELOW_RESERVED",
                     *       "message": "maxCapacity cannot be lower than the number of reserved seats"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description The event time is invalid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_EVENT_TIME",
                     *       "message": "Start time must be before end time"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    updateRoom: {
        parameters: {
            query?: never;
            header: {
                /** @description Forwarded by the API Gateway after JWT verification. The service rejects other roles with 403. */
                "x-user-role": "ORGANIZER";
            };
            path: {
                id: string;
                roomId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "name": "string",
                 *       "capacity": 1
                 *     }
                 */
                "application/json": components["schemas"]["UpdateRoomRequest"];
            };
        };
        responses: {
            /** @description Room updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "room": {
                     *         "id": "00000000-0000-4000-8000-000000000016",
                     *         "name": "Main Hall",
                     *         "capacity": 500
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RoomResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The room does not belong to this event. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "ROOM_NOT_FOUND",
                     *       "message": "Room was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            422: components["responses"]["ValidationFailed"];
        };
    };
    updateSession: {
        parameters: {
            query?: never;
            header: {
                /** @description Forwarded by the API Gateway after JWT verification. The service rejects other roles with 403. */
                "x-user-role": "ORGANIZER";
            };
            path: {
                id: string;
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "title": "string",
                 *       "speaker": "string",
                 *       "startTime": "2026-11-09T08:00:00.000Z",
                 *       "endTime": "2026-11-09T08:00:00.000Z",
                 *       "isLive": true
                 *     }
                 */
                "application/json": components["schemas"]["UpdateSessionRequest"];
            };
        };
        responses: {
            /** @description Session updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "session": {
                     *         "id": "00000000-0000-4000-8000-000000000017",
                     *         "title": "Opening Keynote",
                     *         "speaker": "Alex Nguyen",
                     *         "startTime": "2026-11-09T08:00:00.000Z",
                     *         "endTime": "2026-11-09T08:00:00.000Z",
                     *         "isLive": true
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The session does not belong to this event. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "SESSION_NOT_FOUND",
                     *       "message": "Session was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description The resulting session time is invalid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_SESSION_TIME",
                     *       "message": "Session start time must be before end time"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    updateTicketType: {
        parameters: {
            query?: never;
            header: {
                /** @description Forwarded by the API Gateway after JWT verification. The service rejects other roles with 403. */
                "x-user-role": "ORGANIZER";
            };
            path: {
                id: string;
                ticketTypeId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "name": "string",
                 *       "price": 0,
                 *       "quota": 1
                 *     }
                 */
                "application/json": components["schemas"]["UpdateTicketTypeRequest"];
            };
        };
        responses: {
            /** @description Ticket type updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "ticketType": {
                     *         "id": "00000000-0000-4000-8000-000000000018",
                     *         "name": "Standard",
                     *         "price": 25,
                     *         "quota": 500,
                     *         "soldCount": 12,
                     *         "available": 488
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TicketTypeResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The ticket type does not belong to this event. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "TICKET_TYPE_NOT_FOUND",
                     *       "message": "Ticket type was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description The new quota is below the sold count. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "QUOTA_BELOW_SOLD",
                     *       "message": "quota cannot be lower than the number of sold tickets"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            422: components["responses"]["ValidationFailed"];
        };
    };
    addRoom: {
        parameters: {
            query?: never;
            header: {
                /** @description Forwarded by the API Gateway after JWT verification. The service rejects other roles with 403. */
                "x-user-role": "ORGANIZER";
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "name": "string",
                 *       "capacity": 1
                 *     }
                 */
                "application/json": components["schemas"]["RoomRequest"];
            };
        };
        responses: {
            /** @description Room added. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "room": {
                     *         "id": "00000000-0000-4000-8000-000000000013",
                     *         "name": "Main Hall",
                     *         "capacity": 500
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RoomResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The event does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "EVENT_NOT_FOUND",
                     *       "message": "Event was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            422: components["responses"]["ValidationFailed"];
        };
    };
    addSession: {
        parameters: {
            query?: never;
            header: {
                /** @description Forwarded by the API Gateway after JWT verification. The service rejects other roles with 403. */
                "x-user-role": "ORGANIZER";
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "title": "string",
                 *       "speaker": "string",
                 *       "startTime": "2026-11-09T08:00:00.000Z",
                 *       "endTime": "2026-11-09T08:00:00.000Z",
                 *       "isLive": true
                 *     }
                 */
                "application/json": components["schemas"]["SessionRequest"];
            };
        };
        responses: {
            /** @description Session added. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "session": {
                     *         "id": "00000000-0000-4000-8000-000000000014",
                     *         "title": "Opening Keynote",
                     *         "speaker": "Alex Nguyen",
                     *         "startTime": "2026-11-09T08:00:00.000Z",
                     *         "endTime": "2026-11-09T08:00:00.000Z",
                     *         "isLive": true
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The event does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "EVENT_NOT_FOUND",
                     *       "message": "Event was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description The session time is invalid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_SESSION_TIME",
                     *       "message": "Session start time must be before end time"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    addTicketType: {
        parameters: {
            query?: never;
            header: {
                /** @description Forwarded by the API Gateway after JWT verification. The service rejects other roles with 403. */
                "x-user-role": "ORGANIZER";
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "name": "string",
                 *       "price": 0,
                 *       "quota": 1
                 *     }
                 */
                "application/json": components["schemas"]["TicketTypeRequest"];
            };
        };
        responses: {
            /** @description Ticket type added. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "ticketType": {
                     *         "id": "00000000-0000-4000-8000-000000000015",
                     *         "name": "Standard",
                     *         "price": 25,
                     *         "quota": 500,
                     *         "soldCount": 12,
                     *         "available": 488
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["TicketTypeResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The event does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "EVENT_NOT_FOUND",
                     *       "message": "Event was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            422: components["responses"]["ValidationFailed"];
        };
    };
    createReservation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "operationId": "string",
                 *       "eventId": "string",
                 *       "ticketTypeId": "string",
                 *       "quantity": 1
                 *     }
                 */
                "application/json": components["schemas"]["ReservationRequest"];
            };
        };
        responses: {
            /** @description Existing reservation replayed for the same operationId. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "reservation": {
                     *         "id": "00000000-0000-4000-8000-000000000022",
                     *         "operationId": "3f6f2f0e-9b2a-4c6d-8e1a-2b3c4d5e6f70",
                     *         "eventId": "00000000-0000-4000-8000-000000000023",
                     *         "ticketTypeId": "00000000-0000-4000-8000-000000000024",
                     *         "quantity": 1,
                     *         "status": "CONFIRMED",
                     *         "expiresAt": "2026-11-09T08:00:00.000Z",
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "unitPrice": 25
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ReservationResponse"];
                };
            };
            /** @description Seats held and reservation confirmed. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "reservation": {
                     *         "id": "00000000-0000-4000-8000-000000000019",
                     *         "operationId": "3f6f2f0e-9b2a-4c6d-8e1a-2b3c4d5e6f70",
                     *         "eventId": "00000000-0000-4000-8000-000000000020",
                     *         "ticketTypeId": "00000000-0000-4000-8000-000000000021",
                     *         "quantity": 1,
                     *         "status": "CONFIRMED",
                     *         "expiresAt": "2026-11-09T08:00:00.000Z",
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "unitPrice": 25
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ReservationResponse"];
                };
            };
            401: components["responses"]["ServiceUnauthorized"];
            /** @description The ticket type does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "TICKET_TYPE_NOT_FOUND",
                     *       "message": "Ticket type was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description Capacity is exhausted or the operationId conflicts with another payload. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            422: components["responses"]["ValidationFailed"];
        };
    };
    releaseReservation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                operationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Reservation released. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "reservation": {
                     *         "id": "00000000-0000-4000-8000-000000000025",
                     *         "operationId": "3f6f2f0e-9b2a-4c6d-8e1a-2b3c4d5e6f70",
                     *         "eventId": "00000000-0000-4000-8000-000000000026",
                     *         "ticketTypeId": "00000000-0000-4000-8000-000000000027",
                     *         "quantity": 1,
                     *         "status": "CONFIRMED",
                     *         "expiresAt": "2026-11-09T08:00:00.000Z",
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "unitPrice": 25
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ReservationResponse"];
                };
            };
            401: components["responses"]["ServiceUnauthorized"];
            /** @description The reservation does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "RESERVATION_NOT_FOUND",
                     *       "message": "Reservation was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    getInternalEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Event found. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "event": {
                     *         "id": "00000000-0000-4000-8000-000000000028",
                     *         "name": "Tech Summit Vietnam 2026",
                     *         "venue": "Saigon Exhibition and Convention Center",
                     *         "startTime": "2026-11-09T08:00:00.000Z",
                     *         "endTime": "2026-11-09T08:00:00.000Z",
                     *         "maxCapacity": 500,
                     *         "reservedCount": 12,
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "rooms": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000029",
                     *             "name": "Main Hall",
                     *             "capacity": 500
                     *           }
                     *         ],
                     *         "sessions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000030",
                     *             "title": "Opening Keynote",
                     *             "speaker": "Alex Nguyen",
                     *             "startTime": "2026-11-09T08:00:00.000Z",
                     *             "endTime": "2026-11-09T08:00:00.000Z",
                     *             "isLive": true
                     *           }
                     *         ],
                     *         "ticketTypes": [
                     *           {
                     *             "id": "44444444-4444-4444-8444-444444444444",
                     *             "name": "Standard",
                     *             "price": 25,
                     *             "quota": 500,
                     *             "soldCount": 12,
                     *             "available": 488
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["EventResponse"];
                };
            };
            401: components["responses"]["ServiceUnauthorized"];
            /** @description The event does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "EVENT_NOT_FOUND",
                     *       "message": "Event was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    getInternalSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Session found. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "session": {
                     *         "id": "00000000-0000-4000-8000-000000000031",
                     *         "title": "Opening Keynote",
                     *         "speaker": "Alex Nguyen",
                     *         "startTime": "2026-11-09T08:00:00.000Z",
                     *         "endTime": "2026-11-09T08:00:00.000Z",
                     *         "isLive": true,
                     *         "event": {
                     *           "id": "00000000-0000-4000-8000-000000000032",
                     *           "name": "Tech Summit Vietnam 2026",
                     *           "startTime": "2026-11-09T08:00:00.000Z",
                     *           "endTime": "2026-11-09T08:00:00.000Z"
                     *         }
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["InternalSessionResponse"];
                };
            };
            401: components["responses"]["ServiceUnauthorized"];
            /** @description The session does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "SESSION_NOT_FOUND",
                     *       "message": "Session was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    getCurrentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The authenticated user. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "user": {
                     *         "id": "00000000-0000-4000-8000-000000000004",
                     *         "email": "attendee@qevent.dev",
                     *         "fullName": "Nguyen Van A",
                     *         "role": "ATTENDEE"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["AuthMeResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
        };
    };
    register: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "email": "attendee@qevent.dev",
                 *       "password": "password123",
                 *       "fullName": "Nguyen Van A",
                 *       "role": "string"
                 *     }
                 */
                "application/json": components["schemas"]["RegisterRequest"];
            };
        };
        responses: {
            /** @description Account created and JWT issued. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVmM2I2ZSJ9.signature",
                     *       "user": {
                     *         "id": "00000000-0000-4000-8000-000000000002",
                     *         "email": "attendee@qevent.dev",
                     *         "fullName": "Nguyen Van A",
                     *         "role": "ATTENDEE"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["AuthResponse"];
                };
            };
            /** @description The email is already registered. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "EMAIL_TAKEN",
                     *       "message": "Email is already registered"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            422: components["responses"]["AdmissionValidationFailed"];
        };
    };
    login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "email": "attendee@qevent.dev",
                 *       "password": "password123"
                 *     }
                 */
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description Credentials accepted. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVmM2I2ZSJ9.signature",
                     *       "user": {
                     *         "id": "00000000-0000-4000-8000-000000000003",
                     *         "email": "attendee@qevent.dev",
                     *         "fullName": "Nguyen Van A",
                     *         "role": "ATTENDEE"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["AuthResponse"];
                };
            };
            /** @description The email or password is incorrect. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_CREDENTIALS",
                     *       "message": "Email or password is incorrect"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            422: components["responses"]["AdmissionValidationFailed"];
        };
    };
    listOrders: {
        parameters: {
            query: {
                eventId: string;
                status?: "PENDING" | "PENDING_RECONCILIATION" | "COMPENSATING" | "CONFIRMED" | "FAILED";
                q?: string;
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Orders ordered by creation time, newest first. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "orders": [
                     *         {
                     *           "id": "00000000-0000-4000-8000-000000000005",
                     *           "attendee": {
                     *             "id": "00000000-0000-4000-8000-000000000006",
                     *             "email": "attendee@qevent.dev",
                     *             "fullName": "Nguyen Van A"
                     *           },
                     *           "status": "PENDING",
                     *           "quantity": 1,
                     *           "totalAmount": 50,
                     *           "failureCode": "SOLD_OUT",
                     *           "createdAt": "2026-11-09T08:00:00.000Z",
                     *           "updatedAt": "2026-11-09T08:00:00.000Z",
                     *           "ticketsCount": 2
                     *         }
                     *       ],
                     *       "nextCursor": "string"
                     *     }
                     */
                    "application/json": components["schemas"]["OrderListResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The caller is not STAFF or ORGANIZER. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "FORBIDDEN",
                     *       "message": "Staff or organizer role is required"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            422: components["responses"]["AdmissionValidationFailed"];
        };
    };
    placeOrder: {
        parameters: {
            query?: never;
            header: {
                /** @description Client-generated unique key scoped to the authenticated user. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                 *       "ticketTypeId": "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
                 *       "quantity": 1
                 *     }
                 */
                "application/json": components["schemas"]["PlaceOrderRequest"];
            };
        };
        responses: {
            /** @description Reservation confirmed and tickets issued. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "order": {
                     *         "id": "00000000-0000-4000-8000-000000000007",
                     *         "userId": "5f3b6e2a-1c4d-4a8e-9b7f-2d6c8a1e4b90",
                     *         "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                     *         "ticketTypeId": "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
                     *         "status": "CONFIRMED",
                     *         "quantity": 1,
                     *         "totalAmount": 50,
                     *         "failureCode": null,
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "tickets": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000008",
                     *             "status": "PAID",
                     *             "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                     *             "ticketTypeId": "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
                     *             "checkedInAt": null,
                     *             "createdAt": "2026-11-09T08:00:00.000Z"
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description Reservation outcome is unknown; the order is pending reconciliation. */
            202: {
                headers: {
                    /** @description Order status URL for polling. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "order": {
                     *         "id": "00000000-0000-4000-8000-000000000009",
                     *         "userId": "5f3b6e2a-1c4d-4a8e-9b7f-2d6c8a1e4b90",
                     *         "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                     *         "ticketTypeId": "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
                     *         "status": "PENDING_RECONCILIATION",
                     *         "quantity": 1,
                     *         "totalAmount": 0,
                     *         "failureCode": null,
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "tickets": []
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description The Idempotency-Key header is missing. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "IDEMPOTENCY_KEY_REQUIRED",
                     *       "message": "Idempotency-Key header is required"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The key conflicts with another payload, or capacity is exhausted. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            422: components["responses"]["AdmissionValidationFailed"];
            /** @description Tickets could not be issued and the reservation was released. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "TICKET_ISSUE_FAILED",
                     *       "message": "Ticket issuance failed; reservation was released"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
        };
    };
    getOrder: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Order found. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "order": {
                     *         "id": "00000000-0000-4000-8000-000000000011",
                     *         "userId": "5f3b6e2a-1c4d-4a8e-9b7f-2d6c8a1e4b90",
                     *         "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                     *         "ticketTypeId": "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
                     *         "status": "CONFIRMED",
                     *         "quantity": 1,
                     *         "totalAmount": 50,
                     *         "failureCode": null,
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "tickets": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000012",
                     *             "status": "PAID",
                     *             "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                     *             "ticketTypeId": "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
                     *             "checkedInAt": null,
                     *             "createdAt": "2026-11-09T08:00:00.000Z"
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The order does not exist or is not visible to the caller. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "ORDER_NOT_FOUND",
                     *       "message": "Order was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
        };
    };
    listStaffTickets: {
        parameters: {
            query: {
                eventId: string;
                status?: "PENDING_PAYMENT" | "PAID" | "CHECKED_IN" | "CANCELLED";
                q?: string;
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tickets ordered by creation time, newest first. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "tickets": [
                     *         {
                     *           "id": "00000000-0000-4000-8000-000000000013",
                     *           "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                     *           "ticketTypeId": "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
                     *           "orderId": "00000000-0000-4000-8000-000000000014",
                     *           "status": "PENDING_PAYMENT",
                     *           "orderStatus": "CONFIRMED",
                     *           "checkedInAt": "2026-11-09T08:00:00.000Z",
                     *           "createdAt": "2026-11-09T08:00:00.000Z",
                     *           "attendee": {
                     *             "id": "00000000-0000-4000-8000-000000000015",
                     *             "email": "attendee@qevent.dev",
                     *             "fullName": "Nguyen Van A"
                     *           }
                     *         }
                     *       ],
                     *       "nextCursor": "string"
                     *     }
                     */
                    "application/json": components["schemas"]["StaffTicketListResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The caller is not STAFF or ORGANIZER. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "FORBIDDEN",
                     *       "message": "Staff or organizer role is required"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            422: components["responses"]["AdmissionValidationFailed"];
        };
    };
    listMyTickets: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tickets owned by the authenticated user. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "tickets": [
                     *         {
                     *           "id": "00000000-0000-4000-8000-000000000001",
                     *           "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                     *           "ticketTypeId": "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
                     *           "status": "CHECKED_IN",
                     *           "orderStatus": "CONFIRMED",
                     *           "checkedInAt": "2026-11-09T09:15:00.000Z",
                     *           "createdAt": "2026-11-09T08:00:00.000Z"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["TicketListResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
        };
    };
    getStaffTicket: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ticket detail. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "ticket": {
                     *         "id": "00000000-0000-4000-8000-000000000017",
                     *         "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                     *         "ticketTypeId": "9a2d5c7e-4f1b-4e3a-8c6d-5b2e9f1a3c70",
                     *         "orderId": "00000000-0000-4000-8000-000000000018",
                     *         "status": "PENDING_PAYMENT",
                     *         "orderStatus": "CONFIRMED",
                     *         "checkedInAt": "2026-11-09T08:00:00.000Z",
                     *         "createdAt": "2026-11-09T08:00:00.000Z",
                     *         "attendee": {
                     *           "id": "00000000-0000-4000-8000-000000000019",
                     *           "email": "attendee@qevent.dev",
                     *           "fullName": "Nguyen Van A"
                     *         }
                     *       },
                     *       "order": {
                     *         "id": "00000000-0000-4000-8000-000000000020",
                     *         "status": "PENDING",
                     *         "quantity": 1,
                     *         "totalAmount": 50,
                     *         "createdAt": "2026-11-09T08:00:00.000Z"
                     *       },
                     *       "checkinLogs": [
                     *         {
                     *           "id": "00000000-0000-4000-8000-000000000021",
                     *           "scannedBy": "00000000-0000-4000-8000-000000000022",
                     *           "scannedAt": "2026-11-09T08:00:00.000Z",
                     *           "isOffline": true,
                     *           "deviceId": "gate-1",
                     *           "syncStatus": "SYNCED"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["TicketDetailResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The caller is not STAFF or ORGANIZER. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "FORBIDDEN",
                     *       "message": "Staff or organizer role is required"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            /** @description The ticket does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "TICKET_NOT_FOUND",
                     *       "message": "Ticket was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
        };
    };
    getTicketQrToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A fresh dynamic QR token. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "ticketId": "1b4d7f9a-3c6e-4a2b-8d5f-7e9c1a3b5d20",
                     *       "qrToken": "eyJhbGciOiJSUzI1NiJ9.eyJ0aWQiOiIxYjRkN2Y5YSIsImVpZCI6IjdjMWU5YTNkIiwiY29kZSI6IjEyMzQ1NiJ9.signature",
                     *       "expiresIn": 30,
                     *       "status": "PAID",
                     *       "checkedInAt": null
                     *     }
                     */
                    "application/json": components["schemas"]["QrTokenResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The ticket belongs to another attendee. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "FORBIDDEN",
                     *       "message": "Ticket belongs to another attendee"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            /** @description The ticket does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "TICKET_NOT_FOUND",
                     *       "message": "Ticket was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            /** @description The ticket cannot produce a usable QR token. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
        };
    };
    listCheckins: {
        parameters: {
            query: {
                eventId: string;
                since?: string;
                gate?: string;
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Check-in logs, newest first. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "checkins": [
                     *         {
                     *           "id": "00000000-0000-4000-8000-000000000023",
                     *           "ticketId": "1b4d7f9a-3c6e-4a2b-8d5f-7e9c1a3b5d20",
                     *           "scannedAt": "2026-11-09T08:00:00.000Z",
                     *           "isOffline": true,
                     *           "syncStatus": "SYNCED",
                     *           "deviceId": "gate-1",
                     *           "attendee": {
                     *             "id": "00000000-0000-4000-8000-000000000024",
                     *             "email": "attendee@qevent.dev",
                     *             "fullName": "Nguyen Van A"
                     *           },
                     *           "ticketStatus": "PENDING_PAYMENT"
                     *         }
                     *       ],
                     *       "nextCursor": "string"
                     *     }
                     */
                    "application/json": components["schemas"]["CheckinFeedResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The caller is not STAFF or ORGANIZER. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "FORBIDDEN",
                     *       "message": "Staff or organizer role is required"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            /** @description The since filter is not a valid ISO date-time. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_SINCE",
                     *       "message": "since must be an ISO date-time"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
        };
    };
    checkIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "qrToken": "eyJhbGciOiJSUzI1NiJ9.eyJ0aWQiOiIxYjRkN2Y5YSIsImVpZCI6IjdjMWU5YTNkIiwiY29kZSI6IjEyMzQ1NiJ9.signature",
                 *       "deviceId": "gate-1",
                 *       "gate": "gate-a"
                 *     }
                 */
                "application/json": components["schemas"]["CheckinRequest"];
            };
        };
        responses: {
            /** @description The ticket was checked in. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "status": "CHECKIN_SUCCESS",
                     *       "code": "CHECKIN_SUCCESS",
                     *       "ticket": {
                     *         "id": "00000000-0000-4000-8000-000000000025",
                     *         "status": "CHECKED_IN",
                     *         "checkedInAt": "2026-11-09T08:00:00.000Z",
                     *         "attendeeName": "Nguyen Van A"
                     *       },
                     *       "logId": "3d6f8b2c-5e9a-4c4d-8f7b-9a2e1c3d5f40"
                     *     }
                     */
                    "application/json": components["schemas"]["CheckinSuccess"];
                };
            };
            /** @description The QR token is invalid, expired, or the ticket status is unusable. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The caller is not STAFF or ORGANIZER. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "FORBIDDEN",
                     *       "message": "Staff role is required"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            /** @description The ticket was already checked in or its order is not confirmed. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CheckinConflict"] | components["schemas"]["AdmissionErrorBody"];
                };
            };
            422: components["responses"]["AdmissionValidationFailed"];
        };
    };
    syncOfflineCheckins: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "logs": [
                 *         {
                 *           "ticketId": "1b4d7f9a-3c6e-4a2b-8d5f-7e9c1a3b5d20",
                 *           "scannedAt": "2026-11-09T08:00:00.000Z",
                 *           "deviceId": "gate-1"
                 *         }
                 *       ]
                 *     }
                 */
                "application/json": components["schemas"]["OfflineSyncRequest"];
            };
        };
        responses: {
            /** @description Per-scan synchronization results. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "processed": 1,
                     *       "synced": 1,
                     *       "conflicts": 0,
                     *       "duplicates": 0,
                     *       "results": [
                     *         {
                     *           "ticketId": "1b4d7f9a-3c6e-4a2b-8d5f-7e9c1a3b5d20",
                     *           "status": "SYNCED",
                     *           "reason": "TICKET_NOT_FOUND",
                     *           "message": "Ticket has already been checked in",
                     *           "attendeeName": "Nguyen Van A",
                     *           "logId": "3d6f8b2c-5e9a-4c4d-8f7b-9a2e1c3d5f40"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["OfflineSyncResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The caller is not STAFF or ORGANIZER. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "FORBIDDEN",
                     *       "message": "Staff role is required"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            422: components["responses"]["AdmissionValidationFailed"];
        };
    };
    getCheckinStats: {
        parameters: {
            query: {
                eventId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ticket, order and gate counters. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "eventId": "7c1e9a3d-2b6f-4c8a-8e5d-3a9b1c7e2f60",
                     *       "tickets": {
                     *         "total": 100,
                     *         "checkedIn": 42,
                     *         "remaining": 58
                     *       },
                     *       "orders": {
                     *         "total": 80,
                     *         "confirmed": 75,
                     *         "pending": 3,
                     *         "failed": 2,
                     *         "soldTickets": 100
                     *       },
                     *       "byGate": [
                     *         {
                     *           "gate": "gate-1",
                     *           "count": 30
                     *         }
                     *       ],
                     *       "lastCheckinAt": "2026-11-09T08:00:00.000Z"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionStatsResponse"];
                };
            };
            401: components["responses"]["AdmissionUnauthorized"];
            /** @description The caller is not STAFF or ORGANIZER. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "FORBIDDEN",
                     *       "message": "Staff or organizer role is required"
                     *     }
                     */
                    "application/json": components["schemas"]["AdmissionErrorBody"];
                };
            };
            422: components["responses"]["AdmissionValidationFailed"];
        };
    };
    verifyAccess: {
        parameters: {
            query: {
                userId: string;
                eventId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Access decision for the user and event. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InternalAccessResponse"];
                };
            };
            401: components["responses"]["AdmissionServiceUnauthorized"];
            422: components["responses"]["AdmissionValidationFailed"];
        };
    };
    listQuestions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Questions ordered by upvotes, then creation time. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "sessionId": "00000000-0000-4000-8000-000000000001",
                     *       "questions": [
                     *         {
                     *           "id": "00000000-0000-4000-8000-000000000002",
                     *           "sessionId": "00000000-0000-4000-8000-000000000003",
                     *           "userId": "00000000-0000-4000-8000-000000000004",
                     *           "content": "How does the circuit breaker recover?",
                     *           "upvotes": 4,
                     *           "createdAt": "2026-11-14T08:00:00.000Z"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["QAQuestionListResponse"];
                };
            };
        };
    };
    createQuestion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "content": "string"
                 *     }
                 */
                "application/json": components["schemas"]["CreateQuestionRequest"];
            };
        };
        responses: {
            /** @description Question created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "question": {
                     *         "id": "00000000-0000-4000-8000-000000000005",
                     *         "sessionId": "00000000-0000-4000-8000-000000000006",
                     *         "userId": "00000000-0000-4000-8000-000000000007",
                     *         "content": "How does the circuit breaker recover?",
                     *         "upvotes": 4,
                     *         "createdAt": "2026-11-14T08:00:00.000Z"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["CreateQuestionResponse"];
                };
            };
            /** @description The question content is empty. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "VALIDATION",
                     *       "message": "content must not be empty"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            /** @description Attendee access is denied. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The session does not exist in Event Service. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "SESSION_NOT_FOUND",
                     *       "message": "Session was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            422: components["responses"]["EngagementValidationFailed"];
            503: components["responses"]["UpstreamUnavailable"];
            504: components["responses"]["UpstreamTimeout"];
        };
    };
    toggleQuestionVote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                questionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Vote toggled. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "questionId": "00000000-0000-4000-8000-000000000008",
                     *       "upvotes": 5,
                     *       "hasVoted": true
                     *     }
                     */
                    "application/json": components["schemas"]["VoteResponse"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            /** @description The attendee has not checked in to the session's event (BR-6). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "NOT_CHECKED_IN",
                     *       "message": "Attendee has not checked in to this event"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The question does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "QUESTION_NOT_FOUND",
                     *       "message": "Question was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            503: components["responses"]["UpstreamUnavailable"];
            504: components["responses"]["UpstreamTimeout"];
        };
    };
    deleteQuestion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                questionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Question deleted. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
            /** @description The question does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "QUESTION_NOT_FOUND",
                     *       "message": "Question was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
        };
    };
    listPolls: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Polls ordered by creation time (newest first). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "sessionId": "00000000-0000-4000-8000-000000000009",
                     *       "polls": [
                     *         {
                     *           "id": "00000000-0000-4000-8000-000000000010",
                     *           "sessionId": "00000000-0000-4000-8000-000000000011",
                     *           "title": "How was the keynote?",
                     *           "isActive": true,
                     *           "createdAt": "2026-11-14T08:00:00.000Z",
                     *           "options": [
                     *             {
                     *               "id": "00000000-0000-4000-8000-000000000012",
                     *               "pollId": "00000000-0000-4000-8000-000000000013",
                     *               "content": "Very good",
                     *               "voteCount": 12
                     *             }
                     *           ]
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["PollListResponse"];
                };
            };
        };
    };
    createPoll: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "title": "string",
                 *       "options": [
                 *         "string"
                 *       ]
                 *     }
                 */
                "application/json": components["schemas"]["CreatePollRequest"];
            };
        };
        responses: {
            /** @description Poll created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "poll": {
                     *         "id": "00000000-0000-4000-8000-000000000014",
                     *         "sessionId": "00000000-0000-4000-8000-000000000015",
                     *         "title": "How was the keynote?",
                     *         "isActive": true,
                     *         "createdAt": "2026-11-14T08:00:00.000Z",
                     *         "options": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000016",
                     *             "pollId": "00000000-0000-4000-8000-000000000017",
                     *             "content": "Very good",
                     *             "voteCount": 12
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["PollResponse"];
                };
            };
            /** @description The poll has fewer than 2 non-empty options. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_OPTIONS",
                     *       "message": "Poll must have at least 2 options"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
            422: components["responses"]["EngagementValidationFailed"];
        };
    };
    votePoll: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pollId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "optionId": "00000000-0000-4000-8000-000000000018"
                 *     }
                 */
                "application/json": components["schemas"]["PollVoteRequest"];
            };
        };
        responses: {
            /** @description Vote applied (or removed when voting the same option twice). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "pollId": "00000000-0000-4000-8000-000000000019",
                     *       "optionId": "00000000-0000-4000-8000-000000000020",
                     *       "voted": true
                     *     }
                     */
                    "application/json": components["schemas"]["PollVoteResponse"];
                };
            };
            /** @description The poll is closed or the option is invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            /** @description The attendee has not checked in to the session's event (BR-6). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "NOT_CHECKED_IN",
                     *       "message": "Attendee has not checked in to this event"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The poll does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "POLL_NOT_FOUND",
                     *       "message": "Poll was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            422: components["responses"]["EngagementValidationFailed"];
            503: components["responses"]["UpstreamUnavailable"];
            504: components["responses"]["UpstreamTimeout"];
        };
    };
    updatePoll: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pollId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "isActive": true
                 *     }
                 */
                "application/json": components["schemas"]["UpdatePollRequest"];
            };
        };
        responses: {
            /** @description Poll updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "poll": {
                     *         "id": "00000000-0000-4000-8000-000000000021",
                     *         "sessionId": "00000000-0000-4000-8000-000000000022",
                     *         "title": "How was the keynote?",
                     *         "isActive": true,
                     *         "createdAt": "2026-11-14T08:00:00.000Z",
                     *         "options": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000023",
                     *             "pollId": "00000000-0000-4000-8000-000000000024",
                     *             "content": "Very good",
                     *             "voteCount": 12
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["PollResponse"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
            /** @description The poll does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "POLL_NOT_FOUND",
                     *       "message": "Poll was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            422: components["responses"]["EngagementValidationFailed"];
        };
    };
    getSessionGame: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Game summary. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "game": {
                     *         "id": "00000000-0000-4000-8000-000000000028",
                     *         "sessionId": "00000000-0000-4000-8000-000000000029",
                     *         "status": "WAITING",
                     *         "currentQuestionIndex": 0,
                     *         "totalQuestions": 3,
                     *         "questions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000030",
                     *             "orderNum": 0,
                     *             "content": "Which algorithm prevents double check-in?",
                     *             "options": [
                     *               "string"
                     *             ],
                     *             "correctOption": 0,
                     *             "timeLimitSec": 30,
                     *             "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *           }
                     *         ],
                     *         "currentQuestion": {
                     *           "id": "00000000-0000-4000-8000-000000000031",
                     *           "orderNum": 0,
                     *           "content": "Which algorithm prevents double check-in?",
                     *           "options": [
                     *             "string"
                     *           ],
                     *           "correctOption": 0,
                     *           "timeLimitSec": 30,
                     *           "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *         }
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["GameResponse"];
                };
            };
            /** @description No game exists for this session. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "GAME_NOT_FOUND",
                     *       "message": "No quiz game found for this session"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
        };
    };
    createSessionGame: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Game already existed and is returned unchanged. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "game": {
                     *         "id": "00000000-0000-4000-8000-000000000032",
                     *         "sessionId": "00000000-0000-4000-8000-000000000033",
                     *         "status": "WAITING",
                     *         "currentQuestionIndex": 0,
                     *         "totalQuestions": 3,
                     *         "questions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000034",
                     *             "orderNum": 0,
                     *             "content": "Which algorithm prevents double check-in?",
                     *             "options": [
                     *               "string"
                     *             ],
                     *             "correctOption": 0,
                     *             "timeLimitSec": 30,
                     *             "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *           }
                     *         ],
                     *         "currentQuestion": {
                     *           "id": "00000000-0000-4000-8000-000000000035",
                     *           "orderNum": 0,
                     *           "content": "Which algorithm prevents double check-in?",
                     *           "options": [
                     *             "string"
                     *           ],
                     *           "correctOption": 0,
                     *           "timeLimitSec": 30,
                     *           "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *         }
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["GameResponse"];
                };
            };
            /** @description Game created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "game": {
                     *         "id": "00000000-0000-4000-8000-000000000036",
                     *         "sessionId": "00000000-0000-4000-8000-000000000037",
                     *         "status": "WAITING",
                     *         "currentQuestionIndex": 0,
                     *         "totalQuestions": 3,
                     *         "questions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000038",
                     *             "orderNum": 0,
                     *             "content": "Which algorithm prevents double check-in?",
                     *             "options": [
                     *               "string"
                     *             ],
                     *             "correctOption": 0,
                     *             "timeLimitSec": 30,
                     *             "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *           }
                     *         ],
                     *         "currentQuestion": {
                     *           "id": "00000000-0000-4000-8000-000000000039",
                     *           "orderNum": 0,
                     *           "content": "Which algorithm prevents double check-in?",
                     *           "options": [
                     *             "string"
                     *           ],
                     *           "correctOption": 0,
                     *           "timeLimitSec": 30,
                     *           "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *         }
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["GameResponse"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
        };
    };
    addGameQuestion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                gameId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "content": "string",
                 *       "options": [
                 *         "string"
                 *       ],
                 *       "correctOption": 0,
                 *       "timeLimitSec": 1
                 *     }
                 */
                "application/json": components["schemas"]["AddQuestionRequest"];
            };
        };
        responses: {
            /** @description Question added at the next order number. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "question": {
                     *         "id": "00000000-0000-4000-8000-000000000040",
                     *         "orderNum": 0,
                     *         "content": "Which algorithm prevents double check-in?",
                     *         "options": [
                     *           "string"
                     *         ],
                     *         "correctOption": 0,
                     *         "timeLimitSec": 30,
                     *         "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["QuizQuestionResponse"];
                };
            };
            /** @description The question payload is invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
            /** @description The quiz game does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "GAME_NOT_FOUND",
                     *       "message": "Quiz game was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The game has already started. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_GAME_STATE",
                     *       "message": "Game status changed while adding question"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            422: components["responses"]["EngagementValidationFailed"];
        };
    };
    getGame: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                gameId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Game state for the caller's role. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "game": {
                     *         "id": "00000000-0000-4000-8000-000000000041",
                     *         "sessionId": "00000000-0000-4000-8000-000000000042",
                     *         "status": "WAITING",
                     *         "currentQuestionIndex": 0,
                     *         "totalQuestions": 3,
                     *         "questions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000043",
                     *             "orderNum": 0,
                     *             "content": "Which algorithm prevents double check-in?",
                     *             "options": [
                     *               "string"
                     *             ],
                     *             "correctOption": 0,
                     *             "timeLimitSec": 30,
                     *             "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *           }
                     *         ],
                     *         "currentQuestion": {
                     *           "id": "00000000-0000-4000-8000-000000000044",
                     *           "orderNum": 0,
                     *           "content": "Which algorithm prevents double check-in?",
                     *           "options": [
                     *             "string"
                     *           ],
                     *           "correctOption": 0,
                     *           "timeLimitSec": 30,
                     *           "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *         }
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["GameResponse"];
                };
            };
            /** @description The quiz game does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "GAME_NOT_FOUND",
                     *       "message": "Quiz game was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
        };
    };
    startGame: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                gameId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Game started and the first question is active. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "game": {
                     *         "id": "00000000-0000-4000-8000-000000000045",
                     *         "sessionId": "00000000-0000-4000-8000-000000000046",
                     *         "status": "WAITING",
                     *         "currentQuestionIndex": 0,
                     *         "totalQuestions": 3,
                     *         "questions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000047",
                     *             "orderNum": 0,
                     *             "content": "Which algorithm prevents double check-in?",
                     *             "options": [
                     *               "string"
                     *             ],
                     *             "correctOption": 0,
                     *             "timeLimitSec": 30,
                     *             "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *           }
                     *         ],
                     *         "currentQuestion": {
                     *           "id": "00000000-0000-4000-8000-000000000048",
                     *           "orderNum": 0,
                     *           "content": "Which algorithm prevents double check-in?",
                     *           "options": [
                     *             "string"
                     *           ],
                     *           "correctOption": 0,
                     *           "timeLimitSec": 30,
                     *           "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *         }
                     *       },
                     *       "currentQuestion": {
                     *         "id": "00000000-0000-4000-8000-000000000049",
                     *         "orderNum": 0,
                     *         "content": "Which algorithm prevents double check-in?",
                     *         "options": [
                     *           "string"
                     *         ],
                     *         "correctOption": 0,
                     *         "timeLimitSec": 30,
                     *         "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["StartGameResponse"];
                };
            };
            /** @description The game has no questions. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "NO_QUESTIONS",
                     *       "message": "Game must have at least one question to start"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
            /** @description The quiz game does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "GAME_NOT_FOUND",
                     *       "message": "Quiz game was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The game is not WAITING, or another request won the transition. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_GAME_STATE",
                     *       "message": "Cannot start a game with status QUESTION_ACTIVE"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
        };
    };
    revealGameAnswer: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                gameId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Round revealed. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "game": {
                     *         "id": "00000000-0000-4000-8000-000000000050",
                     *         "sessionId": "00000000-0000-4000-8000-000000000051",
                     *         "status": "WAITING",
                     *         "currentQuestionIndex": 0,
                     *         "totalQuestions": 3,
                     *         "questions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000052",
                     *             "orderNum": 0,
                     *             "content": "Which algorithm prevents double check-in?",
                     *             "options": [
                     *               "string"
                     *             ],
                     *             "correctOption": 0,
                     *             "timeLimitSec": 30,
                     *             "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *           }
                     *         ],
                     *         "currentQuestion": {
                     *           "id": "00000000-0000-4000-8000-000000000053",
                     *           "orderNum": 0,
                     *           "content": "Which algorithm prevents double check-in?",
                     *           "options": [
                     *             "string"
                     *           ],
                     *           "correctOption": 0,
                     *           "timeLimitSec": 30,
                     *           "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *         }
                     *       },
                     *       "correctOption": 0
                     *     }
                     */
                    "application/json": components["schemas"]["RevealGameResponse"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
            /** @description The quiz game does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "GAME_NOT_FOUND",
                     *       "message": "Quiz game was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The game is not in QUESTION_ACTIVE. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_GAME_STATE",
                     *       "message": "Cannot reveal answer when game is ROUND_REVEALED"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
        };
    };
    nextGameQuestion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                gameId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Next question is active. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "game": {
                     *         "id": "00000000-0000-4000-8000-000000000054",
                     *         "sessionId": "00000000-0000-4000-8000-000000000055",
                     *         "status": "WAITING",
                     *         "currentQuestionIndex": 0,
                     *         "totalQuestions": 3,
                     *         "questions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000056",
                     *             "orderNum": 0,
                     *             "content": "Which algorithm prevents double check-in?",
                     *             "options": [
                     *               "string"
                     *             ],
                     *             "correctOption": 0,
                     *             "timeLimitSec": 30,
                     *             "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *           }
                     *         ],
                     *         "currentQuestion": {
                     *           "id": "00000000-0000-4000-8000-000000000057",
                     *           "orderNum": 0,
                     *           "content": "Which algorithm prevents double check-in?",
                     *           "options": [
                     *             "string"
                     *           ],
                     *           "correctOption": 0,
                     *           "timeLimitSec": 30,
                     *           "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *         }
                     *       },
                     *       "currentQuestion": {
                     *         "id": "00000000-0000-4000-8000-000000000058",
                     *         "orderNum": 0,
                     *         "content": "Which algorithm prevents double check-in?",
                     *         "options": [
                     *           "string"
                     *         ],
                     *         "correctOption": 0,
                     *         "timeLimitSec": 30,
                     *         "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["StartGameResponse"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
            /** @description The quiz game does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "GAME_NOT_FOUND",
                     *       "message": "Quiz game was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The transition is not allowed. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
        };
    };
    endGame: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                gameId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Game finished. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "game": {
                     *         "id": "00000000-0000-4000-8000-000000000059",
                     *         "sessionId": "00000000-0000-4000-8000-000000000060",
                     *         "status": "WAITING",
                     *         "currentQuestionIndex": 0,
                     *         "totalQuestions": 3,
                     *         "questions": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000061",
                     *             "orderNum": 0,
                     *             "content": "Which algorithm prevents double check-in?",
                     *             "options": [
                     *               "string"
                     *             ],
                     *             "correctOption": 0,
                     *             "timeLimitSec": 30,
                     *             "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *           }
                     *         ],
                     *         "currentQuestion": {
                     *           "id": "00000000-0000-4000-8000-000000000062",
                     *           "orderNum": 0,
                     *           "content": "Which algorithm prevents double check-in?",
                     *           "options": [
                     *             "string"
                     *           ],
                     *           "correctOption": 0,
                     *           "timeLimitSec": 30,
                     *           "questionStartedAt": "2026-11-14T08:00:00.000Z"
                     *         }
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["GameResponse"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
            /** @description The quiz game does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "GAME_NOT_FOUND",
                     *       "message": "Quiz game was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The game is already finished. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "INVALID_GAME_STATE",
                     *       "message": "Game is already finished"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
        };
    };
    submitGameAnswer: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                gameId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "questionId": "00000000-0000-4000-8000-000000000063",
                 *       "selectedOption": 0,
                 *       "userId": "string",
                 *       "responseTimeMs": 1
                 *     }
                 */
                "application/json": components["schemas"]["AnswerRequest"];
            };
        };
        responses: {
            /** @description Answer scored. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "isCorrect": true,
                     *       "score": 750,
                     *       "responseTimeMs": 10000
                     *     }
                     */
                    "application/json": components["schemas"]["AnswerResponse"];
                };
            };
            /** @description The answer cannot be accepted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            /** @description The attendee has not checked in to the session's event (BR-6). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "NOT_CHECKED_IN",
                     *       "message": "Attendee has not checked in to this event"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The quiz game does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "GAME_NOT_FOUND",
                     *       "message": "Quiz game was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            /** @description The answer was already submitted or the question has not started. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "ALREADY_ANSWERED",
                     *       "message": "You have already submitted an answer for this question"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
            422: components["responses"]["EngagementValidationFailed"];
            503: components["responses"]["UpstreamUnavailable"];
            504: components["responses"]["UpstreamTimeout"];
        };
    };
    getGameLeaderboard: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                gameId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Leaderboard ordered by total score. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "gameId": "00000000-0000-4000-8000-000000000064",
                     *       "leaderboard": [
                     *         {
                     *           "rank": 1,
                     *           "userId": "00000000-0000-4000-8000-000000000065",
                     *           "totalScore": 2750,
                     *           "correctCount": 3
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["LeaderboardResponse"];
                };
            };
            /** @description The quiz game does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "GAME_NOT_FOUND",
                     *       "message": "Quiz game was not found"
                     *     }
                     */
                    "application/json": components["schemas"]["EngagementErrorBody"];
                };
            };
        };
    };
    getSessionStats: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Question, poll and game counters. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "sessionId": "00000000-0000-4000-8000-000000000025",
                     *       "questions": {
                     *         "total": 12,
                     *         "topQuestion": {
                     *           "id": "00000000-0000-4000-8000-000000000026",
                     *           "content": "How does the circuit breaker recover?",
                     *           "upvotes": 7
                     *         }
                     *       },
                     *       "activePoll": {
                     *         "id": "00000000-0000-4000-8000-000000000027",
                     *         "title": "How was the keynote?",
                     *         "isActive": true,
                     *         "totalVotes": 31
                     *       },
                     *       "game": {
                     *         "status": "WAITING",
                     *         "currentQuestionIndex": 1,
                     *         "totalQuestions": 3
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SessionStatsResponse"];
                };
            };
            401: components["responses"]["EngagementUnauthorized"];
            403: components["responses"]["EngagementForbidden"];
        };
    };
}

