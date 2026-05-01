---
title: "MyWallet Sync Protocol v1"
author: assistant
date: 2026-05-01
status: draft
---

## Goals
- Preserve local-first UX while enabling multi-device convergence.
- Make sync idempotent so retries do not duplicate writes.
- Detect and resolve income conflicts explicitly.

## Batch Ops Endpoint
- URL: `POST /api/finance/sync/ops/`
- Payload shape:
  ```json
  {
    "ops": [
      {
        "op_id": "uuid",
        "type": "create|update|delete",
        "resource": "expense|income",
        "client_id": "optional-client-id",
        "payload": { }
      }
    ]
  }
  ```

## Response Shape
- Per-op results include status and a server timestamp.
  ```json
  {
    "results": [
      { "op_id": "uuid", "status": "ok", "result": { }, "processed_at": "..." },
      { "op_id": "uuid", "status": "conflict", "conflict": { }, "processed_at": "..." },
      { "op_id": "uuid", "status": "error", "error": "...", "processed_at": "..." }
    ]
  }
  ```

## Conflict Policy
- Income updates include `expected_updated_at` from the last server snapshot.
- If the server `updated_at` is newer and `force` is not set, the server returns:
  - `status: conflict`
  - `conflict.reason: stale_income_update`
  - `conflict.server_income` and `conflict.server_updated_at`
- Client resolutions:
  - Use cloud version: apply `server_income` locally.
  - Keep local version: re-send update with `force: true`.

## Expense Policy
- Creates return full serialized expense so clients can map temp IDs.
- Updates and deletes are last-writer-wins based on server apply order.
- Conflict UI for expenses is not implemented yet.

## Idempotency
- Each op uses a client-generated `op_id`.
- The backend stores `OperationLog` per user/op_id to return the original result on retry.

## Related Endpoints
- `/api/finance/income/` supports optional `expected_updated_at` for optimistic checks.
