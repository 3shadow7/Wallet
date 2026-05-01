import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ExpenseItem, BudgetSummary, UserIncomeConfig, BudgetHistory, UserSettings } from '@core/domain/models';
import { FinancialCalculatorService } from '@core/domain/financial-calculator.service';
import { PersistenceService, AppStateData } from '@core/services/persistence.service';
import { SavingsService } from '@core/services/savings.service';
import { AuthService } from '@core/services/auth.service';
import { Expense as FinanceExpense, FinanceService, UserIncome } from '@core/services/finance.service';
import { OfflineSyncService, SyncOp as OfflineSyncOp } from '@core/services/offline-sync.service';

type IncomeSyncPayload = Partial<UserIncome> & {
    expected_updated_at?: string;
    force?: boolean;
};

type IncomeConflictResponse = {
    detail?: string;
    server_income?: UserIncome;
    server_updated_at?: string;
    updated_at?: string;
} & Record<string, unknown>;

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

const INCOME_UPDATED_AT_KEY = 'income_server_updated_at';

@Injectable({
  providedIn: 'root'
})
export class BudgetStateService {
  private platformId = inject(PLATFORM_ID);
  private persistenceService = inject(PersistenceService);
  private savingsService = inject(SavingsService);
    private authService = inject(AuthService);
    private financeService = inject(FinanceService);
    private lastPulledRemoteMonth: string | null = null;
    private hasPulledRemoteIncome = false;
    private seededCarryoverMonths = new Set<string>();
    private offlineSync = inject(OfflineSyncService);
    private incomeServerUpdatedAt: string | null = null;

  // --- Core State ---
  private incomeConfig = signal<UserIncomeConfig>(INITIAL_STATE.incomeConfig);
  // Renamed to clarify it holds strictly the current active month's data
  private currentMonthExpenses = signal<ExpenseItem[]>(INITIAL_STATE.expenses);
  private history = signal<BudgetHistory[]>(INITIAL_STATE.history);
  private settings = signal<UserSettings>(INITIAL_STATE.settings);
  private manualSavingsLog = signal<number>(0);

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
  readonly totalExpenses = computed(() => this.budgetSummary().totalExpenses);
  readonly remainingIncome = computed(() => this.budgetSummary().remainingIncome);
  readonly hourlyRate = computed(() => this.budgetSummary().hourlyRate);

  constructor() {
        this.incomeServerUpdatedAt = this.loadIncomeUpdatedAtFromLocal();
    this.loadInitialState();

    // Persistence Hook
    effect(() => {
      const currentState: Partial<AppStateData> = {
        incomeConfig: this.incomeConfig(),
        expenses: this.currentMonthExpenses(), // Ensure we save CURRENT month expenses
        history: this.history(),
        settings: this.settings()
      };

      this.persistenceService.saveState(currentState);
      if (isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined') {
        localStorage.setItem('manualSavingsLog', this.manualSavingsLog().toString());
      }
    });

        // When auth/session month context changes, pull the latest current-month expenses once.
        effect(() => {
            const isAuthenticated = this.authService.isAuthenticated();
            const month = this.settings().lastActiveMonth;
            const viewingCurrentMonth = this.viewedMonth() === month;
            if (!isAuthenticated) {
                this.lastPulledRemoteMonth = null;
                this.hasPulledRemoteIncome = false;
                this.seededCarryoverMonths.clear();
                return;
            }

            this.pullIncomeFromBackend();
            if (isAuthenticated && viewingCurrentMonth) {
                this.pullCurrentMonthExpensesFromBackend(month);
            }
        });
  }

  private async loadInitialState() {
    // Load Manual Savings Log
    if (isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined') {
      const savedLog = localStorage.getItem('manualSavingsLog');
      if (savedLog) {
         this.manualSavingsLog.set(Number(savedLog));
      }
    }

    try {
      const savedState = await this.persistenceService.loadState();
      if (savedState) {
        if (savedState.incomeConfig) this.incomeConfig.set(savedState.incomeConfig);
        if (savedState.expenses) this.currentMonthExpenses.set(savedState.expenses);
        if (savedState.history) this.history.set(savedState.history);
        if (savedState.settings) {
            this.settings.set(savedState.settings);
            // Default view to current active month on load
            this.viewedMonth.set(savedState.settings.lastActiveMonth);
        }
      }
    } catch (e) {
      console.error('Failed to load state', e);
    } finally {
      this.loading.set(false);
      this.checkMonthRollover();

            const month = this.settings().lastActiveMonth;
            if (this.authService.isAuthenticated()) {
                this.pullIncomeFromBackend();
                this.pullCurrentMonthExpensesFromBackend(month);
            }
    }
  }

    private pullIncomeFromBackend(): void {
        if (!isPlatformBrowser(this.platformId) || !this.authService.isAuthenticated()) return;
        if (this.hasPulledRemoteIncome) return;

        this.financeService.getIncome().subscribe({
            next: (remoteIncome) => {
                this.applyServerIncome(remoteIncome);
            },
            error: (error) => {
                console.warn('Unable to pull income from backend. Keeping local state.', error);
            }
        });
    }

    private toFinanceIncome(config: UserIncomeConfig): Partial<UserIncome> {
        return {
            monthly_income: Number(config.monthlyIncome ?? 0),
            work_hours_per_month: Number(config.workHoursPerMonth ?? 160),
            hourly_rate: Number(config.hourlyRate ?? 0),
            is_hourly_manual: !!config.isHourlyManual,
            calculation_method: config.calculationMethod ?? 'weekly',
            hours_per_day: Number(config.weeklyHoursDetails?.hoursPerDay ?? 8),
            days_per_week: Number(config.weeklyHoursDetails?.daysPerWeek ?? 5),
        };
    }

    private loadIncomeUpdatedAtFromLocal(): string | null {
        if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return null;
        return localStorage.getItem(INCOME_UPDATED_AT_KEY);
    }

    private setIncomeServerUpdatedAt(updatedAt: string | null | undefined): void {
        this.incomeServerUpdatedAt = updatedAt || null;
        if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
        if (this.incomeServerUpdatedAt) {
            localStorage.setItem(INCOME_UPDATED_AT_KEY, this.incomeServerUpdatedAt);
        } else {
            localStorage.removeItem(INCOME_UPDATED_AT_KEY);
        }
    }

    private buildIncomeSyncPayload(config: UserIncomeConfig, expectedOverride?: string | null, force?: boolean): IncomeSyncPayload {
        const payload: IncomeSyncPayload = this.toFinanceIncome(config);
        const expected = expectedOverride ?? this.incomeServerUpdatedAt;
        if (expected) payload.expected_updated_at = expected;
        if (force) payload.force = true;
        return payload;
    }

    private recordIncomeConflict(clientPayload: IncomeSyncPayload, serverPayload: IncomeConflictResponse) {
        const resolvedServerPayload: Record<string, unknown> = serverPayload.server_income
            ? { ...serverPayload.server_income }
            : serverPayload['income']
                ? { ...(serverPayload['income'] as Record<string, unknown>) }
                : { ...serverPayload };

        const conflict = {
            opId: `income-${crypto.randomUUID()}`,
            resource: 'income',
            type: 'update',
            reason: 'stale_income_update',
            clientPayload,
            serverPayload: resolvedServerPayload,
            serverUpdatedAt: serverPayload?.server_updated_at || serverPayload?.updated_at,
            expectedUpdatedAt: clientPayload?.expected_updated_at,
            createdAt: new Date().toISOString()
        };
        this.offlineSync.recordConflicts([conflict]);
    }

    private queueExpenseCreateOrUpdate(expense: ExpenseItem, month: string): void {
        const payload = { ...this.toFinanceExpense(expense, month) } as OfflineSyncOp['payload'];
        this.offlineSync.upsert({
            id: `expense-${expense.id}`,
            type: 'create',
            payload,
            resource: 'expense',
            clientId: expense.id,
        });
    }

    private shouldSyncCurrentMonthWithBackend(): boolean {
        return isPlatformBrowser(this.platformId) && this.authService.isAuthenticated() && this.isCurrentMonthView();
    }

    private pullCurrentMonthExpensesFromBackend(month: string): void {
        if (!this.shouldSyncCurrentMonthWithBackend()) return;
        if (this.lastPulledRemoteMonth === month) return;

        this.financeService.getExpenses(month).subscribe({
            next: (remoteExpenses) => {
                // When a new month starts, local carryover items are created first.
                // If backend is still empty for that month, do not wipe local items.
                // Keep local state visible and seed backend in the background.
                const localCarryover = this.currentMonthExpenses();
                if (remoteExpenses.length === 0 && localCarryover.length > 0) {
                    this.lastPulledRemoteMonth = month;
                    this.seedCurrentMonthCarryoverToBackend(month);
                    return;
                }
                const mapped = remoteExpenses.map(expense => this.fromFinanceExpense(expense));
                this.currentMonthExpenses.set(mapped);
                this.lastPulledRemoteMonth = month;
            },
            error: (error) => {
                console.warn('Unable to pull expenses from backend. Keeping local state.', error);
            }
        });
    }

    private seedCurrentMonthCarryoverToBackend(month: string): void {
        if (!isPlatformBrowser(this.platformId) || !this.authService.isAuthenticated()) return;
        if (this.seededCarryoverMonths.has(month)) return;

        const carryover = this.currentMonthExpenses();
        if (carryover.length === 0) return;

        this.seededCarryoverMonths.add(month);
        for (const item of carryover) {
            this.financeService.addExpense(this.toFinanceExpense(item, month)).subscribe({
                next: (savedExpense) => {
                    const synced = this.fromFinanceExpense(savedExpense);
                    this.replaceExpenseById(item.id, synced);
                },
                error: (error) => {
                    console.warn('Failed to seed month carryover item to backend. Keeping local state.', error);
                }
            });
        }
    }

    private fromFinanceExpense(expense: FinanceExpense): ExpenseItem {
        return {
            id: String(expense.id ?? crypto.randomUUID()),
            name: expense.name,
            category: expense.category ?? undefined,
            amount: Number(expense.amount),
            unitPrice: Number(expense.unit_price),
            quantity: Number(expense.quantity),
            isIgnored: !!expense.is_ignored,
            type: this.normalizeExpenseType(expense.type),
            priority: expense.priority as ExpenseItem['priority']
        };
    }

    // Public helper used by OfflineSyncService to apply server-created expense mappings
    applyServerExpenseMapping(previousClientId: string, serverExpense: FinanceExpense) {
        try {
            const mapped = this.fromFinanceExpense(serverExpense);
            this.replaceExpenseById(previousClientId, mapped);
        } catch (e) {
            console.warn('applyServerExpenseMapping failed', e);
        }
    }

    // Apply server-provided income snapshot to local state.
    applyServerIncome(serializedIncome: UserIncome) {
        try {
            const incomeConfig = this.incomeConfig();
            const updated: UserIncomeConfig = {
                monthlyIncome: Number(serializedIncome.monthly_income ?? incomeConfig.monthlyIncome ?? 0),
                workHoursPerMonth: Number(serializedIncome.work_hours_per_month ?? incomeConfig.workHoursPerMonth ?? 160),
                hourlyRate: Number(serializedIncome.hourly_rate ?? incomeConfig.hourlyRate ?? 0),
                isHourlyManual: !!serializedIncome.is_hourly_manual,
                calculationMethod: (serializedIncome.calculation_method ?? incomeConfig.calculationMethod) as 'weekly' | 'manual',
                weeklyHoursDetails: {
                    hoursPerDay: Number(serializedIncome.hours_per_day ?? incomeConfig.weeklyHoursDetails?.hoursPerDay ?? 8),
                    daysPerWeek: Number(serializedIncome.days_per_week ?? incomeConfig.weeklyHoursDetails?.daysPerWeek ?? 5)
                }
            };
            this.incomeConfig.set(updated);
            this.hasPulledRemoteIncome = true;
            if (serializedIncome.updated_at) {
                this.setIncomeServerUpdatedAt(serializedIncome.updated_at);
            }
        } catch (e) {
            console.warn('applyServerIncome failed', e);
        }
    }

    private toFinanceExpense(expense: ExpenseItem, month: string): FinanceExpense {
        return {
            name: expense.name,
            category: expense.category,
            amount: expense.amount,
            unit_price: expense.unitPrice,
            quantity: expense.quantity,
            is_ignored: !!expense.isIgnored,
            type: this.normalizeExpenseType(expense.type),
            priority: expense.priority,
            month
        };
    }

    private normalizeExpenseType(type: string | undefined): ExpenseItem['type'] {
        const normalized = (type ?? '').trim().toLowerCase();
        if (normalized === 'saving') return 'Saving';
        if (normalized === 'responsibility' || normalized === 'responsibilty') return 'Responsibility';
        return 'Burning';
    }

    private buildRecurringCarryover(expenses: ExpenseItem[]): ExpenseItem[] {
        return expenses
            .map(item => ({ ...item, type: this.normalizeExpenseType(item.type) }))
            .filter(item => item.type === 'Responsibility' || item.type === 'Saving');
    }

    private getBackendExpenseId(id: string): number | null {
        const parsed = Number(id);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    private replaceExpenseById(previousId: string, replacement: ExpenseItem): void {
        this.currentMonthExpenses.update(current =>
            current.map(item => (item.id === previousId ? replacement : item))
        );
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
        // Keep only recurring intent items when crossing into a new month automatically.
        this.currentMonthExpenses.set(this.buildRecurringCarryover(this.currentMonthExpenses()));
        this.settings.update(s => ({ ...s, lastActiveMonth: currentMonth }));
        this.viewedMonth.set(currentMonth); // Switch view to new month
        // Ensure the newly active month pulls/seeds after carryover filtering.
        this.lastPulledRemoteMonth = null;
    }
  }

  private archiveCurrentMonth(month: string) {
    const historyEntry: BudgetHistory = {
        month: month,
        date: new Date().toISOString(),
        incomeConfig: this.incomeConfig(),
        expenses: this.currentMonthExpenses(),
        summary: this.budgetSummary()
    };

    this.history.update(h => [...h, historyEntry]);
  }

  updateSettings(settings: Partial<UserSettings>) {
      this.settings.update(s => ({ ...s, ...settings }));
  }

    getIncomeSyncPayload(expectedOverride?: string | null, force?: boolean): IncomeSyncPayload {
      return this.buildIncomeSyncPayload(this.incomeConfig(), expectedOverride, force);
  }

  applySyncFlushResults(queueSnapshot: OfflineSyncOp[], flushMapping: Record<string, unknown>): void {
      const queueById = new Map(queueSnapshot.map((item) => [item.id, item]));

      for (const [opId, result] of Object.entries(flushMapping || {})) {
          const queued = queueById.get(opId);
          if (!queued || !result) {
              continue;
          }

          if (queued.resource === 'expense' && queued.clientId) {
              this.applyServerExpenseMapping(queued.clientId, result as FinanceExpense);
              continue;
          }

          if (queued.resource === 'income') {
              const incomePayload = this.extractIncomeSyncResult(result);
              if (incomePayload) {
                  this.applyServerIncome(incomePayload);
              }
          }
      }
  }

  private extractIncomeSyncResult(result: unknown): UserIncome | null {
      if (!result || typeof result !== 'object') {
          return null;
      }

      if ('income' in result) {
          const payload = (result as { income?: unknown }).income;
          if (payload && typeof payload === 'object') {
              return payload as UserIncome;
          }
      }

      return null;
  }

  // --- Actions ---

  // Income Config
  updateIncomeConfig(config: Partial<UserIncomeConfig>): void {
    const nextConfig = { ...this.incomeConfig(), ...config };
    this.incomeConfig.set(nextConfig);

        if (!this.shouldSyncCurrentMonthWithBackend()) return;

        const payload = this.buildIncomeSyncPayload(nextConfig);
        this.financeService.updateIncome(payload).subscribe({
            next: (remoteIncome) => {
                this.applyServerIncome(remoteIncome);
            },
            error: (error) => {
                if (error?.status === 409 && error?.error) {
                    this.recordIncomeConflict(payload, error.error);
                    return;
                }
                console.warn('Failed to sync income update to backend. Queuing for later.', error);
                const opId = crypto.randomUUID();
                this.offlineSync.enqueue({ id: opId, type: 'update', payload, resource: 'income' });
            }
        });
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
    const finalExpense = { ...expense, quantity, unitPrice, amount, id: expense.id ?? crypto.randomUUID() };

        const viewMonth = this.viewedMonth();

        if (this.shouldSyncCurrentMonthWithBackend()) {
            // Local-first write so UX remains instant even during slow network calls.
            this.currentMonthExpenses.update(current => [finalExpense, ...current]);

            this.financeService.addExpense(this.toFinanceExpense(finalExpense, viewMonth)).subscribe({
                next: (savedExpense) => {
                    const synced = this.fromFinanceExpense(savedExpense);
                    this.replaceExpenseById(finalExpense.id, synced);
                },
                error: (error) => {
                    console.warn('Failed to sync added expense to backend. Queuing for later sync.', error);
                    // Keep a single pending create per local expense so repeated edits do not duplicate rows later.
                    this.queueExpenseCreateOrUpdate(finalExpense, viewMonth);
                }
            });
            return;
        }

    if (this.isCurrentMonthView()) {
        // UX: show newly added items first so users can see/edit immediately.
        this.currentMonthExpenses.update(current => [finalExpense, ...current]);
    } else {
        // Find and update history entry
        const view = this.viewedMonth();
        this.history.update(history =>
            history.map(entry => {
                if (entry.month === view) {
                    const updatedExpenses = [finalExpense, ...entry.expenses];
                    // Recalculate summary for history entry
                    const updatedSummary = FinancialCalculatorService.calculateBudget(
                        entry.incomeConfig || this.incomeConfig(),
                        updatedExpenses.filter(e => !e.isIgnored)
                    );
                    return { ...entry, expenses: updatedExpenses, summary: updatedSummary };
                }
                return entry;
            })
        );

        // This is a manual correction to the snapshot
        // We'll need to add a specialized method to SavingsService later if we want full consistency,
        // but updating history signal in BudgetState should handle UI refresh for now.
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
        return newItem;
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
                    return { ...entry, expenses: updatedExpenses, summary: updatedSummary };
                }
                return entry;
            })
        );
    }

        if (!this.shouldSyncCurrentMonthWithBackend()) return;

        const currentExpense = this.currentMonthExpenses().find(item => item.id === id);
        if (!currentExpense) return;

        const backendId = this.getBackendExpenseId(id);
        if (backendId === null) {
            // Item not yet created on server — update the pending create instead of queuing another op.
            this.queueExpenseCreateOrUpdate(currentExpense, this.viewedMonth());
            return;
        }

        this.financeService.updateExpense(backendId, this.toFinanceExpense(currentExpense, this.viewedMonth())).subscribe({
            error: (error) => {
                console.warn('Failed to sync updated expense to backend. Queuing update for later.', error);
                const opId = crypto.randomUUID();
                this.offlineSync.enqueue({ id: opId, type: 'update', payload: { id: backendId, ...this.toFinanceExpense(currentExpense, this.viewedMonth()) }, resource: 'expense' });
            }
        });
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
                    return { ...entry, expenses: updatedExpenses, summary: updatedSummary };
                }
                return entry;
            })
        );
    }

        if (!this.shouldSyncCurrentMonthWithBackend()) return;

        const backendId = this.getBackendExpenseId(id);
        if (backendId === null) {
            // Item never existed on server — remove any queued create ops for this client id
            try {
                this.offlineSync.removeByClientId(id);
            } catch (e) {
                console.warn('Failed to prune queued create ops for deleted local item', id, e);
            }
            return;
        }

        this.financeService.deleteExpense(backendId).subscribe({
            error: (error) => {
                console.warn('Failed to sync removed expense to backend. Queuing delete for later.', error);
                const opId = crypto.randomUUID();
                this.offlineSync.enqueue({ id: opId, type: 'delete', payload: { id: backendId }, resource: 'expense' });
            }
        });
  }

  // --- Backup & Restore ---
  exportBackup() {
      this.persistenceService.exportState();
  }

  async importBackup(file: File) {
      if (confirm('Importing this backup will OVERWRITE all your current Guest data. Are you sure?')) {
          const success = await this.persistenceService.importState(file);
          if (success) {
              // Reload state from newly imported local storage
              await this.loadInitialState();
              // Force SavingsService to re-read from localStorage
              this.savingsService.refreshState();
              return true; // Success
          }
      }
      return false;
  }

  resetAllData() {
      if (confirm('CRITICAL ACTION: This will permanently delete ALL your local budget history and settings. This cannot be undone. Are you sure?')) {
          if (confirm('Are you ABSOLUTELY sure? Last chance to cancel.')) {
              localStorage.clear(); // Wipes everything in browser
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

    const currentState: BudgetHistory = {
        month: this.settings().lastActiveMonth, // Usually current
        date: new Date().toISOString(),
        incomeConfig: incomeConfig,
        expenses: expenses,
        summary: summary
    };

    // 0. Update Savings Module with this month's snapshot
    // Logic:
    // - "Saving" Items are treated as allocated funds, so they are added back to "transferred" calculation.
    // - If Remaining Income is negative (overspending), we must DEDUCT that deficit from savings storage.
    const savingsExpensesTotal = expenses
        .filter(item => item.type === 'Saving' && !item.isIgnored) // Only count ACTIVE Savings
        .reduce((sum, item) => sum + item.amount, 0);

    // Calculate true net result: Income - (Real Expenses + Savings Contribution)
    // Note: summary.remainingIncome is clamped to 0 in FinancialCalculator, so we recalculate raw
    const rawRemaining = summary.totalIncome - summary.totalExpenses;

    // Transferred Amount Logic:
    // This value represents the net change to your Total Savings Storage.
    // If positive: Your savings grow.
    // If negative: Your savings shrink (you dipped into storage).
    const transferredAmount = rawRemaining + savingsExpensesTotal;

    // Free Money Logic:
    // Defined as unallocated surplus. This is what's left after ALL obligations (including planned savings).
    // If you have $500 planned savings and $200 surplus, Free Money is $200.
    // Transferred to Savings is $700.
    // If you have NO planned savings, then Free Money = Transferred = $200. This is correct but visually redundant.

    this.savingsService.addMonthlySnapshot({
        month: currentState.month,
        income: summary.totalIncome,
        expenses: summary.totalExpenses,
        freeMoney: rawRemaining, // Record actual processed result (can be negative)
        plannedSavings: savingsExpensesTotal,
        savingsImpact: rawRemaining < 0 ? rawRemaining : 0, // Records how much deficit ate into savings
        transferredToSavings: transferredAmount,
        manualAdded: this.manualSavingsLog()
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

    // 2. Carry only recurring intent items into next month.
    // Business rule: Burning items are one-month spend and should not auto-carry.
    // Responsibility and Saving items carry forward whether ignored or active.
    this.currentMonthExpenses.update(current => this.buildRecurringCarryover(current));

    // 3. Advance Date to Next Month
    const currentActive = this.settings().lastActiveMonth;
    const date = new Date(currentActive + '-01');
    date.setMonth(date.getMonth() + 1);
    const nextMonth = date.toISOString().slice(0, 7);

    this.settings.update(s => ({ ...s, lastActiveMonth: nextMonth }));
    this.viewedMonth.set(nextMonth);
        // Force a fresh backend pull for the new active month after rollover.
        this.lastPulledRemoteMonth = null;
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
      const removedSnapshot = this.savingsService.removeLastSnapshot();
      // Restore direct/manual savings log so redo keeps the same history analysis values.
      this.manualSavingsLog.set(removedSnapshot?.manualAdded || 0);

      // 2. Restore State
      this.currentMonthExpenses.set(lastArchived.expenses);
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
}


