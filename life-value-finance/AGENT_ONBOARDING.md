Agent onboarding — scale & backend sync tasks

Purpose
- Provide a clear, actionable checklist and code stubs for an agent/developer who will scale this project and implement backend synchronization.
- Each section shows the file(s) to edit, why, what to implement, sample payloads, and testing steps.

Quick summary of current state
- App is a PWA: `manifest.webmanifest`, `ngsw-config.json`, and `ngsw-worker.js` are present.
- Local persistence: `PersistenceService` saves app state to `localStorage`.
- Offline queue: `OfflineSyncService` records queued operations in `localStorage` under `offline_sync_queue_v1`.
- Headless test exists at `scripts/check-sw-control.js` and a manual verification doc is available.

Top-level goals for the agent
1. Implement robust client->server sync using the existing `OfflineSyncService` queue.
2. Ensure idempotent, secure server endpoints to accept queued operations and apply them safely.
3. Implement automatic flush on network restore and (optionally) Background Sync via Service Worker.
4. Audit app startup so the UI shows a shell when offline (no blocking calls).

Client-side tasks (code locations & guidance)

1) `OfflineSyncService` enhancements
- File: `src/app/core/services/offline-sync.service.ts`
- What to add:
  - `async flush(baseUrl: string, authToken?: string)` : drains queue and POSTs ops to `/api/sync/batch` (or `/api/sync/op`).
  - Use `operationId` (UUID) in each op and send it with requests for idempotency.
  - On success remove entries from queue; on failure keep and retry later.
  - Emit events/return status so UI or logs can show progress.
- Important: use exponential backoff on failure; do small batches (e.g., 10 ops).

2) New `RemoteSyncService` (client-side helper)
- File: `src/app/core/services/remote-sync.service.ts` (create)
- Responsibility:
  - Provide `postBatch(ops)` and `postOp(op)` methods.
  - Include sample fetch code with headers: `Content-Type: application/json` and `Idempotency-Key` header from `op.id`.
  - Handle HTTP 409/500 and turn into retryable or fatal errors.

3) Automatic flush integration
- Place in `src/main.ts` or inside `AppComponent` bootstrap:
  - `window.addEventListener('online', () => offlineSyncService.flush(BASE_URL, token))`.
  - On app start, if `navigator.onLine` call `flush()`.
- Provide a small retry queue if flush is in progress or fails.

4) Background Sync (optional/advanced)
- Implement a Service Worker background sync registration:
  - When enqueueing operations, try to call `registration.sync.register('my-app-sync')`.
  - In SW `sync` event handler, open client cache or call fetch to flush queue via `clients.matchAll()` + postMessage or directly do fetch in SW (if ops serializable).
- Caveats: Background Sync support is limited (Chrome); fall back to `online` event flushing.

Server-side API contract (suggested)
- Endpoint: `POST /api/sync/batch`
  - Body: { operations: [{ id, type, payload, clientId, timestamp }], clientId }
  - Headers: `Authorization: Bearer <token>` (if needed), `Idempotency-Key: <batch-id>`
  - Behavior: Server must process operations idempotently (use `operation.id` to dedupe). Return 200 with list of processed op ids and per-op status.
  - Error codes: 429/503 for retryable; 4xx for fatal.

- Endpoint: `POST /api/sync/op` (single op) — fallback for immediate retries.

Idempotency & conflict handling
- Server should store recent operation IDs per user and ignore duplicates.
- Conflict resolution strategies (pick one):
  - Last-write-wins (timestamp).
  - Merge strategy per entity type.
  - Manual conflict resolution UI for complex data.

Sample operation payload (budget expense example)
{
  "id": "uuid-v4-op-123",
  "type": "expense.create",
  "clientId": "guest-abc-123",
  "timestamp": "2026-03-01T12:00:00Z",
  "payload": {
    "id": "expense-uuid-456",
    "amount": 25.5,
    "category": "Food",
    "date": "2026-03-01",
    "notes": "Lunch"
  }
}

Testing & validation
- Manual:
  1. Put app offline. Create operations (add expenses). Confirm `offline_sync_queue_v1` has entries.
  2. Bring app online. Confirm `flush()` runs and server received ops; queue emptied.
- Automated:
  - Add unit tests around `OfflineSyncService.enqueue()` and `flush()` using a mocked `fetch`.
  - Use integration tests to post to a staging API that echoes results.

Dev checklist for the agent
- [ ] Implement `flush()` in `OfflineSyncService` (client).
- [x] Implement `flush()` in `OfflineSyncService` (client).
- [ ] Add `RemoteSyncService` with robust fetch + idempotency header.
- [ ] Wire `online` listener and startup flush.
- [ ] Add small batch size and exponential backoff logic.
- [ ] Implement server endpoints with idempotency handling.
- [ ] Add tests and run headless SW + sync tests.

Notes & tips
- Keep batch sizes small to avoid large retries. Prefer batching multiple small ops into one server batch request.
- Always include `operation.id` and `clientId` to dedupe on server.
- Log sync failures to provide debugging info in production (consider a telemetry endpoint).

Files to open first (quick links)
- `src/app/core/services/offline-sync.service.ts`
- `src/app/core/services/persistence.service.ts`
- `src/app/core/services/savings.service.ts`
- `src/main.ts` (for wiring online listener)

Contact
- If you need me to implement Option A (automatic flush + simple server contract) I will add a `RemoteSyncService`, a `flush()` method in `OfflineSyncService`, wiring in `main.ts`, unit tests, and update this doc with examples of server responses.

