import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  themeService = inject(ThemeService);
  authService = inject(AuthService);
  router = inject(Router);

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  onLoginClick() {
    // Navigate to the login page
    this.router.navigate(['/login'], {
      state: {
        URLSTATE_isActionFromUser: true // 👈 Sent ONLY on button click
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}
