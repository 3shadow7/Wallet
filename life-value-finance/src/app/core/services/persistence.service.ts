import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'life_value_finance_data';
const CURRENT_VERSION = 2; // Incremented for new settings

const STORAGE_KEY_SAVINGS = 'savingsStorage';
const STORAGE_KEY_HISTORY = 'monthlyHistory';

export interface AppStateData {
  version: number;
  incomes: any[];
  expenses: any[];
  incomeConfig: any;
  history: any[]; // New history array
  settings?: any; // New user settings
  savings?: {
    totalSavings: number;
    monthlyHistory: any[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class PersistenceService {
  private platformId = inject(PLATFORM_ID);

  // Return savings stored separately (kept for backward compatibility)
  getSavings(): { totalSavings: number; monthlyHistory: any[] } {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return { totalSavings: 0, monthlyHistory: [] };
    const savings = localStorage.getItem(STORAGE_KEY_SAVINGS);
    const history = localStorage.getItem(STORAGE_KEY_HISTORY);
    return {
      totalSavings: savings ? Number(savings) : 0,
      monthlyHistory: history ? JSON.parse(history) : []
    };
  }

  setSavings(totalSavings: number, monthlyHistory: any[]): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SAVINGS, totalSavings.toString());
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(monthlyHistory || []));
    } catch (e) {
      console.error('Failed to persist savings data', e);
    }
  }

  exportState(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    
    const raw = localStorage.getItem(STORAGE_KEY);
    const savings = localStorage.getItem(STORAGE_KEY_SAVINGS);
    const history = localStorage.getItem(STORAGE_KEY_HISTORY);

    let exportObj: any = {};
    if (raw) {
        exportObj = JSON.parse(raw);
    }

    if (savings || history) {
        exportObj.savings = {
            totalSavings: savings ? Number(savings) : 0,
            monthlyHistory: history ? JSON.parse(history) : []
        };
    }

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mywallet_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importState(file: File): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                
                // Basic validation
                if (!data.version && !data.savings) {
                    throw new Error('Invalid backup file format');
                }

                // Split data back into local storage keys
                if (data.savings) {
                    localStorage.setItem(STORAGE_KEY_SAVINGS, data.savings.totalSavings.toString());
                    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(data.savings.monthlyHistory));
                    // Cleanup from main object before saving to STORAGE_KEY
                    delete data.savings;
                }

                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                resolve(true);
            } catch (err) {
                console.error('Failed to import backup', err);
                alert('Invalid backup file. Please ensure it is a valid MyWallet JSON backup.');
                resolve(false);
            }
        };
        reader.readAsText(file);
    });
  }

  saveState(state: Partial<AppStateData>): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;

    try {
      const dataToSave = {
        version: CURRENT_VERSION,
        incomes: state.incomes || [],
        expenses: state.expenses || [],
        incomeConfig: state.incomeConfig || null,
        history: state.history || [],
        settings: state.settings || null
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  async loadState(): Promise<AppStateData | null> {
    if (!isPlatformBrowser(this.platformId)) return null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);
      
      // Simple migration check
      if (data.version !== CURRENT_VERSION) {
        console.warn('Data version mismatch');
      }

      return data;
    } catch (e) {
      console.error('Failed to parse localStorage data', e);
      return null;
    }
  }
}
