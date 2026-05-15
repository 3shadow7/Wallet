import { Injectable, inject } from '@angular/core';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
import { STORAGE_KEYS } from '@core/storage/engine/storage-keys';
import type { User } from '@core/services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  private engine = inject(StorageEngineService);

  getAccessToken(): string | null {
    return this.engine.getItem(STORAGE_KEYS.accessToken);
  }

  setAccessToken(token: string): void {
    this.engine.setItem(STORAGE_KEYS.accessToken, token);
  }

  getRefreshToken(): string | null {
    return this.engine.getItem(STORAGE_KEYS.refreshToken);
  }

  setRefreshToken(token: string): void {
    this.engine.setItem(STORAGE_KEYS.refreshToken, token);
  }

  getUser(): User | null {
    return this.engine.readJson<User>(STORAGE_KEYS.user);
  }

  setUser(user: User | null): void {
    if (!user) {
      this.engine.removeItem(STORAGE_KEYS.user);
      return;
    }
    this.engine.writeJson(STORAGE_KEYS.user, user);
  }

  isGuest(): boolean {
    return this.engine.getItem(STORAGE_KEYS.isGuest) === 'true';
  }

  setGuest(isGuest: boolean): void {
    if (isGuest) {
      this.engine.setItem(STORAGE_KEYS.isGuest, 'true');
    } else {
      this.engine.removeItem(STORAGE_KEYS.isGuest);
    }
  }

  clearAuth(): void {
    this.engine.removeItem(STORAGE_KEYS.accessToken);
    this.engine.removeItem(STORAGE_KEYS.refreshToken);
    this.engine.removeItem(STORAGE_KEYS.user);
    this.engine.removeItem(STORAGE_KEYS.isGuest);
  }
}
