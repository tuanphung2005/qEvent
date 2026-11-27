# Maestro fixtures

Seed accounts (password `password123`, from `services/admission-service/prisma/seed.ts`):

| Role | Email |
|---|---|
| ATTENDEE | `attendee@qevent.com` |
| ATTENDEE | `attendee2@qevent.com` |
| STAFF | `staff1@qevent.com` |
| STAFF | `staff2@qevent.com` |
| ORGANIZER | `organizer@qevent.com` |
| HOST (không dùng app) | `host@qevent.com` |

Để Maestro bỏ qua form login:

```bash
export EXPO_PUBLIC_E2E=1
export EXPO_PUBLIC_E2E_TOKEN="<JWT lấy từ POST /api/auth/login>"
```

Không commit token thật. Flow phải dùng `EXPO_PUBLIC_E2E_TOKEN` để chạy offline không cần login.
