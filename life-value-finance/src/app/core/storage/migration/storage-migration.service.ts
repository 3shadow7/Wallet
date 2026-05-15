import { Injectable, inject } from '@angular/core';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
import { STORAGE_KEYS } from '@core/storage/engine/storage-keys';
import { IncomeStoreService } from '@core/storage/stores/income-store.service';
import { HistoryStoreService } from '@core/storage/stores/history-store.service';
import { ItemsStoreService } from '@core/storage/stores/items-store.service';
import { BudgetHistory, ExpenseItem, MonthlyIncome, MonthlyRecord } from '@core/domain/models';
import { HistoryData, IncomeData, ItemsData, MonthlyItems } from '@core/domain/storage.models';

const LEGACY_KEYS = {
  main: 'life_value_finance_data',
  savingsTotal: 'savingsStorage',
  savingsHistory: 'monthlyHistory',
  manualSavingsLog: 'manualSavingsLog'
} as const;

interface LegacyAppState {
  version?: number;
  incomes?: any[];
  expenses?: any[];
  incomeConfig?: any;
  history?: any[];
  settings?: any;
}

@Injectable({ providedIn: 'root' })
export class StorageMigrationService {
  private engine = inject(StorageEngineService);
  private incomeStore = inject(IncomeStoreService);
  private historyStore = inject(HistoryStoreService);
  private itemsStore = inject(ItemsStoreService);

  migrateIfNeeded(): boolean {
    if (this.hasNewStores()) return false;

    const legacyMainRaw = this.engine.getItem(LEGACY_KEYS.main);
    const legacySavingsRaw = this.engine.getItem(LEGACY_KEYS.savingsTotal);
    const legacySavingsHistoryRaw = this.engine.getItem(LEGACY_KEYS.savingsHistory);
    const legacyManualRaw = this.engine.getItem(LEGACY_KEYS.manualSavingsLog);

    if (!legacyMainRaw && !legacySavingsRaw && !legacySavingsHistoryRaw && !legacyManualRaw) {
      return false;
    }

    const legacyState = this.safeParse<LegacyAppState>(legacyMainRaw) ?? {};
    const legacyHistory = Array.isArray(legacyState.history) ? (legacyState.history as BudgetHistory[]) : [];
    const legacyExpenses = Array.isArray(legacyState.expenses) ? (legacyState.expenses as ExpenseItem[]) : [];
    const legacySettings = legacyState.settings ?? {};

    const now = new Date().toISOString();
    const currentMonth = this.resolveCurrentMonth(legacySettings.lastActiveMonth);

    const totalSavings = this.parseNumber(legacySavingsRaw, 0);
    const manualSavingsLog = this.parseNumber(legacyManualRaw, 0);
    const savingsHistory = this.safeParseArray<MonthlyRecord>(legacySavingsHistoryRaw);

    const incomeData: IncomeData = {
      incomeConfig: legacyState.incomeConfig ?? this.incomeStore.getData().incomeConfig,
      sources: this.safeIncomeSources(legacyState.incomes)
    };

    const historyData: HistoryData = {
      budgetHistory: legacyHistory,
      savingsHistory,
      savingsSummary: {
        totalSavings,
        manualSavingsLog,
        lastUpdated: now
      },
      analysis: this.buildHistoryAnalysis(legacyHistory, totalSavings, now)
    };

    const itemsData: ItemsData = {
      currentMonth: {
        month: currentMonth,
        items: legacyExpenses,
        updatedAt: now
      },
      months: this.mapHistoryMonths(legacyHistory, now)
    };

    this.incomeStore.setData(incomeData);
    this.historyStore.setData(historyData);
    this.itemsStore.setData(itemsData);

    this.clearLegacyKeys();

    return true;
  }

  private hasNewStores(): boolean {
    return !!(
      this.engine.getItem(STORAGE_KEYS.income) ||
      this.engine.getItem(STORAGE_KEYS.history) ||
      this.engine.getItem(STORAGE_KEYS.items)
    );
  }

  private clearLegacyKeys(): void {
    this.engine.removeItem(LEGACY_KEYS.main);
    this.engine.removeItem(LEGACY_KEYS.savingsTotal);
    this.engine.removeItem(LEGACY_KEYS.savingsHistory);
    this.engine.removeItem(LEGACY_KEYS.manualSavingsLog);
  }

  private safeParse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private safeParseArray<T>(raw: string | null): T[] {
    const parsed = this.safeParse<T[]>(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  private parseNumber(raw: string | null, fallback: number): number {
    if (!raw) return fallback;
    const num = Number(raw);
    return Number.isFinite(num) ? num : fallback;
  }

  private resolveCurrentMonth(saved?: string): string {
    if (typeof saved === 'string' && /^\d{4}-\d{2}$/.test(saved)) {
      return saved;
    }
    return new Date().toISOString().slice(0, 7);
  }

  private safeIncomeSources(incomes: any[] | undefined): MonthlyIncome[] {
    if (!Array.isArray(incomes)) return [];
    return incomes as MonthlyIncome[];
  }

  private mapHistoryMonths(history: BudgetHistory[], fallbackDate: string): Record<string, MonthlyItems> {
    const months: Record<string, MonthlyItems> = {};
    history.forEach(entry => {
      const key = entry.month;
      const updatedAt = entry.date || fallbackDate;
      months[key] = {
        month: key,
        items: entry.expenses ?? [],
        updatedAt
      };
    });
    return months;
  }

  private buildHistoryAnalysis(history: BudgetHistory[], totalSavings: number, now: string) {
    const monthsCount = history.length;
    const totalIncome = history.reduce((sum, h) => sum + (h.summary?.totalIncome ?? 0), 0);
    const totalExpenses = history.reduce((sum, h) => sum + (h.summary?.totalExpenses ?? 0), 0);
    const averageSavingsRate = monthsCount > 0
      ? history.reduce((sum, h) => sum + (h.summary?.savingsRate ?? 0), 0) / monthsCount
      : 0;

    return {
      monthsCount,
      totalIncome,
      totalExpenses,
      totalSavings,
      averageSavingsRate,
      lastUpdated: now
    };
  }
}
