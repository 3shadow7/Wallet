import { Component, ChangeDetectionStrategy, ViewEncapsulation, inject, signal, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
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
export class AppComponent implements OnInit, OnDestroy {
  title = 'life-value-finance';
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private touchStartX = 0;
  private touchEndX = 0;
  private touchStartY = 0;
  private touchEndY = 0;
  private readonly SWIPE_THRESHOLD = 100; // pixels
  private swipeDisabled = false;

  // We add capture-phase listeners on the document so we see touch events
  // before any child components or third-party sliders stop propagation.
  private onDocumentTouchStart = (event: TouchEvent) => {
    if (!isPlatformBrowser(this.platformId)) return;
    const touch = event.changedTouches[0];
    this.touchStartX = touch.screenX;
    this.touchStartY = touch.screenY;

    const target = event.target as Element | null;
    if (target) {
      // Prefer checking the composed path to reliably detect elements inside
      // shadow DOM or complex slider components. If any element in the path
      // is marked with our directive (sets __noSwipe or data-no-swipe),
      // disable swipe handling for this gesture.
      const path = (event as any).composedPath ? (event as any).composedPath() : undefined;
      if (Array.isArray(path)) {
        for (const p of path) {
          if (p && typeof p === 'object') {
            try {
              if ((p as any).__noSwipe === true) {
                this.swipeDisabled = true;
                return;
              }
              if (p instanceof Element && p.hasAttribute && p.hasAttribute('data-no-swipe')) {
                this.swipeDisabled = true;
                return;
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }

      // Fallback: check common selectors on the target's ancestors
      const NO_SWIPE_SELECTORS = [
        'input',
        'textarea',
        'select',
        '[contenteditable]',
        '.no-swipe',
        '.slider',
        '.slider-container',
        '.swiper-container',
        '.carousel',
        '.ag-root',
        '.mat-slider',
        '[data-no-swipe]'
      ];
      for (const sel of NO_SWIPE_SELECTORS) {
        try {
          if ((target as Element).closest(sel)) {
            this.swipeDisabled = true;
            return;
          }
        } catch (e) {
          // ignore invalid selectors
        }
      }
    }
    this.swipeDisabled = false;
  };

  private onDocumentTouchEnd = (event: TouchEvent) => {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.swipeDisabled) {
      this.swipeDisabled = false;
      return;
    }
    const touch = event.changedTouches[0];
    this.touchEndX = touch.screenX;
    this.touchEndY = touch.screenY;
    this.handleSwipe();
  };

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.addEventListener('touchstart', this.onDocumentTouchStart, { passive: true, capture: true } as EventListenerOptions);
      document.addEventListener('touchend', this.onDocumentTouchEnd, { passive: true, capture: true } as EventListenerOptions);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('touchstart', this.onDocumentTouchStart, { capture: true } as EventListenerOptions);
      document.removeEventListener('touchend', this.onDocumentTouchEnd, { capture: true } as EventListenerOptions);
    }
  }

  private handleSwipe() {
    // Only handle swipes on main routes, not login/register
    const currentUrl = this.router.url;
    if (currentUrl.includes('/login') || currentUrl.includes('/register')) return;

    const diffX = this.touchEndX - this.touchStartX;
    const diffY = this.touchEndY - this.touchStartY;

    // Ignore mostly-vertical gestures (scrolls) to avoid accidental navigation
    if (Math.abs(diffY) > Math.abs(diffX)) return;

    if (Math.abs(diffX) < this.SWIPE_THRESHOLD) return;

    const routes = ['/dashboard', '/history', '/settings'];
    const currentIndex = routes.indexOf(currentUrl);

    if (currentIndex === -1) return;

    if (diffX > 0) {
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
