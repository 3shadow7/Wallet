import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PersistenceService } from '@core/services/persistence.service';

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
  private persistenceService = inject(PersistenceService);
  
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
    this.refreshState();
  }

  public refreshState() {
    const s = this.persistenceService.getSavings();
    this.totalSavings.set(s.totalSavings || 0);
    this.history.set(s.monthlyHistory || []);
  }

  private loadState() {
    this.refreshState();
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
    this.persistenceService.setSavings(this.totalSavings(), this.history());
  }

  // --- REVERT LOGIC ---
  removeLastSnapshot(): MonthlyRecord | null {
      const records = this.history();
      if (records.length === 0) return null;

      const lastRecord = records[records.length - 1];
      
      // Revert the total savings calculation
      // Logic: newTotal = oldTotal + transferredToSavings
      // So: oldTotal = newTotal - transferredToSavings
      const revertedTotal = this.totalSavings() - lastRecord.transferredToSavings;
      
      this.totalSavings.set(revertedTotal);
      this.history.update(h => h.slice(0, -1)); // Remove last
      this.saveState();
      
      return lastRecord;
  }
}

