import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface MonthlyRecord {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  freeMoney: number;
  transferredToSavings: number;
  plannedSavings: number; // The goal (sum of 'Saving' items)
  savingsImpact: number;  // The deficit (if any) caused by overspending
  manualAdded?: number; // New field for direct additions
  savingsTotalAfterTransfer: number;
  date: string; // ISO date of closing
}

interface SavingsState {
  totalSavings: number;
  history: MonthlyRecord[];
}

const STORAGE_KEY_SAVINGS = 'savingsStorage';
const STORAGE_KEY_HISTORY = 'monthlyHistory';

@Injectable({
  providedIn: 'root'
})
export class SavingsService {
  private platformId = inject(PLATFORM_ID);
  
  // State
  private totalSavings = signal<number>(0);
  private history = signal<MonthlyRecord[]>([]);

  // Readonly signals
  readonly totalSavingsSignal = this.totalSavings.asReadonly();
  readonly historySignal = this.history.asReadonly();

  // Computed
  readonly lastMonthTransfer = computed(() => {
    const records = this.history();
    return records.length > 0 ? records[records.length - 1].transferredToSavings : 0;
  });

  readonly averageSavingsRate = computed(() => {
    const records = this.history();
    if (records.length === 0) return 0;
    const totalTransferred = records.reduce((acc, curr) => acc + curr.transferredToSavings, 0);
    const totalIncome = records.reduce((acc, curr) => acc + curr.income, 0);
    return totalIncome > 0 ? (totalTransferred / totalIncome) * 100 : 0;
  });

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;

    const savedSavings = localStorage.getItem(STORAGE_KEY_SAVINGS);
    if (savedSavings) {
      this.totalSavings.set(Number(savedSavings));
    }

    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (savedHistory) {
      try {
        this.history.set(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }

  // Actions
  addMonthlySnapshot(record: Omit<MonthlyRecord, 'savingsTotalAfterTransfer' | 'date'>) {
    const currentTotal = this.totalSavings();
    // Manual additions are already applied to currentTotal via addToSavings() during the month.
    // We only need to add the budget transfer amount.
    const newTotal = currentTotal + record.transferredToSavings;
    
    // Default new fields for old records (fallback)
    const fullRecord: MonthlyRecord = {
      ...record,
      savingsTotalAfterTransfer: newTotal,
      date: new Date().toISOString()
    };

    // Update state
    this.totalSavings.set(newTotal);
    this.history.update(current => [...current, fullRecord]);

    // Persist
    this.saveState();
  }

  updateSavings(amount: number) {
      this.totalSavings.set(amount);
      this.saveState();
  }
  
  addToSavings(amount: number) {
      this.totalSavings.update(v => v + amount);
      this.saveState();
  }

  resetSavings() {
      this.totalSavings.set(0);
      this.history.set([]);
      this.saveState();
  }

  private saveState() {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(STORAGE_KEY_SAVINGS, this.totalSavings().toString());
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(this.history()));
  }
}
