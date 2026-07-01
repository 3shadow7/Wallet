import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackupService } from '../../core/services/backup.service';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

import { BudgetStateService } from '../../core/state/budget-state.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private budgetState = inject(BudgetStateService);
  private backupService = inject(BackupService);
  public authService = inject(AuthService);
  private router = inject(Router);

  importStatus: 'idle' | 'success' | 'error' = 'idle';
  syncStatus = signal<'idle' | 'syncing' | 'success' | 'error'>('idle');
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

  onRegisterClick() {
    // Navigate to the register page
    this.router.navigate(['/register'], {
      state: {
        URLSTATE_isActionFromUser: true // 👈 Sent ONLY on button click
      }
    });
  }

  onLoginClick() {
    // Navigate to the login page
    this.router.navigate(['/login'], {
      state: {
        URLSTATE_isActionFromUser: true // 👈 Sent ONLY on button click
      }
    });
  }

  factoryReset() {
    const confirmed = window.confirm('ARE YOU SURE? This will permanently delete all your local budget data, history, and earnings settings. This action cannot be undone.');
    if (confirmed) {
      this.budgetState.resetAllData();
      alert('Application has been reset to factory defaults.');
    }
  }

  syncWithCloud() {
    this.syncStatus.set('syncing');
    this.backupService.syncWithBackend().subscribe({
      next: () => {
        this.syncStatus.set('success');
        setTimeout(() => this.syncStatus.set('idle'), 3000);
      },
      error: (err) => {
        this.syncStatus.set('error');
        this.errorMessage = 'Cloud sync failed. Use manual backup.';
      }
    });
  }
}
