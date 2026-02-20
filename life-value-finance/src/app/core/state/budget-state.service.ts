import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ExpenseItem, BudgetSummary, UserIncomeConfig, BudgetHistory } from '@core/domain/models';
import { FinancialCalculatorService } from '@core/domain/financial-calculator.service';
import { PersistenceService, AppStateData } from '@core/services/persistence.service';
import { SavingsService } from '@core/services/savings.service';

/**
 * State Interface
 */
export interface BudgetState {
  incomeConfig: UserIncomeConfig;
  expenses: ExpenseItem[];
  history: BudgetHistory[];
}

const INITIAL_STATE: BudgetState = {
  incomeConfig: {
    monthlyIncome: 0,
    workHoursPerMonth: 160,
    hourlyRate: 0,
    isHourlyManual: false,
    calculationMethod: 'weekly',
    weeklyHoursDetails: { hoursPerDay: 8, daysPerWeek: 5 }
  },
  expenses: [],
  history: []
};

@Injectable({
  providedIn: 'root'
})
export class BudgetStateService {
  private platformId = inject(PLATFORM_ID);
  private persistenceService = inject(PersistenceService);
  private savingsService = inject(SavingsService);

  // --- Core State ---
  // Using a single configuration object for income as per new requirements
  private incomeConfig = signal<UserIncomeConfig>(INITIAL_STATE.incomeConfig);
  private expenses = signal<ExpenseItem[]>(INITIAL_STATE.expenses);
  private history = signal<BudgetHistory[]>(INITIAL_STATE.history);
  private manualSavingsLog = signal<number>(0); // Track manual additions

  // --- Derived State (Readonly) ---
  readonly incomeConfigSignal = this.incomeConfig.asReadonly();
  readonly expensesSignal = this.expenses.asReadonly();
  readonly historySignal = this.history.asReadonly();
  
  // Loading State
  private loading = signal<boolean>(true);
  readonly loadingSignal = this.loading.asReadonly();

  readonly budgetSummary = computed<BudgetSummary>(() => {
    return FinancialCalculatorService.calculateBudget(
      this.incomeConfig(),
      this.expenses()
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
        expenses: this.expenses(),
        history: this.history()
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
        if (savedState.expenses) this.expenses.set(savedState.expenses);
        if (savedState.history) this.history.set(savedState.history);
      }
    } catch (e) {
      console.error('Failed to load state', e);
    } finally {
      this.loading.set(false);
    }
  }

  // --- Actions ---

  // Income Config
  updateIncomeConfig(config: Partial<UserIncomeConfig>): void {
    this.incomeConfig.update(current => ({ ...current, ...config }));
  }

  // Expenses
  addExpense(expense: ExpenseItem): void {
    this.expenses.update(current => [...current, expense]);
  }

  updateExpense(id: string, updates: Partial<ExpenseItem>): void {
    this.expenses.update(current =>
      current.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  }

  removeExpense(id: string): void {
    this.expenses.update(current => current.filter(item => item.id !== id));
  }

  // Manual Savings Actions
  trackManualSavings(amount: number) {
      this.savingsService.addToSavings(amount); // Update real balance
      this.manualSavingsLog.update(v => v + amount); // Log for history
  }

  // History & Rollover
  archiveAndResetMonth(): void {
    const expenses = this.expenses();
    const incomeConfig = this.incomeConfig();
    const summary = this.budgetSummary();

    const currentState: BudgetHistory = {
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
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
        .filter(item => item.type === 'Saving') // Ensure strict match with ExpenseItem type
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
    this.history.update(current => [...current, currentState]);
    
    // 2. Clear Burning Expenses, Keep Responsibility AND Saving
    this.expenses.update(current => 
        current.filter(item => item.type === 'Responsibility' || item.type === 'Saving')
    );
  }
}
