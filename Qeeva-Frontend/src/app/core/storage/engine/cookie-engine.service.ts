import { Injectable, inject } from '@angular/core';
import { SsrCookieService } from 'ngx-cookie-service-ssr';

@Injectable({ providedIn: 'root' })
export class CookieEngineService {
  private cookies = inject(SsrCookieService);
  private readonly path = '/';

  getItem(key: string): string | null {
    return this.cookies.check(key) ? this.cookies.get(key) : null;
  }

  setItem(key: string, value: string, expiresDays = 7): void {
    this.cookies.set(key, value, {
      expires: expiresDays,
      path: this.path,
      sameSite: 'Lax',
      // secure: true, // enable once on https
    });
  }

  removeItem(key: string): void {
    this.cookies.delete(key, this.path);
  }

  readJson<T>(key: string): T | null {
    const raw = this.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  writeJson<T>(key: string, value: T, expiresDays = 7): void {
    this.setItem(key, JSON.stringify(value), expiresDays);
  }
}
