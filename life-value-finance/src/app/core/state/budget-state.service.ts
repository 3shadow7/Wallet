import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ExpenseItem, BudgetSummary, UserIncomeConfig, BudgetHistory, UserSettings } from '@core/domain/models';
import { FinancialCalculatorService } from '@core/domain/financial-calculator.service';
import { PersistenceService, AppStateData } from '@core/services/persistence.service';
import { SavingsService } from '@core/services/savings.service';

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
  private platformId = inject(PLATFORM_ID);
  private persistenceService = inject(PersistenceService);
  private savingsService = inject(SavingsService);

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
    }
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
    const historyEntry: BudgetHistory = {
        month: month,
        date: new Date().toISOString(),
        incomeConfig: this.incomeConfig(),
        expenses: this.currentMonthExpenses(),
        summary: this.budgetSummary()
    };
    
    this.history.update(h => [...h, historyEntry]);
    
    // For now we keep expenses as template for next month
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
    const finalExpense = { ...expense, quantity, unitPrice, amount };

    if (this.isCurrentMonthView()) {
        this.currentMonthExpenses.update(current => [...current, finalExpense]);
    } else {
        // Find and update history entry
        const view = this.viewedMonth();
        this.history.update(history => 
            history.map(entry => {
                if (entry.month === view) {
                    const updatedExpenses = [...entry.expenses, finalExpense];
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
        
        // Also update SavingsService snapshot if it exists for this month
        const summary = this.budgetSummary();
        const transferToSavings = summary.remainingIncome > 0 ? summary.remainingIncome : 0;
        
        // This is a manual correction to the snapshot
        // We'll need to add a specialized method to SavingsService later if we want full consistency,
        // but updating history signal in BudgetState should handle UI refresh for now.
    }
  }

  updateExpense(id: string, updates: Partial<ExpenseItem>): void {
    const updateFn = (current: ExpenseItem[]) => 
      current.map(item => {
        if (item.id !== id) return item;

        let newItem = { ...item, ...updates };

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

    // 1. Archive current state
    // Filter out ignored items from history so they don't pollute the record
    const historyState = { 
        ...currentState, 
        expenses: currentState.expenses.filter(e => !e.isIgnored) 
    };
    this.history.update(current => [...current, historyState]);
    
    // 2. Clear Burning Expenses, Keep Responsibility AND Saving
    // Note: We keep ignored items for next month (resetting them to active)
    this.currentMonthExpenses.update(current => 
        current
            .filter(item => item.type === 'Responsibility' || item.type === 'Saving')
            .map(item => ({ ...item, isIgnored: false })) // Reset ignore status for new month
    );
    
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


