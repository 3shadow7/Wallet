//? becouse we use SSR, we can't rely on brawser's window Width to detect device type,
//? so we use user agent string instead

import type { DeviceType } from './viewport.service';

export function detectDeviceTypeFromUA(ua: string | null): DeviceType {
  if (!ua) return 'mobile'; // safe default when UA is missing
  if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return 'mobile';
  // Can't reliably tell laptop vs desktop vs tv from UA — default to mobile,
  // which matches your guard's "small screen" bucket anyway.
  return 'mobile';
}
