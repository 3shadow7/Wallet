import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class StorageEngineService {
  private platformId = inject(PLATFORM_ID);

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined';
  }

  getItem(key: string): string | null {
    if (!this.isBrowser()) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore storage failures
    }
  }

  removeItem(key: string): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
  }

  clearAll(): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.clear();
    } catch {
      // ignore storage failures
    }
  }

  readJson<T>(key: string): T | null {
    const raw = this.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  writeJson<T>(key: string, value: T): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage failures
    }
  }
}
