import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ExpenseItem } from '@core/domain/models';
import { createItemId, mergeItems, type MergeConflictInfo } from './saving-goal-storage.utils';

export interface CanonicalItem extends ExpenseItem {
  itemKey: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanonicalStorageRoot {
  version: number;
  updatedAt: string;
  canonicalItems: Record<string, CanonicalItem>;
  monthlyIndex: Record<string, { items: { id: string; itemKey: string; name: string; type: ExpenseItem['type']; amount: number; quantity: number; note?: string }[] }>;
}

export interface MonthWriteResult {
  root: CanonicalStorageRoot;
  conflict?: MergeConflictInfo;
  itemKey: string;
}

@Injectable({ providedIn: 'root' })
export class StorageEngineService {
  private platformId = inject(PLATFORM_ID);
  private readonly storageVersion = 1;
  private readonly rootKey = 'lvf_canonical_storage';

  public isBrowser(): boolean {
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

  private createEmptyRoot(): CanonicalStorageRoot {
    return {
      version: this.storageVersion,
      updatedAt: new Date().toISOString(),
      canonicalItems: {},
      monthlyIndex: {}
    };
  }

  getRoot(): CanonicalStorageRoot {
    const root = this.readJson<CanonicalStorageRoot>(this.rootKey);
    if (!root || root.version !== this.storageVersion) {
      return this.createEmptyRoot();
    }

    return {
      ...root,
      canonicalItems: root.canonicalItems ?? {},
      monthlyIndex: root.monthlyIndex ?? {}
    };
  }

  saveRoot(root: CanonicalStorageRoot): void {
    const normalized: CanonicalStorageRoot = {
      ...root,
      version: this.storageVersion,
      updatedAt: root.updatedAt || new Date().toISOString(),
      canonicalItems: root.canonicalItems ?? {},
      monthlyIndex: root.monthlyIndex ?? {}
    };
    this.writeJson(this.rootKey, normalized);
  }

  readMonth(month: string): { id: string; itemKey: string; name: string; type: ExpenseItem['type']; amount: number; quantity: number; note?: string }[] {
    const root = this.getRoot();
    return root.monthlyIndex?.[month]?.items ?? [];
  }

  writeMonth(month: string, entries: (Pick<ExpenseItem, 'name' | 'type' | 'amount' | 'quantity' | 'targetTotal' | 'id'> & { note?: string })[]): MonthWriteResult {
    const root = this.getRoot();
    const now = new Date().toISOString();
    const normalizedEntries = entries.map(entry => ({ ...entry }));

    const nextRoot = this.cloneRoot(root);
    nextRoot.updatedAt = now;
    nextRoot.monthlyIndex[month] = {
      items: normalizedEntries.map(entry => {
        const itemId = entry.id || createItemId(entry.name, entry.type);
        return {
          id: itemId,
          itemKey: itemId,
          name: entry.name ?? 'Unnamed Item',
          type: entry.type ?? 'Burn',
          amount: entry.amount ?? 0,
          quantity: entry.quantity ?? 1,
          note: entry.note
        };
      })
    };

    let conflict: MergeConflictInfo | undefined;

    normalizedEntries.forEach(entry => {
      const key = entry.id || createItemId(entry.name, entry.type);
      const existing = nextRoot.canonicalItems[key];
      const incoming = this.toCanonicalItem(entry, key);

      if (existing) {
        const merged = mergeItems(existing, incoming);
        nextRoot.canonicalItems[key] = {
          ...merged.mergedItem,
          itemKey: key,
          updatedAt: now,
          createdAt: existing.createdAt ?? incoming.createdAt ?? now
        } as CanonicalItem;
        conflict = conflict ?? merged.conflict;
      } else {
        nextRoot.canonicalItems[key] = {
          ...incoming,
          itemKey: key,
          createdAt: now,
          updatedAt: now
        } as CanonicalItem;
      }
    });

    this.saveRoot(nextRoot);
    return { root: nextRoot, conflict, itemKey: normalizedEntries[0] ? createItemId(normalizedEntries[0].name, normalizedEntries[0].type) : '' };
  }

  mergeWriteItem(month: string, item: ExpenseItem): MonthWriteResult {
    const currentEntries = this.readMonth(month);
    const nextEntries = [...currentEntries];
    const itemKeyValue = item.id || createItemId(item.name, item.type);

    const existingIndex = nextEntries.findIndex(entry => entry.itemKey === itemKeyValue);
    if (existingIndex >= 0) {
      nextEntries[existingIndex] = {
        id: item.id || itemKeyValue,
        itemKey: itemKeyValue,
        name: item.name ?? 'Unnamed Item',
        type: item.type,
        amount: item.amount ?? 0,
        quantity: item.quantity ?? 1,
        note: (item as ExpenseItem & { note?: string }).note
      };
    } else {
      nextEntries.push({
        id: item.id || itemKeyValue,
        itemKey: itemKeyValue,
        name: item.name ?? 'Unnamed Item',
        type: item.type,
        amount: item.amount ?? 0,
        quantity: item.quantity ?? 1,
        note: (item as ExpenseItem & { note?: string }).note
      });
    }

    return this.writeMonth(month, nextEntries.map(entry => ({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      amount: entry.amount,
      quantity: entry.quantity,
      targetTotal: undefined,
      note: entry.note
    })));
  }

  clearAll(): void {
    this.removeItem(this.rootKey);
    this.clearBrowserStorage();
  }

  private clearBrowserStorage(): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.clear();
    } catch {
      // ignore storage failures
    }
  }

  private cloneRoot(root: CanonicalStorageRoot): CanonicalStorageRoot {
    return {
      version: root.version,
      updatedAt: root.updatedAt,
      canonicalItems: { ...root.canonicalItems },
      monthlyIndex: Object.fromEntries(
        Object.entries(root.monthlyIndex ?? {}).map(([month, value]) => [month, { ...value, items: [...(value.items ?? [])] }])
      )
    };
  }

  private toCanonicalItem(entry: Pick<ExpenseItem, 'name' | 'type' | 'amount' | 'quantity' | 'targetTotal'>, key: string): CanonicalItem {
    return {
      id: key,
      name: entry.name ?? 'Unnamed Item',
      amount: entry.amount ?? 0,
      unitPrice: entry.amount ?? 0,
      quantity: entry.quantity ?? 1,
      type: (entry.type as ExpenseItem['type']) ?? 'Burn',
      priority: 'Want',
      targetTotal: entry.targetTotal,
      isReducible: true,
      itemKey: key
    };
  }
}

