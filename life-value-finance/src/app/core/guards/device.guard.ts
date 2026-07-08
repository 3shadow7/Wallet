// device.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DeviceType, ViewportService } from '@core/viewPort/viewport.service';

export function deviceGuard(disallowedDevices: DeviceType[], redirectTo: string): CanActivateFn {
  return (route, state) => {
    const viewport = inject(ViewportService);
    const router = inject(Router);

    const currentDevice = viewport.deviceType();

    if (disallowedDevices.includes(currentDevice)) {
      // redirect to the specified route if the current device is disallowed
      return router.createUrlTree([redirectTo]);
    }

    return true;
  };
}
