# RenderFlow

## Project

Cross-platform Remotion code-to-video runtime app. Users paste Remotion (React) code, preview it, and render professional video via cloud rendering.

## Monorepo Structure

```
renderflow/
├── apps/
│   ├── mobile/          # React Native (Expo) app
│   └── api/             # Node.js Fastify backend
├── packages/
│   ├── shared/          # Shared TypeScript types, constants, validation schemas
│   └── ui/              # Shared UI components (if needed for web later)
├── workers/
│   └── render/          # Cloud render worker (Docker)
├── CLAUDE.md
├── package.json         # Workspace root
└── turbo.json           # Turborepo config
```

## Stack

- **Mobile:** Expo SDK 52+, Expo Router v4, TypeScript 5.x, React Native Paper 5
- **State:** Zustand + TanStack Query v5
- **Local DB:** expo-sqlite + Drizzle ORM
- **Backend:** Node.js 20 LTS, Fastify 5, Drizzle ORM, PostgreSQL 16
- **Queue:** Redis 7 + BullMQ
- **Auth:** JWT (access + refresh) + bcrypt
- **Storage:** Cloudflare R2 (S3-compatible)
- **Real-time:** Socket.io
- **Validation:** Zod (shared between mobile and API)
- **Render Worker:** Docker (Node.js 20 + Remotion 4 + Chromium + FFmpeg)
- **CI/CD:** GitHub Actions
- **Deployment:** Fly.io (API + workers), EAS Build (mobile)

## Commands

- **Mobile dev:** `cd apps/mobile && npx expo start`
- **API dev:** `cd apps/api && npm run dev`
- **Test (mobile):** `cd apps/mobile && npm test`
- **Test (API):** `cd apps/api && npm test`
- **Lint:** `npm run lint` (root)
- **Build (mobile):** `cd apps/mobile && eas build`
- **Build (API):** `cd apps/api && npm run build`
- **Type check:** `npm run typecheck` (root)

## Conventions

- All files use TypeScript (`.ts`/`.tsx`), never JavaScript
- React components: PascalCase files, named exports
- Hooks: camelCase, `use` prefix, one hook per file
- API routes: kebab-case URLs, camelCase handler files
- Zod schemas: defined in `packages/shared/src/schemas/`, imported by both mobile and API
- Database: snake_case columns, camelCase in TypeScript (Drizzle handles mapping)
- Error handling: custom `AppError` class with error codes, never throw raw strings
- Tests: co-located `__tests__/` folders, `.test.ts` suffix
- Imports: absolute paths via TypeScript path aliases (`@renderflow/shared`, `~/`)

## Rules

1. Output complete code. No placeholders, no `// ...`, no TODOs in place of logic.
2. Run tests after every meaningful change.
3. Verify every npm package exists on npmjs.com before adding it.
4. Do not modify: `.github/workflows/`, `CLAUDE.md` without explicit approval.
5. Max 3 fix attempts on any single failing test — report blocker instead.
6. Follow existing patterns in the codebase. Do not invent new architectural patterns.
7. All API endpoints must have Zod input validation.
8. All database queries must use Drizzle ORM, never raw SQL.
