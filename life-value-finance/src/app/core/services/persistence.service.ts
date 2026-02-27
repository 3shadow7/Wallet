import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'life_value_finance_data';
const CURRENT_VERSION = 2; // Incremented for new settings

export interface AppStateData {
  version: number;
  incomes: any[];
  expenses: any[];
  incomeConfig: any;
  history: any[]; // New history array
  settings?: any; // New user settings
}

@Injectable({
  providedIn: 'root'
})
export class PersistenceService {
  private platformId = inject(PLATFORM_ID);

  exportState(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        alert('No data found to export');
        return;
    }

    const blob = new Blob([raw], { type: 'application/json' });
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
                if (!data.version || (!data.expenses && !data.incomeConfig)) {
                    throw new Error('Invalid backup file format');
                }

                localStorage.setItem(STORAGE_KEY, content);
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
