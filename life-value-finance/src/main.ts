import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Only attempt registration if the service worker script exists (avoids redirects on dev server)
      fetch('/ngsw-worker.js', { method: 'GET' })
        .then((resp) => {
          if (resp.ok) {
            return navigator.serviceWorker.register('/ngsw-worker.js')
              .then((reg) => console.log('Service Worker registered:', reg.scope))
              .catch((err) => console.warn('Service Worker registration failed:', err));
          }
          console.log('ngsw-worker.js not present (status ' + resp.status + '), skipping SW registration.');
          return Promise.resolve(undefined);
        })
        .catch((err) => {
          console.log('Could not fetch ngsw-worker.js — skipping SW registration.', err);
          return Promise.resolve(undefined);
        });
    }
  })
  .catch((err) => console.error(err));
