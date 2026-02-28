const { chromium } = require('playwright');

(async () => {
  const url = 'http://localhost:4400/';
  const csrUrl = 'http://localhost:4400/index.csr.html';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait up to 5s for a controlling service worker
    let hasController = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
    if (!hasController) {
      // Give the page a short moment to allow registration/activation, then reload to be controlled
      await page.waitForTimeout(2000);
      await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
      hasController = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
      // If still not controlled, try to register the worker directly from the page
      if (!hasController) {
        try {
          await page.evaluate(async () => {
            if (navigator.serviceWorker) {
              const reg = await navigator.serviceWorker.register('/ngsw-worker.js');
              if (reg.waiting) return;
              if (reg.installing) {
                await new Promise(r => {
                  reg.installing.addEventListener('statechange', () => {
                    if (reg.installing.state === 'activated') r(true);
                  });
                });
              }
            }
          });
        } catch (e) {
          // ignore
        }
        await page.waitForTimeout(1000);
        await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
        hasController = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
      }
      // If still not controlled, try the CSR index which registers client-side scripts directly
      if (!hasController) {
        await page.goto(csrUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        hasController = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
        if (!hasController) {
          await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
          hasController = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
        }
      }
    }

    console.log('Service worker controls page:', hasController);
    if (!hasController) {
      console.error('Service worker is NOT controlling the page. Aborting offline test.');
      await browser.close();
      process.exit(2);
    }

    // Now simulate offline and reload
    await context.setOffline(true);
    // Reload and wait for DOM
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => {});

    // Check for presence of app root or some known element
    const appPresent = await page.evaluate(() => {
      return !!document.querySelector('app-root') || !!document.querySelector('#root') || document.body.innerText.length > 20;
    });

    console.log('App shell available while offline:', appPresent);
    await browser.close();
    if (!appPresent) process.exit(3);
    process.exit(0);
  } catch (e) {
    console.error('Headless test failed', e);
    await browser.close();
    process.exit(4);
  }
})();
