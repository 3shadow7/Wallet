import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MobileViewService {
  readonly currentPageIndex = signal(0);

  setPageIndex(index: number): void {
    this.currentPageIndex.set(index);
  }
}
