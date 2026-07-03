# Step 7 - Cleanup Legacy Storage Code

Purpose: remove remaining direct localStorage usage and legacy persistence services.

## Updated files

- src/app/core/services/auth.service.ts
- src/app/core/interceptors/auth.interceptor.ts
- src/app/core/services/theme.service.ts
- src/app/core/services/offline-sync.service.ts
- src/index.html
- README.md
- AGENT_ONBOARDING.md

## Removed files

- src/app/core/services/persistence.service.ts

## Changes summary

- Auth and theme services now use storage services (no direct localStorage).
- Offline sync queue uses the storage engine and shared key constants.
- Theme bootstrap key matches app-theme-preference.
- Docs updated to reflect store-based persistence.
- Legacy migration removed (dev-only reset; no old data support).

## Next step

Proceed to Step 8: QA checklist and verification.
