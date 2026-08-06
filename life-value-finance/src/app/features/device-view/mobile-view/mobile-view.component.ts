import { Component, ElementRef, viewChild, effect, inject, computed, AfterViewInit } from '@angular/core';
import { DashboardComponent } from "@features/dashboard/dashboard.component";
import { SettingsComponent } from "@features/settings/settings.component";
import { HistoryComponent } from "@features/history/history.component";
import { MobileViewService } from '@core/services/mobile-view.service';

@Component({
  selector: 'app-mobile-view',
  imports: [DashboardComponent, SettingsComponent, HistoryComponent],
  templateUrl: './mobile-view.component.html',
  styleUrl: './mobile-view.component.scss',
})
export class MobileViewComponent implements AfterViewInit {
  private mobileViewService = inject(MobileViewService);
  private container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private ticking = false;
  private isUserScrolling = false;
  private scrollEndTimeout: ReturnType<typeof setTimeout> | undefined;


  activeIndex = this.mobileViewService.currentPageIndex;

  // Render current page + 1 neighbor on each side, so swiping still feels instant
  // (no blank flash while the adjacent section mounts mid-swipe)
  shouldRender = (pageIndex: number) =>
    computed(() => Math.abs(this.activeIndex() - pageIndex) <= 1);

  dashboardVisible = this.shouldRender(0);
  historyVisible = this.shouldRender(1);
  settingsVisible = this.shouldRender(2);

  constructor() {
    // Runs whenever the signal changes (e.g. header click) -> scroll to it
    effect(() => {
      const index = this.mobileViewService.currentPageIndex();
      if (this.isUserScrolling) return; // don't fight the user's own gesture
      this.scrollToIndex(index);
    });
  }

  ngAfterViewInit(): void {
    const el = this.container()?.nativeElement;
    if (el) {
      el.addEventListener('scroll', () => this.onScroll(el), { passive: true });
    }
  }

  private onScroll(el: HTMLDivElement): void {
    if (this.ticking) return;
    this.ticking = true;
    this.isUserScrolling = true;

    clearTimeout(this.scrollEndTimeout);
    this.scrollEndTimeout = setTimeout(() => {
      this.isUserScrolling = false; // gesture settled, programmatic nav can work again
    }, 150);

    requestAnimationFrame(() => {
      const index = Math.round(el.scrollLeft / el.clientWidth);
      this.mobileViewService.setPageIndex(index); // no-op if unchanged, no loop
      this.ticking = false;
    });
  }

  private scrollToIndex(index: number): void {
    const el = this.container()?.nativeElement;
    if (!el) return;
    const target = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 1) {
      el.scrollTo({ top: 0, left: target, behavior: 'instant' }); // Ensure vertical scroll is reset
    }
  }
}
