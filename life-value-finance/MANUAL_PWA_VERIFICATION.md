Manual PWA verification steps

1. Serve the production `dist/life-value-finance` folder on a secure host or local server (we used `npx http-server ./dist/life-value-finance -p 4400`).

2. Open Chrome (or Edge) and navigate to `http://localhost:4400/`.

3. Open DevTools → Application.
   - Under "Service Workers" verify:
     - `ngsw-worker.js` is registered.
     - Status shows "Activated and is controlling the page".
   - Under "Manifest" verify:
     - The manifest loads and icons/screenshots are present.
     - No DevTools warnings about SVG-only icons.

4. Test offline reload (F5):
   - In DevTools → Network set to "Offline".
   - Press F5. The app shell should load and show stored data.

5. Test installability on Android desktop Chrome:
   - DevTools → Application → Manifest, click "Add to homescreen" if available.

6. If service worker is not controlling the page:
   - In DevTools → Application → Service Workers, check "Update on reload" and reload the page.
   - If still not controlled, unregister existing service workers and reload to register the production `ngsw-worker.js`.

7. Verify endpoints:
   - GET `/manifest.webmanifest` → `application/manifest+json`
   - GET `/ngsw-worker.js` → `application/javascript`
   - GET `/ngsw.json` → `application/json`

8. Troubleshooting:
   - Ensure server serves `dist/life-value-finance` at the site root, not `browser/` subfolder.
   - Ensure correct `Content-Type` headers and no reverse-proxy rewrites on those paths.
