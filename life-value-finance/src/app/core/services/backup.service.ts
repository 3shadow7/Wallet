import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CloudBackupResponse {
  data: Record<string, string>;
  revision: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl}/finance/backup`;
  private incomeApiUrl = `${environment.apiBaseUrl}/finance/income/`;

  exportData(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;

    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data[key] = localStorage.getItem(key) || '';
      }
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `life-value-finance-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importData(file: File): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') {
        reject('Not in browser environment');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          // Validate it's an object
          if (typeof data !== 'object' || data === null) {
            throw new Error('Invalid backup file format');
          }

          // Preserve sensitive auth keys if they exist in current localStorage
          const accessToken = localStorage.getItem('access_token');
          const user = localStorage.getItem('user');

          // Clear existing and restore
          localStorage.clear();

          // Restore from backup
          for (const key of Object.keys(data)) {
            localStorage.setItem(key, data[key]);
          }

          // Re-insert current auth keys if they were lost in the backup import
          // This prevents the user from being logged out during an import
          if (accessToken) localStorage.setItem('access_token', accessToken);
          if (user) localStorage.setItem('user', user);

          resolve(true);
        } catch (error) {
          console.error('Failed to import data', error);
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  // Pushes the current local non-auth data to the authenticated cloud backup endpoint.
  syncWithBackend(): Observable<CloudBackupResponse | null> {
    if (!isPlatformBrowser(this.platformId)) return of(null);

    const localData = this.getSyncPayloadFromLocalStorage();
    return this.http.put<CloudBackupResponse>(`${this.apiUrl}/`, { data: localData }).pipe(
      tap((payload) => {
        // Persist revision locally so future conflict handling can compare versions.
        if (payload?.revision) {
          localStorage.setItem('cloud_backup_revision', payload.revision);
        }
      })
    );
  }

  // Pulls backup from cloud and hydrates local browser storage for this session.
  restoreFromBackend(): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return of(false);
    }

    return this.http.get<CloudBackupResponse>(`${this.apiUrl}/`).pipe(
      switchMap((payload) => {
        const cloudData = payload?.data;
        if (!cloudData || typeof cloudData !== 'object') {
          throw new Error('Cloud backup data is missing or invalid.');
        }

        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');
        const user = localStorage.getItem('user');

        // Replace local app state with cloud snapshot while preserving auth session.
        localStorage.clear();
        for (const [key, value] of Object.entries(cloudData)) {
          localStorage.setItem(key, value ?? '');
        }

        if (accessToken) localStorage.setItem('access_token', accessToken);
        if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
        if (user) localStorage.setItem('user', user);
        if (payload.revision) localStorage.setItem('cloud_backup_revision', payload.revision);

        return this.syncRestoredIncomeToBackend(cloudData).pipe(map(() => true));
      })
    );
  }

  private syncRestoredIncomeToBackend(cloudData: Record<string, string>): Observable<void> {
    const rawAppState = cloudData['life_value_finance_data'];
    if (!rawAppState) return of(void 0);

    try {
      const appState = JSON.parse(rawAppState);
      const incomeConfig = appState?.incomeConfig;
      if (!incomeConfig || typeof incomeConfig !== 'object') {
        return of(void 0);
      }

      const payload = {
        monthly_income: Number(incomeConfig.monthlyIncome ?? 0),
        work_hours_per_month: Number(incomeConfig.workHoursPerMonth ?? 160),
        hourly_rate: Number(incomeConfig.hourlyRate ?? 0),
        is_hourly_manual: !!incomeConfig.isHourlyManual,
        calculation_method: incomeConfig.calculationMethod ?? 'weekly',
        hours_per_day: Number(incomeConfig.weeklyHoursDetails?.hoursPerDay ?? 8),
        days_per_week: Number(incomeConfig.weeklyHoursDetails?.daysPerWeek ?? 5)
      };

      return this.http.put(this.incomeApiUrl, payload).pipe(
        map(() => void 0),
        catchError((error) => {
          // Restore should still succeed even if income profile sync fails.
          console.warn('Cloud restore finished, but syncing restored income to backend failed.', error);
          return of(void 0);
        })
      );
    } catch (error) {
      console.warn('Unable to parse restored app state for income sync.', error);
      return of(void 0);
    }
  }

  // Collect only app data; never send auth/session artifacts to backup storage.
  private getSyncPayloadFromLocalStorage(): Record<string, string> {
    const excludedKeys = new Set(['access_token', 'refresh_token', 'user', 'cloud_backup_revision']);
    const localData: Record<string, string> = {};

    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || excludedKeys.has(key)) {
        continue;
      }
      localData[key] = localStorage.getItem(key) || '';
    }

    return localData;
  }
}
