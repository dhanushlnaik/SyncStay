# SyncStay

SyncStay is a channel manager + inventory sync layer for hotels, optimized for an India-focused OTA stack.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript + Tailwind + shadcn-style components
- Prisma + PostgreSQL
- better-auth (email/password credentials)
- BullMQ + Redis (sync workers)
- SSE (real-time simulation/log updates)

## Core Capabilities in This MVP

- Inventory CRUD by room type/date
- Booking simulation and conflict handling (first booking wins)
- Multi-channel sync queue (mock OTA behavior)
- Sync logs and channel health tracking
- Role-aware access for `MASTER_ADMIN` and `OWNER`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start infra:

```bash
docker compose up -d
```

3. Configure env:

```bash
cp .env.example .env
```

4. Generate Prisma client and apply migration:

```bash
npm run db:generate
npx prisma migrate dev --name init
```

5. Seed demo data:

```bash
npm run db:seed
```

6. Run app and worker in separate terminals:

```bash
npm run dev
npm run worker
```

7. Open app:

- `http://localhost:3000`

## API Surface

- Auth: `/api/auth/*`
- Inventory: `GET /api/inventory`, `PATCH /api/inventory/bulk`, `GET /api/inventory/calendar`
- Bookings: `GET/POST /api/bookings`, `POST /api/simulate/booking`
- Channels: `GET /api/channels`, `PATCH /api/channels/:id`
- Sync: `POST /api/sync/update`, `POST /api/sync/full`
- Logs & Stream: `GET /api/sync-logs`, `GET /api/stream/events`
- Ops: `GET /api/health/queue`

## Testing

```bash
npm run lint
npm test
npm run build
```

Playwright smoke test scaffold is included under `tests/e2e`.
