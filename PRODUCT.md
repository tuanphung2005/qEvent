# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users
- **Event Attendees (Khách tham dự)**: Arrive at event venues needing fast access to their tickets, clear entrance status, and a dynamic 30-second TOTP QR code (RSA-256) that prevents screenshot fraud even in spotty connectivity. During the event, participate in live Q&A sessions with real-time upvoting.
- **Event Staff / Ticket Checkers (Nhân viên soát vé)**: Operate at event entry gates under high pressure and variable lighting/connectivity. Perform sub-second ticket validation using camera scanning with instant multi-sensory feedback (haptic vibration, audio chime, screen flash: Green/Amber/Red). Operate seamlessly offline via local SQLite cache and monitor background sync queues.
- **Organizers (Ban tổ chức)**: Manage event access parameters and test purchase flows (Sandbox mode).

## Product Purpose
qEvent (QUICKEVENT) is an instant event ticketing and entry management system engineered to eliminate entrance bottlenecks, screenshot ticket fraud, and gate downtime caused by unstable internet connections. Success means sub-second check-in times per attendee, zero unauthorized duplicate entries, and frictionless attendee access.

## Positioning
Hybrid Check-in architecture combining RSA-256 + 30-second TOTP Dynamic QR codes with offline-first SQLite verification. Unlike standard static ticketing apps that fail when venue networks drop or allow fraudulent screenshot sharing, qEvent enforces cryptographic freshness while guaranteeing offline gate continuity with automatic background conflict resolution.

## Operating Context
- **Venue Entry Gates**: Crowded, noisy, fast-paced environments with high glare or dim lighting; staff scanning attendees' screens sequentially with handheld phones.
- **Auditoriums / Event Halls**: Active attendee participation in live Q&A while talks are occurring, requiring immediate WebSocket upvote responsiveness.
- **Network Conditions**: Variable connectivity, frequent dropouts, or total offline periods at venue perimeters.

## Capabilities and Constraints
- **Dynamic QR Generation**: Client-side ticket rendering with 30s rotating RSA-256/TOTP payload and countdown ring.
- **Anti-Screenshot Security**: Screen capture blocking enabled on ticket details screen via `expo-screen-capture`.
- **High-Speed Scanner**: Camera-based QR reader with immediate sensory feedback (sound chime via `expo-av`, haptic vibration via `expo-haptics`).
- **Offline Cache & Sync**: Local SQLite database storing cached ticket tokens; offline check-in queue that syncs automatically when network reconnects.
- **Design Constraints (Binding)**:
  - **Light Theme Only**: Background `#F8FAFC` or `#FFFFFF`, Card surfaces `#FFFFFF`, Text `#0F172A` / `#475569`.
  - **Zero Borders**: `borderWidth: 0` across all cards, buttons, inputs, tabs, bottom sheets, and badges. No outlines or hairlines.
  - **Bottom Drop Shadow Only**: Natural elevation using bottom-directed shadows (`elevation` on Android, bottom offset on iOS).
  - **No Blur / No Glassmorphism**: Prohibited use of `BlurView` or blur filters. Flat translucent overlays only (`rgba(15, 23, 42, 0.45)`).

## Brand Commitments
- **Name**: qEvent (QUICKEVENT)
- **Voice**: Clean, instantaneous, reliable, professional, authoritative without being intimidating.
- **Identity Palette**: Primary Blue/Indigo (`#2563EB`), Success Emerald (`#10B981`), Warning Amber (`#F59E0B`), Error Red (`#EF4444`).

## Evidence on Hand
- Full MVP technical specification in [MVP.md](file:///D:/outsourced/qEvent/MVP.md)
- Complete functional mobile codebase in [app/](file:///D:/outsourced/qEvent/app) with Expo Router routes: `(auth)/login.tsx`, `(attendee)/tickets.tsx`, `(attendee)/ticket/[id].tsx`, `(attendee)/qa.tsx`, `(staff)/scanner.tsx`, `(staff)/sync-status.tsx`.
- Backend server in [backend/](file:///D:/outsourced/qEvent/backend) with ElysiaJS + Prisma + PostgreSQL.

## Product Principles
1. **Gate Speed is Non-Negotiable**: Every millisecond saved at check-in reduces attendee queuing frustration; feedback must be immediate and multi-sensory.
2. **Offline-First Resilience**: An event entrance must never halt because the Wi-Fi or 4G dropped. Check-in must function fully in airplane mode.
3. **Cryptographic Trust Over Visual Inspection**: Staff verify algorithmic authenticity, not visual badge inspection; anti-fraud is automatic and deterministic.
4. **Calm, High-Legibility Visual Ergonomics**: High-contrast, glare-resistant light theme with zero visual clutter or distracting decoration.
