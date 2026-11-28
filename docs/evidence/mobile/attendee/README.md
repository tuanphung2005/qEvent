# Attendee evidence — Android emulator (Medium Phone, API 37)

Captured 2026-11-28 against the local stack (`docker compose up`, `bun run seed`,
`bun run demo:seed`) with the Expo 56 app running in Expo Go.

| File | Screen | Account |
|---|---|---|
| `login-android.png` | Auth login form | signed out |
| `tickets-android.png` | Ticket list, paid + pending states | `attendee3@qevent.com` |
| `ticket-pending-android.png` | Pending-payment ticket hides the QR | `attendee3@qevent.com` |
| `qr-screen-capture-blocked-android.png` | `adb screencap` while the QR screen is active → black frame (Android `FLAG_SECURE`) | `attendee3@qevent.com` |
| `qr-screen-ui-android.txt` | Accessibility tree of the active QR screen, captured while screenshots are blocked | `attendee3@qevent.com` |
| `live-android.png` | Live sessions for checked-in events | `attendee@qevent.com` |
| `qa-android.png` | Q&A list, upvote state, realtime banner | `attendee@qevent.com` |
| `polls-android.png` | Poll results and vote affordance | `attendee@qevent.com` |
| `quiz-reveal-android.png` | Revealed answer (correct option highlighted) | `attendee@qevent.com` |
| `quiz-leaderboard-android.png` | Finished game leaderboard with "Bạn" | `attendee@qevent.com` |
| `profile-android.png` | Account + logout | `attendee@qevent.com` |

Notes:

- **No visible QR screenshot exists on Android by design.** `expo-screen-capture`
  sets `FLAG_SECURE` while the signed QR is mounted, so `adb screencap` returns a
  black frame. That black frame is the evidence that screen capture is blocked;
  the accessibility tree proves the QR screen rendered and the countdown ticks.
  iOS only overlays/notifies, so capture is not blocked there (documented in
  `docs/MOBILE_APP_TEAM_SPLIT_3.md` §6.2).
- The floating gear at the top-right is the Expo Go developer menu, not app UI.
- Screens were verified on the emulator only; the device checklist (camera,
  airplane mode, haptics) belongs to Vũ's scanner work, not this surface.
