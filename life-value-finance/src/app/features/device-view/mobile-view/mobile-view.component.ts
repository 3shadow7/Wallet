import { Component, ElementRef, viewChild, effect, inject, AfterViewInit } from '@angular/core';
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

  constructor() {
    // Runs whenever the signal changes (e.g. header click) -> scroll to it
    effect(() => {
      const index = this.mobileViewService.currentPageIndex();
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
    console.log('onScroll called');
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      const index = Math.round(el.scrollLeft / el.clientWidth);
      console.log('onScroll: calculated index:', index);
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
