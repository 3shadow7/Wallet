// viewport.service.ts
import { Injectable, signal, computed, DestroyRef, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type DeviceType = 'watch' | 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'tv';

interface Breakpoint {
  name: DeviceType;
  maxWidth: number; // أقل من أو يساوي هذا الرقم = هذا النوع
}

// رتّبها من الأصغر للأكبر
const BREAKPOINTS: Breakpoint[] = [
  { name: 'watch',   maxWidth: 280 },
  { name: 'mobile',  maxWidth: 640 },
  { name: 'tablet',  maxWidth: 1024 },
  { name: 'laptop',  maxWidth: 1440 },
  { name: 'desktop', maxWidth: 1920 },
  { name: 'tv',      maxWidth: Infinity },
];

@Injectable({ providedIn: 'root' })
export class ViewportService {
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // القيمة الافتراضية وقت SSR: نفترض laptop (متوسط آمن)
  private _width = signal(this.isBrowser ? window.innerWidth : 1280);
  private _height = signal(this.isBrowser ? window.innerHeight : 800);

  width = this._width.asReadonly();
  height = this._height.asReadonly();

  // الفئة الحالية (watch, mobile, tablet...)
  deviceType = computed<DeviceType>(() => {
    const w = this._width();
    return BREAKPOINTS.find(bp => w <= bp.maxWidth)?.name ?? 'tv';
  });

  // helpers جاهزة للاستخدام السريع بالتمبلت
  isWatch = computed(() => this.deviceType() === 'watch');
  isMobile = computed(() => this.deviceType() === 'mobile');
  isTablet = computed(() => this.deviceType() === 'tablet');
  isLaptop = computed(() => this.deviceType() === 'laptop');
  isDesktop = computed(() => this.deviceType() === 'desktop');
  isTv = computed(() => this.deviceType() === 'tv');

  // مفيد لو تبي تجمع أكثر من فئة بسهولة (مثلاً "صغير" = watch أو mobile)
  isSmallScreen = computed(() => ['watch', 'mobile'].includes(this.deviceType()));
  isLargeScreen = computed(() => ['desktop', 'tv'].includes(this.deviceType()));

  orientation = computed(() => (this._width() > this._height() ? 'landscape' : 'portrait'));

  constructor() {
    if (!this.isBrowser) return;

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      // debounce بسيط عشان ما يشتغل مع كل بكسل أثناء السحب
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this._width.set(window.innerWidth);
        this._height.set(window.innerHeight);
      }, 100);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    this.destroyRef.onDestroy(() => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    });
  }
}
