Deployment checklist for MyWallet PWA

- Serve the production `dist/life-value-finance` from a secure origin (HTTPS).
- Ensure `ngsw-worker.js` and `manifest.webmanifest` are served at the site root (e.g., `https://example.com/manifest.webmanifest`).
- Verify `ngsw-config.json` `index` and `assetGroups` match your deployment root.
- If using a reverse proxy, make sure it forwards `/ngsw-worker.js` and `/ngsw.json` without modification.
- Use `Content-Type` headers: `manifest.webmanifest` -> `application/manifest+json`, `ngsw.json` -> `application/json`.
- Confirm the service worker registers in production only. `main.ts` already guards registration by fetching `/ngsw-worker.js`.
- Test install flow on Android (Chrome) and desktop (Chrome/Edge): DevTools -> Application -> Manifest -> "Add to home screen" flow.
- Test offline F5: Open site, ensure service worker status is "Activated and is controlling the page", set network to "Offline" in DevTools, refresh, verify shell loads and UI shows stored data.
- Monitor cache sizes and evictions in production; adjust `ngsw-config.json` `maxSize`/`maxAge` as needed.
- Use the `scripts/check-pwa.js` to validate endpoints before smoke tests.
