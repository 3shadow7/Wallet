import { Injectable, inject } from '@angular/core';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
import { STORAGE_KEYS } from '@core/storage/engine/storage-keys';

export type ThemePreference = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeStorageService {
  private engine = inject(StorageEngineService);

  getPreference(): ThemePreference | null {
    const raw = this.engine.getItem(STORAGE_KEYS.themePreference);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
    return null;
  }

  setPreference(theme: ThemePreference): void {
    if (theme === 'system') {
      this.engine.removeItem(STORAGE_KEYS.themePreference);
      return;
    }
    this.engine.setItem(STORAGE_KEYS.themePreference, theme);
  }
}
