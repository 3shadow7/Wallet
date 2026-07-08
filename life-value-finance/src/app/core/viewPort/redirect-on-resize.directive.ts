// redirect-on-resize.directive.ts أو تقدر تحطها كـ service صغير
import { Directive, inject, effect, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ViewportService, DeviceType } from './viewport.service';

@Directive({
  selector: '[appRedirectOnDeviceChange]',
  standalone: true,
})
export class RedirectOnDeviceChangeDirective {
  @Input('appRedirectOnDeviceChange') disallowedDevices: DeviceType[] = [];
  @Input() redirectTo = '/';

  private viewport = inject(ViewportService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      if (this.disallowedDevices.includes(this.viewport.deviceType())) {
        this.router.navigateByUrl(this.redirectTo);
      }
    });
  }
}
