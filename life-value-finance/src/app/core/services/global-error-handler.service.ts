import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private zone = inject(NgZone);

  handleError(error: unknown) {
    this.zone.run(() => {
      console.error('Global Error Caught:', error);
      // In a real app, you might send this to Sentry/LogRocket
      // or show a snackbar notification to the user.
      // alert(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    });
  }
}
