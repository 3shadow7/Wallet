import { Directive, ElementRef, OnDestroy } from '@angular/core';

@Directive({
  selector: '[noSwipe]',
  standalone: true
})
export class NoSwipeDirective implements OnDestroy {
  private host: HTMLElement;

  constructor(el: ElementRef<HTMLElement>) {
    this.host = el.nativeElement;
    // Mark the element so capture-phase listeners can detect it reliably
    (this.host as any).__noSwipe = true;
    this.host.setAttribute('data-no-swipe', 'true');
  }

  ngOnDestroy(): void {
    try {
      delete (this.host as any).__noSwipe;
      this.host.removeAttribute('data-no-swipe');
    } catch (e) {
      // ignore
    }
  }
}
