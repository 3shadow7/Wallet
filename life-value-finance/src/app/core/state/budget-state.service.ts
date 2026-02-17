import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { ExpenseItem, BudgetSummary, UserIncomeConfig, BudgetHistory } from '@core/domain/models';
import { FinancialCalculatorService } from '@core/domain/financial-calculator.service';
import { PersistenceService, AppStateData } from '@core/services/persistence.service';

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
  private persistenceService = inject(PersistenceService);

  // --- Core State ---
  // Using a single configuration object for income as per new requirements
  private incomeConfig = signal<UserIncomeConfig>(INITIAL_STATE.incomeConfig);
  private expenses = signal<ExpenseItem[]>(INITIAL_STATE.expenses);
  private history = signal<BudgetHistory[]>(INITIAL_STATE.history);

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
    });
  }

  private async loadInitialState() {
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

  // History & Rollover
  archiveAndResetMonth(): void {
    const currentState: BudgetHistory = {
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
        date: new Date().toISOString(),
        incomeConfig: this.incomeConfig(),
        expenses: this.expenses(),
        summary: this.budgetSummary()
    };
    
    // 1. Archive current state
    this.history.update(current => [...current, currentState]);
    
    // 2. Clear Variable Expenses, Keep Fixed
    this.expenses.update(current => 
        current.filter(item => item.type === 'Fixed')
    );
  }
}
