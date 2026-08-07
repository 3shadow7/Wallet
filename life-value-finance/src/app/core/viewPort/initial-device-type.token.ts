//? becouse we use SSR, we can't rely on brawser's window Width to detect device type,
//? so we use user agent string instead

import { InjectionToken } from '@angular/core';
import type { DeviceType } from './viewport.service';

export const INITIAL_DEVICE_TYPE = new InjectionToken<DeviceType | null>('INITIAL_DEVICE_TYPE');
