import { Component, ChangeDetectionStrategy, ViewEncapsulation, inject, signal, HostListener, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  title = 'life-value-finance';
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private touchStartX = 0;
  private touchEndX = 0;
  private readonly SWIPE_THRESHOLD = 100; // pixels

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.touchStartX = event.changedTouches[0].screenX;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe() {
    // Only handle swipes on main routes, not login/register
    const currentUrl = this.router.url;
    if (currentUrl.includes('/login') || currentUrl.includes('/register')) return;

    const diff = this.touchEndX - this.touchStartX;
    if (Math.abs(diff) < this.SWIPE_THRESHOLD) return;

    const routes = ['/dashboard', '/history', '/settings'];
    const currentIndex = routes.indexOf(currentUrl);

    if (currentIndex === -1) return;

    if (diff > 0) {
      // Swipe Right -> Go Left (Previous)
      if (currentIndex > 0) {
        this.router.navigate([routes[currentIndex - 1]]);
        this.scrollToTop(); // Ensure we scroll to top when navigating via swipe
      }
    } else {
      // Swipe Left -> Go Right (Next)
      if (currentIndex < routes.length - 1) {
        this.router.navigate([routes[currentIndex + 1]]);
        this.scrollToTop(); // Ensure we scroll to top when navigating via swipe
      }
    }
  }

  
  scrollToTop() {
    setTimeout(() => {
      const body = document.querySelector('.header');
      if (body) {
        body.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    },100 );
  }

  showHeader(): boolean {
    const url = this.router.url;
    return !url.includes('/login') && !url.includes('/register');
  }
}
