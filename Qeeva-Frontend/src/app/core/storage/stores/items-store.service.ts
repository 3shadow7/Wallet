import { Injectable, inject } from '@angular/core';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
import { STORAGE_KEYS } from '@core/storage/engine/storage-keys';
import { ItemsData, ItemsStore } from '@core/domain/storage.models';
import { ExpenseItem, UserSettings } from '@core/domain/models';
import { normalizeName } from '@core/storage/engine/saving-goal-storage.utils';

const STORE_VERSION = 1;
const DEFAULT_SETTINGS: UserSettings = {
  timezone: 'Africa/Tripoli',
  lastActiveMonth: new Date().toISOString().slice(0, 7)
};

@Injectable({ providedIn: 'root' })
export class ItemsStoreService {
  private engine = inject(StorageEngineService);

  read(): ItemsStore | null {
    return this.engine.readJson<ItemsStore>(STORAGE_KEYS.items);
  }

  getData(): ItemsData {
    return this.read()?.data ?? this.defaultData();
  }

  setData(data: ItemsData): void {
    this.writeStore(data);
  }

  listAllItems(): ExpenseItem[] {
    return Object.values(this.engine.getRoot().canonicalItems ?? {}).map(item => ({ ...item }));
  }

  getCanonical(itemKey: string): ExpenseItem | null {
    const canonical = this.engine.getRoot().canonicalItems?.[itemKey];
    return canonical ? { ...canonical } : null;
  }

  searchItems(query: string, type?: ExpenseItem['type']): ExpenseItem[] {
    const text = normalizeName(query);
    return this.listAllItems().filter(item => {
      const matchesType = !type || item.type === type;
      const matchesName = normalizeName(item.name).includes(text);
      return matchesType && matchesName;
    });
  }

  updateData(patch: Partial<ItemsData>): void {
    const current = this.getData();
    this.writeStore({ ...current, ...patch });
  }

  private writeStore(data: ItemsData): void {
    const now = new Date().toISOString();
    const store: ItemsStore = { version: STORE_VERSION, updatedAt: now, data };
    this.engine.writeJson(STORAGE_KEYS.items, store);
  }

  private defaultData(): ItemsData {
    const now = new Date().toISOString();
    const month = now.slice(0, 7);
    return {
      currentMonth: { month, items: [], updatedAt: now },
      months: {},
      settings: { ...DEFAULT_SETTINGS }
    };
  }
}
