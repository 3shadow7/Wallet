import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackupService } from '../../core/services/backup.service';
import { AuthService } from '../../core/services/auth.service';
import { RouterLink } from '@angular/router';
import { AutoSyncService } from '../../core/services/auto-sync.service';
import { UserIncome } from '../../core/services/finance.service';
import { DeviceIdentityService } from '../../core/services/device-identity.service';

import { BudgetStateService } from '../../core/state/budget-state.service';
import { OfflineSyncService, SyncConflict } from '../../core/services/offline-sync.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private budgetState = inject(BudgetStateService);
  private backupService = inject(BackupService);
  public autoSyncService = inject(AutoSyncService);
  public authService = inject(AuthService);
  private offlineSync = inject(OfflineSyncService);
  private deviceIdentity = inject(DeviceIdentityService);

  statusMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  deviceId = '';

  pendingOps = [] as any[];
  conflicts: SyncConflict[] = [];

  ngOnInit(): void {
    this.refreshPending();
    this.refreshConflicts();
    try {
      this.deviceId = this.deviceIdentity.getDeviceId();
    } catch {
      this.deviceId = 'unknown';
    }
  }

  onSyncDetailsToggle(event: Event) {
    const details = event.target as HTMLDetailsElement;
    if (!details.open) {
      return;
    }

    this.refreshPending();
    this.refreshConflicts();
  }

  syncStatusLabel(): string {
    switch (this.autoSyncService.status()) {
      case 'syncing':
        return 'Syncing';
      case 'success':
        return 'Synced';
      case 'error':
        return 'Needs attention';
      default:
        return 'Ready';
    }
  }

  syncStateMessage(): string {
    if (!this.authService.isAuthenticated()) {
      return 'Sign in to start cloud backup.';
    }

    switch (this.autoSyncService.status()) {
      case 'syncing':
        return 'Saving your latest changes now.';
      case 'success':
        return 'Your cloud copy is up to date.';
      case 'error':
        return 'The app will try again automatically.';
      default:
        return 'Background sync is ready.';
    }
  }

  getAutoSyncErrorMessage(): string {
    const raw = (this.autoSyncService as any).lastError?.() ?? (this.autoSyncService as any).lastError;
    return this.formatError(raw) || 'Temporary sync issue. The app will retry automatically.';
  }

  private formatError(err: unknown): string | null {
    if (!err) return null;

    // If the service gave a simple string message
    if (typeof err === 'string') {
      // Common Angular HttpErrorResponse string contains 'Http failure response' and a URL
      if (/Http failure response/i.test(err) || /0 undefined/.test(err)) {
        return 'Unable to reach the backup service. Check your network or try again later.';
      }

      // Mask local URLs to avoid showing internal addresses
      try {
        return err.replace(/https?:\/\/localhost:\d+\/[^\s"']+/g, '[backup service]');
      } catch {
        return err;
      }
    }

    // If it's an object (likely HttpErrorResponse)
    if (typeof err === 'object' && err !== null) {
      const e = err as any;
      if ('status' in e && e.status === 0) {
        return 'Unable to reach the backup service. Check your network or try again later.';
      }
      if (e?.error?.detail) return String(e.error.detail);
      if (e?.message) {
        if (/Http failure response/i.test(String(e.message))) {
          return 'Unable to reach the backup service. Check your network or try again later.';
        }
        return String(e.message);
      }
    }

    return 'An unexpected error occurred.';
  }

  async refreshPending() {
    this.pendingOps = this.offlineSync.list();
  }

  async refreshConflicts() {
    this.conflicts = this.offlineSync.listConflicts();
  }

  private extractIncomePayload(value: unknown): UserIncome | null {
    if (!value || typeof value !== 'object' || !('income' in value)) {
      return null;
    }

    const candidate = (value as { income?: unknown }).income;
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    return candidate as UserIncome;
  }

  async flushQueue() {
    try {
      const queueSnapshot = this.offlineSync.list();
      const res = await this.offlineSync.flush();
      this.budgetState.applySyncFlushResults(queueSnapshot, res.mapping);
      await this.refreshPending();
      await this.refreshConflicts();
      if ((res.failed || []).length > 0) {
        this.setStatusMessage('error', 'Some operations failed to sync. Check console for details.');
      } else {
        this.setStatusMessage('success', 'Queued operations flushed successfully.');
      }
    } catch (e) {
      this.setStatusMessage('error', 'Failed to flush operations: ' + String(e));
    }
  }

  async resolveConflictUseCloud(conflict: SyncConflict) {
    if (conflict.resource !== 'income') return;
    try {
      const incomePayload = this.extractIncomePayload(conflict.serverPayload) || this.extractDirectIncomePayload(conflict.serverPayload);
      if (!incomePayload) {
        throw new Error('Missing cloud income payload');
      }
      this.budgetState.applyServerIncome(incomePayload);
      this.offlineSync.clearConflict(conflict.opId);
      await this.refreshConflicts();
    } catch (e) {
      this.setStatusMessage('error', 'Failed to apply cloud income: ' + String(e));
    }
  }

  private extractDirectIncomePayload(value: SyncConflict['serverPayload']): UserIncome | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const payload = value as Record<string, unknown>;
    if (!('monthly_income' in payload)) {
      return null;
    }

    return payload as unknown as UserIncome;
  }

  async resolveConflictOverwriteCloud(conflict: SyncConflict) {
    if (conflict.resource !== 'income') return;
    try {
      const payload = this.budgetState.getIncomeSyncPayload(conflict.serverUpdatedAt, true);
      const queueSnapshot = this.offlineSync.list();
      const opId = crypto.randomUUID();
      this.offlineSync.enqueue({ id: opId, type: 'update', payload, resource: 'income' });
      const res = await this.offlineSync.flush();
      this.budgetState.applySyncFlushResults([...queueSnapshot, { id: opId, type: 'update', payload, resource: 'income', clientId: undefined, createdAt: new Date().toISOString() }], res.mapping);
      this.offlineSync.clearConflict(conflict.opId);
      await this.refreshConflicts();
    } catch (e) {
      this.setStatusMessage('error', 'Failed to overwrite cloud income: ' + String(e));
    }
  }

  setStatusMessage(type: 'success' | 'error', text: string) {
    this.statusMessage.set({ type, text });
    // Clear after a short delay
    setTimeout(() => this.statusMessage.set(null), 6000);
  }

  getDeviceIdShort(): string {
    if (!this.deviceId) return 'unknown';
    return this.deviceId.slice(0, 8);
  }

  importStatus: 'idle' | 'success' | 'error' = 'idle';
  restoreStatus = signal<'idle' | 'restoring' | 'success' | 'error'>('idle');
  errorMessage = '';

  exportData() {
    this.budgetState.exportBackup();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.budgetState.importBackup(file)
        .then((success) => {
          if (success) {
            this.importStatus = 'success';
          } else {
            this.importStatus = 'idle';
          }
        })
        .catch(err => {
          this.importStatus = 'error';
          this.errorMessage = err.message || 'Failed to import data';
        });
    }
  }

  factoryReset() {
    const confirmed = window.confirm('ARE YOU SURE? This will permanently delete all your local budget data, history, and earnings settings. This action cannot be undone.');
    if (confirmed) {
      this.budgetState.resetAllData();
      alert('Application has been reset to factory defaults.');
    }
  }

  restoreFromCloud() {
    const confirmed = window.confirm('This will overwrite your current local data with your cloud backup. Continue?');
    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.restoreStatus.set('restoring');

    this.backupService.restoreFromBackend().subscribe({
      next: () => {
        this.restoreStatus.set('success');
        // Reload ensures all in-memory signals are rebuilt from restored local data.
        window.location.reload();
      },
      error: (err) => {
        this.restoreStatus.set('error');
        this.errorMessage = this.formatError(err) || (err?.error?.detail || err?.message) || 'Cloud restore failed.';
      }
    });
  }
}
