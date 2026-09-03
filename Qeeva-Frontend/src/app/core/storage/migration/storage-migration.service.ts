import { Injectable, inject } from '@angular/core';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
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
  incomes?: unknown[];
  expenses?: unknown[];
  incomeConfig?: unknown;
  history?: unknown[];
  settings?: {
    lastActiveMonth?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class StorageMigrationService {
  private engine = inject(StorageEngineService);
  private incomeStore = inject(IncomeStoreService);
  private historyStore = inject(HistoryStoreService);
  private itemsStore = inject(ItemsStoreService);

  migrateIfNeeded(): boolean {
    const legacyExists = !!(
      this.engine.getItem(LEGACY_KEYS.main) ||
      this.engine.getItem(LEGACY_KEYS.savingsTotal) ||
      this.engine.getItem(LEGACY_KEYS.savingsHistory) ||
      this.engine.getItem(LEGACY_KEYS.manualSavingsLog)
    );

    if (!legacyExists || this.hasMeaningfulNewData()) {
      return false;
    }

    const legacyState = this.safeParse<LegacyAppState>(this.engine.getItem(LEGACY_KEYS.main)) ?? {};
    const legacyHistory = Array.isArray(legacyState.history) ? (legacyState.history as BudgetHistory[]) : [];
    const legacyExpenses = Array.isArray(legacyState.expenses) ? (legacyState.expenses as ExpenseItem[]) : [];
    const legacySettings = legacyState.settings ?? {};
    const now = new Date().toISOString();

    const incomeData: IncomeData = {
      incomeConfig: this.safeIncomeConfig(legacyState.incomeConfig),
      sources: this.safeIncomeSources(legacyState.incomes)
    };

    const totalSavings = this.parseNumber(this.engine.getItem(LEGACY_KEYS.savingsTotal), 0);
    const manualSavingsLog = this.parseNumber(this.engine.getItem(LEGACY_KEYS.manualSavingsLog), 0);
    const savingsHistory = this.safeParseArray<MonthlyRecord>(this.engine.getItem(LEGACY_KEYS.savingsHistory));
    const currentMonth = this.resolveCurrentMonth(legacySettings.lastActiveMonth);

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

  private hasMeaningfulNewData(): boolean {
    const income = this.incomeStore.read()?.data;
    const history = this.historyStore.read()?.data;
    const items = this.itemsStore.read()?.data;

    if ((income?.incomeConfig?.monthlyIncome ?? 0) > 0) return true;
    if ((income?.sources?.length ?? 0) > 0) return true;

    if ((history?.budgetHistory?.length ?? 0) > 0) return true;
    if ((history?.savingsHistory?.length ?? 0) > 0) return true;
    if ((history?.savingsSummary?.totalSavings ?? 0) !== 0) return true;
    if ((history?.savingsSummary?.manualSavingsLog ?? 0) !== 0) return true;

    if ((items?.currentMonth?.items?.length ?? 0) > 0) return true;
    if (Object.keys(items?.months ?? {}).length > 0) return true;

    return false;
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

    const parsed = this.safeParse<unknown>(raw);
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      return parsed;
    }

    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  private resolveCurrentMonth(saved?: string): string {
    if (typeof saved === 'string' && /^\d{4}-\d{2}$/.test(saved)) {
      return saved;
    }

    return new Date().toISOString().slice(0, 7);
  }

  private safeIncomeConfig(raw: unknown): IncomeData['incomeConfig'] {
    if (typeof raw === 'object' && raw !== null) {
      return raw as IncomeData['incomeConfig'];
    }

    return this.incomeStore.getData().incomeConfig;
  }

  private safeIncomeSources(raw: unknown[] | undefined): MonthlyIncome[] {
    if (!Array.isArray(raw)) return [];
    return raw as MonthlyIncome[];
  }

  private mapHistoryMonths(history: BudgetHistory[], fallbackDate: string): Record<string, MonthlyItems> {
    const months: Record<string, MonthlyItems> = {};

    history.forEach(entry => {
      months[entry.month] = {
        month: entry.month,
        items: entry.expenses ?? [],
        updatedAt: entry.date || fallbackDate
      };
    });

    return months;
  }

  private buildHistoryAnalysis(history: BudgetHistory[], totalSavings: number, now: string) {
    const monthsCount = history.length;
    const totalIncome = history.reduce((sum, item) => sum + (item.summary?.totalIncome ?? 0), 0);
    const totalExpenses = history.reduce((sum, item) => sum + (item.summary?.realExpenses ?? 0), 0);
    const averageSavingsRate = monthsCount > 0
      ? history.reduce((sum, item) => sum + (item.summary?.savingsRate ?? 0), 0) / monthsCount
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
