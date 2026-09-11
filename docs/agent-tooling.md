# AI-assisted development tooling

This repo is set up so coding agents work from **current** platform knowledge instead of stale training data.

## MCP servers (`.mcp.json`)

| Server | What it gives the agent | Auth |
| --- | --- | --- |
| **Expo MCP** (`https://mcp.expo.dev/mcp`) | Latest Expo/Expo Router docs on demand, `npx expo install` version resolution, EAS build/update history, simulator screenshots & UI automation when the dev server runs with MCP enabled (SDK 54+) | OAuth (Expo account; preview is available on paid EAS plans) |
| **Supabase MCP** (`https://mcp.supabase.com/mcp`) | Schema inspection, SQL explain, migration review, docs search, log debugging. Configured **read-only** by default. | OAuth (Supabase account) |

Client setup:

- **Claude Code**: `claude plugin install expo@claude-plugins-official` (registers Expo skills + MCP), then `/mcp` to sign in. The `.mcp.json` is picked up automatically for the Supabase server.
- **Cursor / VS Code / Codex**: point the MCP settings at `.mcp.json` or paste the two URLs (type: Streamable HTTP).
- **Supabase Agent Skills**: `npx skills add supabase/agent-skills` for Postgres/RLS best-practice prompts.

Never enable Supabase MCP write access against production. Never paste service-role keys into an agent session.

## Libraries chosen for mobile consistency

| Concern | Library | Why |
| --- | --- | --- |
| Routing | Expo Router (SDK 55 / RN 0.83, New Architecture) | File-based, typed routes, deep links (`paytsek://pair?c=…`, share sheet) |
| UI kit | React Native Paper (Material Design 3) | Mature, accessible components, light/dark theming, identical look on Android & iOS; status always shown with icon + text |
| Server state | TanStack Query v5 | Single source of truth, refetch on reconnect/focus, no duplicated stores |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) | Same Zod contracts as the API |
| Secure storage | expo-secure-store | Keychain/Keystore-backed session + IDs |
| Offline drafts | expo-sqlite + expo-file-system | Durable pre-upload queue |
| Camera / import | expo-camera, expo-image-picker | Development-build native |
| OCR | ML Kit Text Recognition v2 via `modules/receipt-ocr` | On-device, bundled model, free |
| Billing | react-native-purchases (RevenueCat) | StoreKit/Play Billing wrapper; server verifies entitlements |
| Web | Next.js 16 + Tailwind v4 | Same brand tokens as the app theme |

## Prompts that work well

- "Use the Expo MCP to check the current `expo-camera` API before editing `apps/mobile/app/(tabs)/scan.tsx`."
- "Use Supabase MCP (read-only) to explain the query plan for `loadCandidateEvents` in `reconcile.service.ts`."
- "Run `pnpm test` and fix only failing assertions; do not weaken the matcher adversarial suite."
