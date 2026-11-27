# qEvent Mobile

App Expo cho attendee và staff soát vé. Kế hoạch đầy đủ: `docs/MOBILE_APP_TEAM_SPLIT_3.md`.
Prompt cho agent: `docs/MOBILE_AGENT_PROMPTS_3.md`.

## Chạy

```bash
# Backend + seed (từ root repo)
docker compose up -d --build
bun run seed && bun run demo:seed

# Mobile
cd mobile
bun install
cp .env.example .env.local   # sửa IP LAN nếu chạy máy thật
bun run start
```

| Lệnh                              | Việc                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| `bun run start`                   | Expo dev server                                             |
| `bun run ios` / `bun run android` | Mở simulator/emulator                                       |
| `bun run typecheck`               | TypeScript strict                                           |
| `bun run lint`                    | ESLint (Expo config)                                        |
| `bun run test`                    | Jest + RNTL (hiện: offline core)                            |
| `bun run openapi:types`           | Sinh lại `src/api/generated/*` từ `services/*/openapi.json` |

## Stack

Expo SDK 56 + Expo Router + TypeScript strict; NativeWind 4 / Tailwind 3; React Native Reusables
(copy-in) trong `src/components/ui`; TanStack Query; `openapi-fetch`; React Hook Form + Zod;
`expo-secure-store`; `expo-sqlite`; `expo-network`; `expo-camera`; `expo-audio`; `expo-haptics`;
`expo-screen-capture`; `jsrsasign` cho verify RSA offline.

> Expo SDK 56 là bản mà template Reusables đang pin. Nâng SDK là việc riêng, không trộn với
> thay đổi feature. Lưu ý: SDK 56 dùng Hermes V1 có memory regression đã biết; SDK 57 sửa lỗi
> này nhưng lần nâng thử đầu tiên bị treo ở bước resolve của `bun` (registry stall), nên chưa
> đưa vào PR này. Theo dõi ở risk §12 của plan.

## Ranh giới

- `app/_layout.tsx`, `app/index.tsx`, `app/(auth)/**`, `src/api/**`, `src/auth/**`, `src/theme/**`,
  `src/components/**`, `src/lib/**`, `src/test/**`: Tuấn.
- `app/(attendee)/**`, `src/features/tickets|engagement/**`: Thành.
- `app/(staff)/**`, `src/features/scanner|sync/**`: Vũ.
- Không sửa `src/api/generated/**` bằng tay.
