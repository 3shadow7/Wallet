import { Inject, Injectable, NgZone, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SingleSelectRegistryService {
  private activeId = signal<string | null>(null);
  private activeElement: HTMLElement | null = null;
  private listenerAttached = false;

  private zone = Inject(NgZone)

  isOpen(id: string): boolean {
    return this.activeId() === id;
  }

  open(id: string, hostElement: HTMLElement) {
    this.activeId.set(id);
    this.activeElement = hostElement;
    this.attachListener();
  }

  close(id: string) {
    if (this.activeId() === id) {
      this.activeId.set(null);
      this.activeElement = null;
    }
  }

  private attachListener() {
    if (this.listenerAttached) return;
    this.listenerAttached = true;

    // Runs outside Angular: zero CD cost until we actually need to close something
    this.zone.runOutsideAngular(() => {
      document.addEventListener('click', this.handleDocumentClick, true);
    });
  }

  private handleDocumentClick = (event: MouseEvent) => {
    if (!this.activeElement) return; // nothing open, ignore instantly

    if (!this.activeElement.contains(event.target as Node)) {
      // Re-enter Angular only when we actually mutate state
      this.zone.run(() => {
        this.activeId.set(null);
        this.activeElement = null;
      });
    }
  };
}
