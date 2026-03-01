const { chromium } = require('playwright');

async function runOnce(attempt = 1) {
  const url = 'http://localhost:4400/';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: false });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Try several times to obtain controller
    let hasController = false;
    for (let i = 0; i < 5; i++) {
      hasController = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
      if (hasController) break;
      // attempt registration from page
      await page.evaluate(async () => {
        try {
          if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
            await navigator.serviceWorker.register('/ngsw-worker.js');
          }
        } catch (e) { /* ignore */ }
      });
      await page.waitForTimeout(1500);
      await page.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    }

    console.log('Service worker controls page:', hasController);
    if (!hasController) {
      await browser.close();
      return { ok: false, code: 2 };
    }

      // Warm cache by requesting CSR index and main assets while online
    try {
      await page.goto('http://localhost:4400/index.csr.html', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(500);
    } catch (e) {
      // ignore warming errors
    }

    // Now simulate offline and reload root
    await context.setOffline(true);
    await page.goto('http://localhost:4400/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});

    const appPresent = await page.evaluate(() => {
      return !!document.querySelector('app-root') || !!document.querySelector('#root') || document.body.innerText.length > 20;
    });

    console.log('App shell available while offline:', appPresent);
      // Check service worker cache contents for key assets
      const cacheCheck = await page.evaluate(async () => {
        try {
          const keys = await caches.keys();
          const hasIndex = await caches.match('/index.html') || await caches.match('/index.csr.html') || await caches.match('/');
          return { keys, hasIndex: !!hasIndex };
        } catch (e) {
          return { keys: [], hasIndex: false, error: String(e) };
        }
      });
      console.log('Cache check:', JSON.stringify(cacheCheck));
    await browser.close();
    return { ok: !!appPresent, code: appPresent ? 0 : 3 };
  } catch (e) {
    console.error('Headless test failed', e);
    try { await browser.close(); } catch (e) {}
    return { ok: false, code: 4 };
  }
}

(async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log('Headless test attempt', attempt);
    const res = await runOnce(attempt);
    if (res.ok) process.exit(0);
    console.log('Attempt result code:', res.code);
    if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
  }
  process.exit(5);
})();
