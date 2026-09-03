import { Injectable, signal, effect, Inject, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ThemeStorageService, ThemePreference } from '@core/storage/stores/theme-storage.service';

export type Theme = ThemePreference;

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeStorage = inject(ThemeStorageService);

  // Signal to hold the current theme
  theme = signal<Theme>('system');

  // Computed or simple boolean for "is currently dark"
  isDark = signal<boolean>(false);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeTheme();
    }
  }

  private initializeTheme() {
    const savedTheme = this.themeStorage.getPreference();
    if (savedTheme) {
      this.theme.set(savedTheme);
    } else {
      this.theme.set('system');
    }

    this.applyTheme(this.theme());

    // Listen for system changes if mode is system
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (this.theme() === 'system') {
        this.applyTheme('system');
      }
    });

    // Effect to persist changes
    effect(() => {
        const t = this.theme();
        this.themeStorage.setPreference(t);
        try {
          if (t !== 'system') {
            // set a cookie so server-side rendering can read preferred theme
            // expires in 1 year
            document.cookie = `theme=${encodeURIComponent(t)}; Path=/; Max-Age=${60*60*24*365}; SameSite=Lax`;
          } else {
            // remove cookie
            document.cookie = 'theme=; Path=/; Max-Age=0; SameSite=Lax';
          }
        } catch (e) {
          // ignore cookie failures
        }
        this.applyTheme(t);
    });
  }

  setTheme(newTheme: Theme) {
    this.theme.set(newTheme);
  }

  toggleTheme() {
    // Simple toggle between light and dark for the button
    // If currently system, we toggle based on resolved value
    if (this.isDark()) {
        this.setTheme('light');
    } else {
        this.setTheme('dark');
    }
  }

  private applyTheme(theme: Theme) {
    if (!isPlatformBrowser(this.platformId)) return;

    const root = document.documentElement;
    let isDark = false;

    if (theme === 'dark') {
      isDark = true;
    } else if (theme === 'light') {
      isDark = false;
    } else {
      // System
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    this.isDark.set(isDark);

    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark'); // Optional, for Tailwind or specific CSS selectors
    } else {
      root.removeAttribute('data-theme');
      root.classList.remove('dark');
    }
  }
}
