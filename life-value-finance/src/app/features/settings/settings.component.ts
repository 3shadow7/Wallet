import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackupService } from '../../core/services/backup.service';
import { AuthService } from '../../core/services/auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private backupService = inject(BackupService);
  public authService = inject(AuthService);
  
  importStatus: 'idle' | 'success' | 'error' = 'idle';
  syncStatus = signal<'idle' | 'syncing' | 'success' | 'error'>('idle');
  errorMessage = '';

  exportData() {
    this.backupService.exportData();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.backupService.importData(file)
        .then(() => {
          this.importStatus = 'success';
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        })
        .catch(err => {
          this.importStatus = 'error';
          this.errorMessage = err.message || 'Failed to import data';
        });
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
