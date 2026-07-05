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
import { FinancialCalculatorService } from '@core/domain/financial-calculator.service';
import type { BudgetHistory, ExpenseItem, MonthlyIncome, MonthlyRecord, UserIncomeConfig, UserSettings } from '@core/domain/models';
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

          if (this.isNewBackupFormat(parsed)) {
            this.clearDataStores();
            this.restoreNewFormat(parsed as BackupPayload);
          } else if (this.isLegacyBackupFormat(parsed)) {
            this.clearDataStores();
            this.restoreLegacyFormat(parsed as LegacyBackupPayload);
          } else {
            throw new Error('Unsupported backup format');
          }

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

  private isLegacyBackupFormat(payload: unknown): payload is LegacyBackupPayload {
    return typeof payload === 'object' && payload !== null && (
      'incomeConfig' in payload ||
      'history' in payload ||
      'expenses' in payload ||
      'savings' in payload
    );
  }

  private restoreNewFormat(payload: BackupPayload): void {
    const stores = payload.stores || {};
    this.writeStoreOrDefault(STORAGE_KEYS.income, stores[STORAGE_KEYS.income], this.defaultIncomeStore());
    this.writeStoreOrDefault(STORAGE_KEYS.history, stores[STORAGE_KEYS.history], this.defaultHistoryStore());
    this.writeStoreOrDefault(STORAGE_KEYS.items, stores[STORAGE_KEYS.items], this.defaultItemsStore());
  }

  private restoreLegacyFormat(payload: LegacyBackupPayload): void {
    const now = new Date().toISOString();
    const incomeConfig = this.normalizeIncomeConfig(payload.incomeConfig);
    const incomeSources = this.normalizeMonthlyIncomeList(payload.incomes);
    const currentMonth = this.resolveCurrentMonth(payload.settings?.lastActiveMonth);

    const normalizedCurrentMonthItems = this.normalizeExpenseList(payload.expenses ?? []);
    const normalizedHistory = (payload.history ?? []).map(entry => this.normalizeLegacyHistoryEntry(entry, incomeConfig));

    const incomeStore: IncomeStore = {
      version: 1,
      updatedAt: now,
      data: {
        incomeConfig,
        sources: incomeSources
      }
    };

    const legacySavings = payload.savings ?? {};
    const savingsHistory = this.normalizeSavingsHistory(legacySavings.monthlyHistory ?? [], normalizedHistory, incomeConfig, now);
    const totalSavings = this.parseNumber(legacySavings.totalSavings, 0);
    const manualSavingsLog = this.parseNumber(legacySavings.manualSavingsLog, 0);

    const historyStore: HistoryStore = {
      version: 1,
      updatedAt: now,
      data: {
        budgetHistory: normalizedHistory,
        savingsHistory,
        savingsSummary: {
          totalSavings,
          manualSavingsLog,
          lastUpdated: now
        },
        analysis: this.buildHistoryAnalysis(normalizedHistory, totalSavings, now)
      }
    };

    const itemsStore: ItemsStore = {
      version: 1,
      updatedAt: now,
      data: {
        currentMonth: {
          month: currentMonth,
          items: normalizedCurrentMonthItems,
          updatedAt: now
        },
        months: this.buildMonthsMap(normalizedHistory, now),
        settings: {
          timezone: payload.settings?.timezone || 'Africa/Tripoli',
          lastActiveMonth: currentMonth
        }
      }
    };

    this.storageEngine.writeJson(STORAGE_KEYS.income, incomeStore);
    this.storageEngine.writeJson(STORAGE_KEYS.history, historyStore);
    this.storageEngine.writeJson(STORAGE_KEYS.items, itemsStore);
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

  private normalizeIncomeConfig(raw: LegacyBackupPayload['incomeConfig']): UserIncomeConfig {
    const current = this.incomeStore.getData().incomeConfig;

    if (typeof raw !== 'object' || raw === null) {
      return current;
    }

    const source = raw as Partial<UserIncomeConfig> & { isHourlyManual?: boolean };
    return {
      ...current,
      ...source,
      monthlyIncome: this.parseNumber(source.monthlyIncome, current.monthlyIncome),
      workHoursPerMonth: this.parseOptionalNumber(source.workHoursPerMonth, current.workHoursPerMonth),
      hourlyRate: this.parseOptionalNumber(source.hourlyRate, current.hourlyRate),
      isHourlyManual: Boolean(source.isHourlyManual),
      weeklyHoursDetails: source.weeklyHoursDetails ?? current.weeklyHoursDetails,
      calculationMethod: source.calculationMethod ?? current.calculationMethod
    };
  }

  private normalizeMonthlyIncomeList(raw: LegacyBackupPayload['incomes']): MonthlyIncome[] {
    if (!Array.isArray(raw)) return [];
    return raw as MonthlyIncome[];
  }

  private normalizeExpenseList(raw: LegacyExpenseItem[]): ExpenseItem[] {
    return (raw ?? []).map(item => this.normalizeExpense(item));
  }

  private normalizeLegacyHistoryEntry(entry: LegacyHistoryEntry, incomeConfig: UserIncomeConfig): BudgetHistory {
    const expenses = this.normalizeExpenseList(entry.expenses ?? []);
    const summary = FinancialCalculatorService.calculateBudget(incomeConfig, expenses.filter(item => !item.isIgnored));

    return {
      month: entry.month,
      date: entry.date || new Date().toISOString(),
      incomeConfig: this.normalizeIncomeConfig(entry.incomeConfig ?? incomeConfig),
      expenses,
      summary,
      excludedFromTotals: entry.excludedFromTotals ?? false
    };
  }

  private normalizeSavingsHistory(raw: LegacySavingsRecord[], history: BudgetHistory[], incomeConfig: UserIncomeConfig, fallbackDate: string): MonthlyRecord[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];

    const historyByMonth = new Map(history.map(item => [item.month, item]));

    return raw.map(record => {
      const monthHistory = historyByMonth.get(record.month);
      const monthlyExpenses = monthHistory?.expenses ?? [];
      const summary = monthHistory?.summary ?? FinancialCalculatorService.calculateBudget(incomeConfig, monthlyExpenses.filter(item => !item.isIgnored));

      return {
        month: record.month,
        income: this.parseNumber(record.income, summary.totalIncome),
        expenses: this.parseNumber(record.expenses, summary.plannedOutflow),
        realExpenses: this.parseOptionalNumber(record.realExpenses, summary.realExpenses),
        freeMoney: this.parseNumber(record.freeMoney, summary.freeMoney),
        transferredToSavings: this.parseNumber(record.transferredToSavings, summary.savingsBalance),
        plannedSavings: this.parseNumber(record.plannedSavings, this.sumByType(monthlyExpenses, 'Saving')),
        savingsImpact: this.parseNumber(record.savingsImpact, summary.freeMoney < 0 ? summary.freeMoney : 0),
        manualAdded: this.parseOptionalNumber(record.manualAdded, 0),
        savingsTotalAfterTransfer: this.parseNumber(record.savingsTotalAfterTransfer, 0),
        date: record.date || fallbackDate,
        excludedFromTotals: record.excludedFromTotals ?? false
      };
    });
  }

  private normalizeExpense(item: LegacyExpenseItem): ExpenseItem {
    const type = this.normalizeType(item.type);
    const priority = this.normalizePriority(item.priority);
    const quantity = this.parseNumber(item.quantity, 1);
    const unitPrice = this.parseNumber(item.unitPrice, this.parseNumber(item.amount, 0));
    const amount = this.parseNumber(item.amount, unitPrice * quantity);

    return {
      id: item.id,
      name: item.name,
      amount,
      unitPrice,
      quantity,
      type,
      priority,
      category: item.category,
      isIgnored: Boolean(item.isIgnored),
      isReducible: item.isReducible,
      targetTotal: item.targetTotal
    };
  }

  private normalizeType(type: string | undefined): ExpenseItem['type'] {
    switch (type) {
      case 'Burning':
      case 'Burn':
        return 'Burn';
      case 'Responsibility':
      case 'Tax':
        return 'Tax';
      case 'Saving':
        return 'Saving';
      default:
        return 'Burn';
    }
  }

  private normalizePriority(priority: string | undefined): ExpenseItem['priority'] {
    switch (priority) {
      case 'Must Have':
      case 'Must':
        return 'Must';
      case 'Emergency':
        return 'Emergency';
      case 'Gift':
        return 'Gift';
      case 'Want':
      default:
        return 'Want';
    }
  }

  private buildMonthsMap(history: BudgetHistory[], fallbackDate: string): Record<string, { month: string; items: ExpenseItem[]; updatedAt: string }> {
    return history.reduce<Record<string, { month: string; items: ExpenseItem[]; updatedAt: string }>>((acc, entry) => {
      acc[entry.month] = {
        month: entry.month,
        items: entry.expenses,
        updatedAt: entry.date || fallbackDate
      };
      return acc;
    }, {});
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

  private sumByType(items: ExpenseItem[], type: ExpenseItem['type']): number {
    return items.filter(item => item.type === type).reduce((sum, item) => sum + (item.amount || 0), 0);
  }

  private parseNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parseOptionalNumber(value: unknown, fallback?: number): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (value === undefined || value === null) {
      return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private resolveCurrentMonth(saved?: string): string {
    if (typeof saved === 'string' && /^\d{4}-\d{2}$/.test(saved)) {
      return saved;
    }

    return new Date().toISOString().slice(0, 7);
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

interface LegacyExpenseItem {
  id: string;
  name: string;
  amount: number;
  unitPrice: number;
  quantity: number;
  type: string;
  priority: string;
  category?: string;
  isIgnored?: boolean;
  isReducible?: boolean;
  targetTotal?: number;
}

interface LegacyHistoryEntry {
  month: string;
  date?: string;
  incomeConfig?: UserIncomeConfig;
  expenses?: LegacyExpenseItem[];
  summary?: {
    totalIncome?: number;
    totalExpenses?: number;
    remainingIncome?: number;
    hourlyRate?: number;
    savingsRate?: number;
  };
  excludedFromTotals?: boolean;
}

interface LegacySavingsRecord {
  month: string;
  income?: number;
  expenses?: number;
  realExpenses?: number;
  freeMoney?: number;
  transferredToSavings?: number;
  plannedSavings?: number;
  savingsImpact?: number;
  manualAdded?: number;
  savingsTotalAfterTransfer?: number;
  date?: string;
  excludedFromTotals?: boolean;
}

interface LegacyBackupPayload {
  version?: number;
  incomes?: MonthlyIncome[];
  expenses?: LegacyExpenseItem[];
  incomeConfig?: UserIncomeConfig;
  history?: LegacyHistoryEntry[];
  settings?: UserSettings;
  savings?: {
    totalSavings?: number;
    monthlyHistory?: LegacySavingsRecord[];
    manualSavingsLog?: number;
  };
}

interface SyncResult {
  status: 'success' | 'error';
  message: string;
}
