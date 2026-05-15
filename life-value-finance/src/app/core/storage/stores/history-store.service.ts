import { Injectable, inject } from '@angular/core';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
import { STORAGE_KEYS } from '@core/storage/engine/storage-keys';
import { HistoryData, HistoryStore } from '@core/domain/storage.models';

const STORE_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class HistoryStoreService {
  private engine = inject(StorageEngineService);

  read(): HistoryStore | null {
    return this.engine.readJson<HistoryStore>(STORAGE_KEYS.history);
  }

  getData(): HistoryData {
    return this.read()?.data ?? this.defaultData();
  }

  setData(data: HistoryData): void {
    this.writeStore(data);
  }

  updateData(patch: Partial<HistoryData>): void {
    const current = this.getData();
    this.writeStore({ ...current, ...patch });
  }

  private writeStore(data: HistoryData): void {
    const now = new Date().toISOString();
    const store: HistoryStore = { version: STORE_VERSION, updatedAt: now, data };
    this.engine.writeJson(STORAGE_KEYS.history, store);
  }

  private defaultData(): HistoryData {
    const now = new Date().toISOString();
    return {
      budgetHistory: [],
      savingsHistory: [],
      savingsSummary: {
        totalSavings: 0,
        manualSavingsLog: 0,
        lastUpdated: now
      },
      analysis: {
        monthsCount: 0,
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        averageSavingsRate: 0,
        lastUpdated: now
      }
    };
  }
}
