import { Injectable, signal, computed, inject } from '@angular/core';
import { HistoryStoreService } from '@core/storage/stores/history-store.service';
import { MonthlyRecord } from '@core/domain/models';

export type { MonthlyRecord } from '@core/domain/models';

@Injectable({
  providedIn: 'root'
})
export class SavingsService {
  private historyStore = inject(HistoryStoreService);
  
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
    const data = this.historyStore.getData();
    const summary = data.savingsSummary;
    this.totalSavings.set(summary?.totalSavings ?? 0);
    this.history.set(data.savingsHistory ?? []);
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
    const data = this.historyStore.getData();
    const now = new Date().toISOString();
    const summary = data.savingsSummary ?? {
      totalSavings: 0,
      manualSavingsLog: 0,
      lastUpdated: now
    };

    this.historyStore.updateData({
      savingsHistory: this.history(),
      savingsSummary: {
        ...summary,
        totalSavings: this.totalSavings(),
        lastUpdated: now
      }
    });
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

