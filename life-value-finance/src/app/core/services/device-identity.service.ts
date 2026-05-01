import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const DEVICE_ID_KEY = 'sync_device_id';

@Injectable({
  providedIn: 'root'
})
export class DeviceIdentityService {
  private readonly platformId = inject(PLATFORM_ID);

  getDeviceId(): string {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') {
      return 'server';
    }

    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    const deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  }
}
