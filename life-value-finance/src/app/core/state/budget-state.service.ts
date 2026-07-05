import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { ExpenseItem, BudgetSummary, UserIncomeConfig, BudgetHistory, UserSettings, PriorityLevel } from '@core/domain/models';
import { FinancialCalculatorService } from '@core/domain/financial-calculator.service';
import { SavingsService } from '@core/services/savings.service';
import { BackupService } from '@core/services/backup.service';
import { IncomeStoreService } from '@core/storage/stores/income-store.service';
import { HistoryStoreService } from '@core/storage/stores/history-store.service';
import { ItemsStoreService } from '@core/storage/stores/items-store.service';
import { StorageMigrationService } from '@core/storage/migration/storage-migration.service';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
import { MonthlyItems } from '@core/domain/storage.models';

const INITIAL_SETTINGS: UserSettings = {
  timezone: 'Africa/Tripoli',
  lastActiveMonth: new Date().toISOString().slice(0, 7) // Fallback
};

const INITIAL_STATE = {
  incomeConfig: {
    monthlyIncome: 0,
    workHoursPerMonth: 160,
    hourlyRate: 0,
    isHourlyManual: false,
    calculationMethod: 'weekly' as const,
    weeklyHoursDetails: { hoursPerDay: 8, daysPerWeek: 5 }
  },
  expenses: [] as ExpenseItem[],
  history: [] as BudgetHistory[],
  settings: INITIAL_SETTINGS
};

@Injectable({
  providedIn: 'root'
})
export class BudgetStateService {
  private savingsService = inject(SavingsService);
    private backupService = inject(BackupService);
    private incomeStore = inject(IncomeStoreService);
    private historyStore = inject(HistoryStoreService);
    private itemsStore = inject(ItemsStoreService);
    private storageMigration = inject(StorageMigrationService);
    private storageEngine = inject(StorageEngineService);

  // --- Core State ---
  private incomeConfig = signal<UserIncomeConfig>(INITIAL_STATE.incomeConfig);
  // Renamed to clarify it holds strictly the current active month's data
  private currentMonthExpenses = signal<ExpenseItem[]>(INITIAL_STATE.expenses);
  private history = signal<BudgetHistory[]>(INITIAL_STATE.history);
  private settings = signal<UserSettings>(INITIAL_STATE.settings);
  private manualSavingsLog = signal<number>(0);
    private initialized = signal<boolean>(false);

  // View State (Navigation)
  private viewedMonth = signal<string>(INITIAL_SETTINGS.lastActiveMonth); // 'YYYY-MM'
  readonly loading = signal<boolean>(true);

  // --- Derived State (Readonly) ---
  readonly incomeConfigSignal = this.incomeConfig.asReadonly();
  readonly historySignal = this.history.asReadonly();
  readonly settingsSignal = this.settings.asReadonly();
  readonly viewedMonthSignal = this.viewedMonth.asReadonly();

  // The expenses exposed to the UI depend on the viewed month
  readonly expensesSignal = computed(() => {
     const view = this.viewedMonth();
     const current = this.settings().lastActiveMonth;

     if (view === current) {
         return this.currentMonthExpenses();
     } else {
         const entry = this.history().find(h => h.month === view);
         return entry ? entry.expenses : [];
     }
  });

  // Loading State

  readonly budgetSummary = computed<BudgetSummary>(() => {
    // Determine which config to use for budget calculation
    const view = this.viewedMonth();
    const current = this.settings().lastActiveMonth;

    let incomeConfig = this.incomeConfig();
    let expenses = this.currentMonthExpenses();

    if (view !== current) {
        const entry = this.history().find(h => h.month === view);
        if (entry) {
            incomeConfig = entry.incomeConfig || incomeConfig; // Use historical config if available
            expenses = entry.expenses;
        } else {
            expenses = [];
        }
    }

    // Filter out ignored items before calculation
    const activeExpenses = expenses.filter(e => !e.isIgnored);

    return FinancialCalculatorService.calculateBudget(
      incomeConfig,
      activeExpenses
    );
  });

    readonly totalIncome = computed(() => this.budgetSummary().totalIncome);
    readonly totalExpenses = computed(() => this.budgetSummary().plannedOutflow);
    readonly remainingIncome = computed(() => this.budgetSummary().freeMoney);
    readonly plannedOutflow = computed(() => this.budgetSummary().plannedOutflow);
    readonly freeMoney = computed(() => this.budgetSummary().freeMoney);
    readonly realExpenses = computed(() => this.budgetSummary().realExpenses);
    readonly savingsBalance = computed(() => this.budgetSummary().savingsBalance);
    readonly actualSavedTotal = computed(() => this.budgetSummary().actualSavedTotal);
    readonly overspend = computed(() => this.budgetSummary().overspend);
    readonly savingShortfall = computed(() => this.budgetSummary().savingShortfall);
    readonly hourlyRate = computed(() => this.budgetSummary().hourlyRate);

  constructor() {
        this.storageMigration.migrateIfNeeded();
    this.loadInitialState();

        effect(() => {
            if (!this.initialized()) return;
            this.syncStores();
        });
  }

    private loadInitialState() {
        const incomeData = this.incomeStore.getData();
        const itemsData = this.itemsStore.getData();
        const historyData = this.historyStore.getData();

        const settings = itemsData.settings ?? INITIAL_SETTINGS;
        const currentMonth = itemsData.currentMonth?.month ?? settings.lastActiveMonth;
        const normalizedSettings = { ...settings, lastActiveMonth: currentMonth };

        this.incomeConfig.set(incomeData.incomeConfig ?? INITIAL_STATE.incomeConfig);
        this.currentMonthExpenses.set(this.normalizeItems(itemsData.currentMonth?.items ?? []));
        this.history.set(this.normalizeHistory(historyData.budgetHistory ?? []));
        this.settings.set(normalizedSettings);
        this.manualSavingsLog.set(historyData.savingsSummary?.manualSavingsLog ?? 0);

        this.viewedMonth.set(normalizedSettings.lastActiveMonth);
        this.loading.set(false);
        this.initialized.set(true);
        this.checkMonthRollover();
    }

  // --- View Navigation ---
  setViewMonth(month: string) {
      this.viewedMonth.set(month);
  }

  viewPreviousMonth() {
      const currentView = this.viewedMonth();
      // Calculate previous month
      const date = new Date(currentView + '-01');
      date.setMonth(date.getMonth() - 1);
      const prev = date.toISOString().slice(0, 7);
      this.viewedMonth.set(prev);
  }

  viewNextMonth() {
      const currentView = this.viewedMonth();
      const currentActive = this.settings().lastActiveMonth;

      // Don't go beyond current active month (future)
      if (currentView >= currentActive) return;

      const date = new Date(currentView + '-01');
      date.setMonth(date.getMonth() + 1);
      const next = date.toISOString().slice(0, 7);
      this.viewedMonth.set(next);
  }

  // --- Auto-Month Rollover Logic ---
  private checkMonthRollover() {
    const settings = this.settings();
    const timezone = settings.timezone || 'Africa/Tripoli';

    // Get current YYYY-MM in timezone
    const currentMonth = new Date().toLocaleDateString('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).slice(0, 7);

    if (currentMonth > settings.lastActiveMonth) {
        this.archiveCurrentMonth(settings.lastActiveMonth);
        this.settings.update(s => ({ ...s, lastActiveMonth: currentMonth }));
        this.viewedMonth.set(currentMonth); // Switch view to new month
    }
  }

    private archiveCurrentMonth(month: string) {
        const expenses = this.currentMonthExpenses();
        const historyEntry: BudgetHistory = {
                month: month,
                date: new Date().toISOString(),
                incomeConfig: this.incomeConfig(),
                expenses: expenses,
                summary: this.budgetSummary(),
            excludedFromTotals: false
        };

        this.history.update(h => [...h, historyEntry]);

        // Auto-carry only Tax + Saving items into the new month
        const carryover = this.buildCarryoverItems(expenses);
        this.currentMonthExpenses.set(carryover);
    }

  updateSettings(settings: Partial<UserSettings>) {
      this.settings.update(s => ({ ...s, ...settings }));
  }

  // --- Actions ---

  // Income Config
  updateIncomeConfig(config: Partial<UserIncomeConfig>): void {
    this.incomeConfig.update(current => ({ ...current, ...config }));
  }

  // Expenses
  addExpense(expense: ExpenseItem): void {
    // Ensure unitPrice and quantity are set
    const quantity = expense.quantity || 1;
    let unitPrice = expense.unitPrice;
    let amount = expense.amount;

    if (unitPrice === undefined) {
         // Derive Unit Price from Amount / Quantity
         if (quantity > 0 && amount !== undefined) {
             unitPrice = amount / quantity;
         } else {
             // Fallback
             unitPrice = amount || 0;
         }
    }

    // Now recalculate definitive amount (Unit * Qty) to ensure consistency
    amount = unitPrice * quantity;
    const finalExpense = this.normalizeItem({ ...expense, quantity, unitPrice, amount });

    if (this.isCurrentMonthView()) {
        // UX: show newly added items first so users can see/edit immediately.
        this.currentMonthExpenses.update(current => [finalExpense, ...current]);
    } else {
        // Find and update history entry
        const view = this.viewedMonth();
        this.history.update(history => {
            const existing = history.find(entry => entry.month === view);
            if (existing) {
                return history.map(entry => {
                    if (entry.month === view) {
                        const updatedExpenses = [finalExpense, ...entry.expenses];
                        const updatedSummary = FinancialCalculatorService.calculateBudget(
                            entry.incomeConfig || this.incomeConfig(),
                            updatedExpenses.filter(e => !e.isIgnored)
                        );
                        // const shouldExclude = this.isExpensesEffectivelyEmpty(updatedExpenses);
                        return { ...entry, expenses: updatedExpenses, summary: updatedSummary, excludedFromTotals: false };
                    }
                    return entry;
                });
            }

            const incomeConfig = this.incomeConfig();
            const updatedSummary = FinancialCalculatorService.calculateBudget(
                incomeConfig,
                [finalExpense].filter(e => !e.isIgnored)
            );

            const newEntry: BudgetHistory = {
                month: view,
                date: new Date().toISOString(),
                incomeConfig: incomeConfig,
                expenses: [finalExpense],
                summary: updatedSummary,
                excludedFromTotals: false
            };

            return [...history, newEntry];
        });
        this.recalculateHistorySavings();
    }
  }

  updateExpense(id: string, updates: Partial<ExpenseItem>): void {
    const updateFn = (current: ExpenseItem[]) =>
      current.map(item => {
        if (item.id !== id) return item;

        const newItem = { ...item, ...updates };

        if (updates.quantity !== undefined && updates.unitPrice === undefined && updates.amount === undefined) {
             newItem.amount = newItem.unitPrice * newItem.quantity;
        } else if (updates.amount !== undefined && updates.quantity === undefined && updates.unitPrice === undefined) {
             if (newItem.quantity > 0) {
                 newItem.unitPrice = newItem.amount / newItem.quantity;
             }
        } else if (updates.unitPrice !== undefined && updates.amount === undefined) {
             newItem.amount = newItem.unitPrice * (newItem.quantity || 1);
        }

        if (newItem.quantity > 0 && Math.abs(newItem.amount - (newItem.unitPrice * newItem.quantity)) > 0.01) {
             if (updates.amount !== undefined) {
                 newItem.unitPrice = newItem.amount / newItem.quantity;
             } else {
                 newItem.amount = newItem.unitPrice * newItem.quantity;
             }
        }
        return this.normalizeItem(newItem);
      });

    if (this.isCurrentMonthView()) {
        this.currentMonthExpenses.update(updateFn);
    } else {
        const view = this.viewedMonth();
        this.history.update(history =>
            history.map(entry => {
                if (entry.month === view) {
                    const updatedExpenses = updateFn(entry.expenses);
                    const updatedSummary = FinancialCalculatorService.calculateBudget(
                        entry.incomeConfig || this.incomeConfig(),
                        updatedExpenses.filter(e => !e.isIgnored)
                    );
                    // const shouldExclude = this.isExpensesEffectivelyEmpty(updatedExpenses);
                    return { ...entry, expenses: updatedExpenses, summary: updatedSummary, excludedFromTotals: false };
                }
                return entry;
            })
        );
        this.recalculateHistorySavings();
    }
  }

  removeExpense(id: string): void {
    if (this.isCurrentMonthView()) {
        this.currentMonthExpenses.update(current => current.filter(item => item.id !== id));
    } else {
        const view = this.viewedMonth();
        this.history.update(history =>
            history.map(entry => {
                if (entry.month === view) {
                    const updatedExpenses = entry.expenses.filter(item => item.id !== id);
                    const updatedSummary = FinancialCalculatorService.calculateBudget(
                        entry.incomeConfig || this.incomeConfig(),
                        updatedExpenses.filter(e => !e.isIgnored)
                    );
                    // const shouldExclude = this.isExpensesEffectivelyEmpty(updatedExpenses);
                    return { ...entry, expenses: updatedExpenses, summary: updatedSummary, excludedFromTotals: false };
                }
                return entry;
            })
        );
                this.recalculateHistorySavings();
    }
  }

  // --- Backup & Restore ---
  exportBackup() {
      this.backupService.exportData();
  }

  async importBackup(file: File) {
      if (confirm('Importing this backup will OVERWRITE all your current Guest data. Are you sure?')) {
          const success = await this.backupService.importData(file);
          if (success) {
              // Reload state from newly imported local storage
              this.loadInitialState();
              // Force SavingsService to re-read from stores
              this.savingsService.refreshState();
              return true; // Success
          }
      }
      return false;
  }

  resetAllData() {
      if (confirm('CRITICAL ACTION: This will permanently delete ALL your local budget history and settings. This cannot be undone. Are you sure?')) {
          if (confirm('Are you ABSOLUTELY sure? Last chance to cancel.')) {
              this.storageEngine.clearAll();
              window.location.reload(); // Refresh to clean state
          }
      }
  }

  private isCurrentMonthView(): boolean {
      return this.viewedMonth() === this.settings().lastActiveMonth;
  }

  // Manual Savings Actions
  trackManualSavings(amount: number) {
      this.savingsService.addToSavings(amount); // Update real balance
      this.manualSavingsLog.update(v => v + amount); // Log for history
  }

  // History & Rollover
  archiveAndResetMonth(): void {
    // Only allow manual archive of CURRENT month
    if (!this.isCurrentMonthView()) return;

    const expenses = this.currentMonthExpenses();
    const incomeConfig = this.incomeConfig();
    const summary = this.budgetSummary(); // This uses current month expenses anyway due to isCurrentMonthView check implicitly

    const shouldExclude = this.isExpensesEffectivelyEmpty(expenses);
    const currentState: BudgetHistory = {
        month: this.settings().lastActiveMonth, // Usually current
        date: new Date().toISOString(),
        incomeConfig: incomeConfig,
        expenses: expenses,
        summary: summary,
        excludedFromTotals: shouldExclude
    };

    // 0. Update Savings Module with this month's snapshot
    // Logic:
    // - "Saving" Items are treated as allocated funds, so they are added back to "transferred" calculation.
    // - If Remaining Income is negative (overspending), we must DEDUCT that deficit from savings storage.
    const activeExpenses = expenses.filter(item => !item.isIgnored);
    const plannedSavings = this.sumByType(activeExpenses, 'Saving');

    // Savings balance represents the net change to savings storage (can be negative)
    const transferredAmount = summary.savingsBalance;

    // Free Money Logic:
    // Defined as unallocated surplus. This is what's left after ALL obligations (including planned savings).
    // If you have $500 planned savings and $200 surplus, Free Money is $200.
    // Transferred to Savings is $700.
    // If you have NO planned savings, then Free Money = Transferred = $200. This is correct but visually redundant.

    this.savingsService.addMonthlySnapshot({
        month: currentState.month,
        income: summary.totalIncome,
        expenses: summary.plannedOutflow,
        realExpenses: summary.realExpenses,
        freeMoney: summary.freeMoney, // Record actual processed result (can be negative)
        plannedSavings: plannedSavings,
        savingsImpact: summary.freeMoney < 0 ? summary.freeMoney : 0, // Records how much deficit ate into savings
        transferredToSavings: transferredAmount,
        manualAdded: this.manualSavingsLog(),
        excludedFromTotals: shouldExclude
    });

    // Reset Manual Log for next month
    this.manualSavingsLog.set(0);

    // 1. Archive the full current state so ignored items remain part of the monthly record.
    // Budget calculations already exclude ignored items, so the archive can keep the complete list.
    const historyState = {
        ...currentState,
        expenses: currentState.expenses.map(item => ({ ...item }))
    };
    this.history.update(current => [...current, historyState]);

    // 2. Carry every item into the next month so hidden items are not deleted on rollover.
    // Reset ignore status so the new month starts with a clean active state.
    this.currentMonthExpenses.set(this.buildCarryoverItems(currentState.expenses));

    // 3. Advance Date to Next Month
    const currentActive = this.settings().lastActiveMonth;
    const date = new Date(currentActive + '-01');
    date.setMonth(date.getMonth() + 1);
    const nextMonth = date.toISOString().slice(0, 7);

    this.settings.update(s => ({ ...s, lastActiveMonth: nextMonth }));
    this.viewedMonth.set(nextMonth);
  }

  // --- REVERT / UNDO LOGIC ---

  /**
   * Attempts to undo the last "Start New Month" action.
   * Logic based on user requirement:
   * 1. If currently in a future month (relative to real date), revert fully to previous month.
   * 2. If currently in real month, just reset/clear current items (don't go back to past).
   */
  // --- REVERT / UNDO LOGIC ---

  canRevertMonth(): boolean {
      const currentActive = this.settings().lastActiveMonth;
      const now = new Date();
      const realMonthStr = now.toISOString().slice(0, 7);
      const history = this.history();

      // Can only revert if:
      // 1. We have history to go back to.
      // 2. The *current active month* is in the future relative to real time.
      return history.length > 0 && currentActive > realMonthStr;
  }

  isFutureMonth(): boolean {
      const currentActive = this.settings().lastActiveMonth;
      const now = new Date();
      const realMonthStr = now.toISOString().slice(0, 7);
      return currentActive > realMonthStr;
  }

  revertToPreviousMonth() {
      const history = this.history();
      if (history.length === 0) return;

      const lastArchived = history[history.length - 1];

      // 1. Reverse Savings Impact
      this.savingsService.removeLastSnapshot();

      // 2. Restore State
    this.currentMonthExpenses.set(this.normalizeItems(lastArchived.expenses));
      this.incomeConfig.set(lastArchived.incomeConfig);

      this.settings.update(s => ({ ...s, lastActiveMonth: lastArchived.month }));
      this.viewedMonth.set(lastArchived.month);

      // 3. Remove from History
      this.history.update(h => h.slice(0, -1));
  }

  resetCurrentMonthItems() {
       this.currentMonthExpenses.update(items =>
          items.map(item => {
              // Reset values but keep structure
              return {
                  ...item,
                  amount: 0,
                  quantity: 1,
                  unitPrice: 0
              };
          })
       );
  }

  refreshHistoryDerivedState(): void {
      this.recalculateHistorySavings();
  }

  setHistoryMonthExcluded(month: string, excluded: boolean): void {
      this.history.update(history =>
          history.map(entry => entry.month === month
              ? { ...entry, excludedFromTotals: excluded }
              : entry
          )
      );
      this.recalculateHistorySavings();
  }

  deleteHistoryMonth(month: string): void {
      const currentView = this.viewedMonth();
      const activeMonth = this.settings().lastActiveMonth;

      this.history.update(history => history.filter(entry => entry.month !== month));

      if (currentView === month) {
          this.viewedMonth.set(activeMonth);
      }

      this.recalculateHistorySavings();
  }

  isHistoryMonthEmpty(month: string): boolean {
      const entry = this.history().find(h => h.month === month);
      if (!entry) return false;
      return this.isExpensesEffectivelyEmpty(entry.expenses ?? []);
  }

  private recalculateHistorySavings(): void {
      const history = this.history();
      const historyData = this.historyStore.getData();
      const existingRecords = historyData.savingsHistory ?? [];
      const manualLog = historyData.savingsSummary?.manualSavingsLog ?? 0;

      const recordByMonth = new Map(existingRecords.map(record => [record.month, record]));

      const sortedHistory = [...history].sort((a, b) => a.month.localeCompare(b.month));
      const now = new Date().toISOString();
      let runningTotal = 0;

      const recalculated = sortedHistory.map(entry => {
          const normalizedExpenses = this.normalizeItems(entry.expenses ?? []);
          const activeExpenses = normalizedExpenses.filter(item => !item.isIgnored);
          const summary = FinancialCalculatorService.calculateBudget(
              entry.incomeConfig || this.incomeConfig(),
              activeExpenses
          );

          const plannedSavings = this.sumByType(activeExpenses, 'Saving');
          const existing = recordByMonth.get(entry.month);
          const manualAdded = existing?.manualAdded ?? 0;
          const isExcluded = entry.excludedFromTotals ?? this.isExpensesEffectivelyEmpty(normalizedExpenses);

          if (!isExcluded) {
              runningTotal += manualAdded + summary.savingsBalance;
          }

          return {
              month: entry.month,
              income: summary.totalIncome,
              expenses: summary.plannedOutflow,
              realExpenses: summary.realExpenses,
              freeMoney: summary.freeMoney,
              transferredToSavings: summary.savingsBalance,
              plannedSavings: plannedSavings,
              savingsImpact: summary.freeMoney < 0 ? summary.freeMoney : 0,
              manualAdded,
              savingsTotalAfterTransfer: runningTotal,
              date: existing?.date ?? entry.date ?? now,
              excludedFromTotals: isExcluded
          };
      });

      const currentTotal = historyData.savingsSummary?.totalSavings ?? runningTotal;
      const sortedExisting = [...existingRecords].sort((a, b) => a.month.localeCompare(b.month));
      const existingHistoryTotal = sortedExisting.length > 0
          ? sortedExisting[sortedExisting.length - 1].savingsTotalAfterTransfer
          : 0;
      const delta = currentTotal - existingHistoryTotal;
      const nextTotal = runningTotal + delta;

      this.historyStore.updateData({
          savingsHistory: recalculated,
          savingsSummary: {
              totalSavings: nextTotal,
              manualSavingsLog: manualLog,
              lastUpdated: now
          }
      });

      this.savingsService.refreshState();
  }

  private normalizeHistory(history: BudgetHistory[]): BudgetHistory[] {
      return history.map(entry => {
          const normalizedExpenses = this.normalizeItems(entry.expenses ?? []);
          const isExcluded = entry.excludedFromTotals ?? false;

          return {
              ...entry,
              expenses: normalizedExpenses,
              excludedFromTotals: isExcluded
          };
      });
  }

  private normalizeItems(items: ExpenseItem[]): ExpenseItem[] {
      return items.map(item => this.normalizeItem(item));
  }

  private normalizeItem(item: ExpenseItem): ExpenseItem {
      const normalizedType = this.normalizeType(item.type as string);
      const normalizedPriority = this.normalizePriority(item.priority as string);
      const isReducible = item.isReducible ?? true;
      return {
          ...item,
          type: normalizedType,
          priority: normalizedPriority,
          isReducible: normalizedType === 'Saving' ? isReducible : item.isReducible
      };
  }

  private normalizeType(type: string): ExpenseItem['type'] {
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

  private normalizePriority(priority: string): PriorityLevel {
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

  private sumByType(items: ExpenseItem[], type: ExpenseItem['type']): number {
      return items
          .filter(item => item.type === type)
          .reduce((sum, item) => sum + (item.amount || 0), 0);
  }

  private isExpensesEffectivelyEmpty(items: ExpenseItem[]): boolean {
      if (!items || items.length === 0) return true;
      return items.every(item => item.isIgnored);
  }

  private buildCarryoverItems(items: ExpenseItem[]): ExpenseItem[] {
      return items
          .filter(item => item.type === 'Tax' || item.type === 'Saving')
          .map(item => ({ ...item }));
  }

    private syncStores() {
        const incomeConfig = this.incomeConfig();
        const history = this.history();
        const settings = this.settings();
        const currentExpenses = this.currentMonthExpenses();
        const manualLog = this.manualSavingsLog();
        const now = new Date().toISOString();

        this.incomeStore.updateData({ incomeConfig });

        this.itemsStore.setData({
            currentMonth: {
                month: settings.lastActiveMonth,
                items: currentExpenses,
                updatedAt: now
            },
            months: this.buildMonthsMap(history, now),
            settings: { ...settings }
        });

        const historyData = this.historyStore.getData();
        const summary = historyData.savingsSummary ?? {
            totalSavings: 0,
            manualSavingsLog: 0,
            lastUpdated: now
        };

        this.historyStore.updateData({
            budgetHistory: history,
            savingsSummary: {
                ...summary,
                manualSavingsLog: manualLog,
                lastUpdated: now
            }
        });
    }

    private buildMonthsMap(history: BudgetHistory[], fallbackDate: string): Record<string, MonthlyItems> {
        return history.reduce<Record<string, MonthlyItems>>((acc, entry) => {
            const updatedAt = entry.date || fallbackDate;
            acc[entry.month] = {
                month: entry.month,
                items: entry.expenses ?? [],
                updatedAt
            };
            return acc;
        }, {});
    }
}


