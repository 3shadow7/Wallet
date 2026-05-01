import { Injectable, effect, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BackupService } from './backup.service';
import { AuthService } from './auth.service';
import { OfflineSyncService } from './offline-sync.service';
import { BudgetStateService } from '../state/budget-state.service';

@Injectable({
  providedIn: 'root'
})
export class AutoSyncService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly backupService = inject(BackupService);
  private readonly authService = inject(AuthService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly budgetState = inject(BudgetStateService);

  readonly status = signal<'idle' | 'syncing' | 'success' | 'error'>('idle');
  readonly lastSyncedAt = signal<string | null>(null);
  readonly lastError = signal<string>('');

  private isSyncing = false;
  private isFlushingQueue = false;
  private syncIntervalId: number | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.lastSyncedAt.set(this.backupService.getLastSyncedAtFromLocal());
    }

    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.stopAutoSync();
        this.status.set('idle');
        return;
      }

      this.startAutoSync();
      this.refreshCloudMetadata();
      this.triggerSync(false);
      this.flushQueueIfNeeded();
    });
  }

  triggerSync(force = false): void {
    if (!isPlatformBrowser(this.platformId) || this.isSyncing || !this.authService.isAuthenticated()) {
      return;
    }

    this.isSyncing = true;
    this.status.set('syncing');
    this.lastError.set('');

    this.backupService.syncWithBackend(force).subscribe({
      next: (payload) => {
        if (payload?.updated_at) {
          this.lastSyncedAt.set(payload.updated_at);
        }
        this.status.set('success');
        this.isSyncing = false;
      },
      error: (error) => {
        this.lastError.set(error?.error?.detail || error?.message || 'Auto sync failed');
        this.status.set('error');
        this.isSyncing = false;
        this.refreshCloudMetadata();
      }
    });
  }

  refreshCloudMetadata(): void {
    if (!isPlatformBrowser(this.platformId) || !this.authService.isAuthenticated()) {
      return;
    }

    this.backupService.fetchCloudMetadata().subscribe({
      next: (meta) => {
        if (meta?.updated_at) {
          this.lastSyncedAt.set(meta.updated_at);
        }
      },
      error: () => {
        // Silent fallback: keep local metadata if cloud metadata request fails.
      }
    });
  }

  private startAutoSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.syncIntervalId !== null) return;

    window.addEventListener('online', this.handleBrowserOnline);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Background auto-sync cadence for cross-device continuity.
    this.syncIntervalId = window.setInterval(() => {
      this.triggerSync(false);
      this.flushQueueIfNeeded();
    }, 60000);
  }

  private stopAutoSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }

    window.removeEventListener('online', this.handleBrowserOnline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleBrowserOnline = (): void => {
    this.triggerSync(false);
    this.refreshCloudMetadata();
    this.flushQueueIfNeeded();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.triggerSync(false);
      this.refreshCloudMetadata();
      this.flushQueueIfNeeded();
    }
  };

  private flushQueueIfNeeded(): void {
    if (!isPlatformBrowser(this.platformId) || this.isFlushingQueue || !this.authService.isAuthenticated()) {
      return;
    }

    const hasPendingQueue = this.offlineSync.list().length > 0;
    if (!hasPendingQueue) {
      return;
    }

    const queueSnapshot = this.offlineSync.list();
    this.isFlushingQueue = true;
    this.offlineSync.flush().then((result) => {
      this.budgetState.applySyncFlushResults(queueSnapshot, result.mapping);
      this.isFlushingQueue = false;
    }).catch((error) => {
      this.lastError.set(error?.message || 'Queue flush failed');
      this.isFlushingQueue = false;
    });
  }
}
