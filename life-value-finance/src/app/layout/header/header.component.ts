import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { MobileViewService } from '@core/services/mobile-view.service';
import { ViewportService } from '@core/viewPort/viewport.service';

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
  mobileViewService = inject(MobileViewService);
  viewportService = inject(ViewportService);

  constructor() {
    effect(() => {
      const currentType = this.viewportService.deviceType();
      if (this.router.url === '/m-View' && ['laptop', 'desktop', 'tv'].includes(currentType)) {
        switch (this.currentPageIndex()) {
          case 0:
            this.router.navigate(['/dashboard']);
            break;
          case 1:
            this.router.navigate(['/history']);
            break;
          case 2:
            this.router.navigate(['/settings']);
            break;
          default:
            this.router.navigate(['/dashboard']);
        }
      }else if (this.router.url !== '/m-View' && ['watch', 'mobile', 'tablet'].includes(currentType)) {
        switch (this.router.url) {
          case '/dashboard':
            this.mobileViewService.setPageIndex(0);
            break;
          case '/history':
            this.mobileViewService.setPageIndex(1);
            break;
          case '/settings':
            this.mobileViewService.setPageIndex(2);
            break;
          default:
            this.mobileViewService.setPageIndex(0);
        }
        this.router.navigate(['/m-View']);
      }
    });
  }

  currentPageIndex = this.mobileViewService.currentPageIndex; // just the signal, read it in template

  goToPage(index: number): void {
    this.mobileViewService.setPageIndex(index);
    // event.preventDefault(); // Prevent default link behavior
  }

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
