import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
import { STORAGE_KEYS } from '@core/storage/engine/storage-keys';
import { IncomeStoreService } from '@core/storage/stores/income-store.service';
import { HistoryStoreService } from '@core/storage/stores/history-store.service';
import { ItemsStoreService } from '@core/storage/stores/items-store.service';
import { AuthStorageService } from '@core/storage/stores/auth-storage.service';
import { ThemeStorageService } from '@core/storage/stores/theme-storage.service';
import type { IncomeStore, HistoryStore, ItemsStore } from '@core/domain/storage.models';

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api';
  private storageEngine = inject(StorageEngineService);
  private incomeStore = inject(IncomeStoreService);
  private historyStore = inject(HistoryStoreService);
  private itemsStore = inject(ItemsStoreService);
  private authStorage = inject(AuthStorageService);
  private themeStorage = inject(ThemeStorageService);

  private readonly backupVersion = 1;

  exportData(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;

    const payload = this.buildBackupPayload();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `qeeva-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importData(file: File): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') {
        reject('Not in browser environment');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);

          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Invalid backup file format');
          }

          const preserved = {
            accessToken: this.authStorage.getAccessToken(),
            refreshToken: this.authStorage.getRefreshToken(),
            user: this.authStorage.getUser(),
            isGuest: this.authStorage.isGuest(),
            theme: this.themeStorage.getPreference()
          };

          this.clearDataStores();

          if (!this.isNewBackupFormat(parsed)) {
            throw new Error('Unsupported backup format');
          }

          this.restoreNewFormat(parsed as BackupPayload);

          if (preserved.accessToken) this.authStorage.setAccessToken(preserved.accessToken);
          if (preserved.refreshToken) this.authStorage.setRefreshToken(preserved.refreshToken);
          if (preserved.user) this.authStorage.setUser(preserved.user);
          this.authStorage.setGuest(preserved.isGuest);
          if (preserved.theme) this.themeStorage.setPreference(preserved.theme);

          resolve(true);
        } catch (error) {
          console.error('Failed to import data', error);
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  // Placeholder for the upcoming Django backend sync
  syncWithBackend(): Observable<SyncResult | null> {
    if (!isPlatformBrowser(this.platformId)) return of(null);

    const payload = this.buildBackupPayload();

    // Once the Django agent builds the backend, this will be a real POST
    // return this.http.post(`${this.apiUrl}/sync/`, payload);
    console.log('Syncing data with cloud (Mock):', payload);
    return of({ status: 'success', message: 'Sync complete (Mock)' });
  }

  private buildBackupPayload(): BackupPayload {
    const now = new Date().toISOString();
    const incomeStore = this.incomeStore.read() ?? this.defaultIncomeStore(now);
    const historyStore = this.historyStore.read() ?? this.defaultHistoryStore(now);
    const itemsStore = this.itemsStore.read() ?? this.defaultItemsStore(now);

    return {
      formatVersion: this.backupVersion,
      exportedAt: now,
      stores: {
        [STORAGE_KEYS.income]: incomeStore,
        [STORAGE_KEYS.history]: historyStore,
        [STORAGE_KEYS.items]: itemsStore
      }
    };
  }

  private isNewBackupFormat(payload: unknown): payload is BackupPayload {
    return typeof payload === 'object' && payload !== null && typeof (payload as BackupPayload).stores === 'object';
  }

  private restoreNewFormat(payload: BackupPayload): void {
    const stores = payload.stores || {};
    this.writeStoreOrDefault(STORAGE_KEYS.income, stores[STORAGE_KEYS.income], this.defaultIncomeStore());
    this.writeStoreOrDefault(STORAGE_KEYS.history, stores[STORAGE_KEYS.history], this.defaultHistoryStore());
    this.writeStoreOrDefault(STORAGE_KEYS.items, stores[STORAGE_KEYS.items], this.defaultItemsStore());
  }

  private clearDataStores(): void {
    this.storageEngine.removeItem(STORAGE_KEYS.income);
    this.storageEngine.removeItem(STORAGE_KEYS.history);
    this.storageEngine.removeItem(STORAGE_KEYS.items);
    this.storageEngine.removeItem('life_value_finance_data');
    this.storageEngine.removeItem('savingsStorage');
    this.storageEngine.removeItem('monthlyHistory');
    this.storageEngine.removeItem('manualSavingsLog');
  }

  private writeStoreOrDefault<T>(key: string, store: T | undefined, fallback: T): void {
    if (store) {
      this.storageEngine.writeJson(key, store);
    } else {
      this.storageEngine.writeJson(key, fallback);
    }
  }

  private defaultIncomeStore(now: string = new Date().toISOString()): IncomeStore {
    return {
      version: 1,
      updatedAt: now,
      data: this.incomeStore.getData()
    };
  }

  private defaultHistoryStore(now: string = new Date().toISOString()): HistoryStore {
    return {
      version: 1,
      updatedAt: now,
      data: this.historyStore.getData()
    };
  }

  private defaultItemsStore(now: string = new Date().toISOString()): ItemsStore {
    return {
      version: 1,
      updatedAt: now,
      data: this.itemsStore.getData()
    };
  }
}

interface BackupPayload {
  formatVersion: number;
  exportedAt: string;
  stores: {
    [STORAGE_KEYS.income]?: IncomeStore;
    [STORAGE_KEYS.history]?: HistoryStore;
    [STORAGE_KEYS.items]?: ItemsStore;
  };
}

interface SyncResult {
  status: 'success' | 'error';
  message: string;
}
