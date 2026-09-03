import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './ssr-polyfills.ts'; // Add polyfills for window/localStorage

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (!response) return next();

      // If the response body is HTML, inject data-theme from a cookie so
      // the initial paint matches the user's preference and avoids flash.
      try {
        const contentType = response.headers?.get?.('content-type') || '';
        if (response.body && typeof response.body === 'string' && contentType.includes('text/html')) {
          const bodyStr = response.body as string;
          const cookieHeader = req.headers && (req.headers as any).cookie;
          let theme = null;
          if (cookieHeader) {
            const match = cookieHeader.match(/(?:^|; )theme=([^;]+)/);
            if (match) theme = decodeURIComponent(match[1]);
          }
          if (!theme) {
            // Fallback: try to infer from Accept-CH or default to light
            theme = 'light';
          }

          // Ensure we set or replace data-theme attribute on <html>
          const newBody = bodyStr.replace(/<html(.*?)>/i, (m: string, g1: string) => {
            if (/data-theme=/.test(g1)) {
              return `<html${g1.replace(/data-theme=(?:"|')?[^"'\s>]+(?:"|')?/, `data-theme="${theme}"`)}>`;
            }
            return `<html${g1} data-theme="${theme}">`;
          });
          response = Object.assign({}, response, { body: newBody });
        }
      } catch (e) {
        // ignore any errors during injection and continue
      }

      return writeResponseToNodeResponse(response, res);
    })
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
