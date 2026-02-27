import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api'; 

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

  // Placeholder for the upcoming Django backend sync
  syncWithBackend(): Observable<any> {
    if (!isPlatformBrowser(this.platformId)) return of(null);
    
    const localData: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.includes('token') && !key.includes('user')) {
          localData[key] = localStorage.getItem(key) || '';
        }
    }
    
    // Once the Django agent builds the backend, this will be a real POST
    // return this.http.post(`${this.apiUrl}/sync/`, { data: localData });
    console.log('Syncing data with cloud (Mock):', localData);
    return of({ status: 'success', message: 'Sync complete (Mock)' });
  }
}
