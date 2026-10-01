import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoSwipeDirective } from '@SHARED/directives/no-swipe.directive';

export type SwipeActionTone = 'danger' | 'warning' | 'primary' | 'neutral';

export interface SwipeActionConfig {
  id: string;
  label: string;
  tone?: SwipeActionTone;
  undoDurationMs?: number;
}

@Component({
  selector: 'app-swipe-action-card',
  standalone: true,
  imports: [CommonModule, NoSwipeDirective],
  templateUrl: './swipe-action-card.component.html',
  styleUrl: './swipe-action-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SwipeActionCardComponent {
  @Input() leftAction: SwipeActionConfig | null = null;
  @Input() rightAction: SwipeActionConfig | null = null;
  @Input() threshold = 88;
  @Output() actionTriggered = new EventEmitter<SwipeActionConfig>();

  readonly offsetX = signal(0);
  readonly isDragging = signal(false);

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private horizontalGesture = false;

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this.isInteractiveTarget(event.target)) return;

    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.horizontalGesture = false;
    this.isDragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging() || event.pointerId !== this.pointerId) return;

    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;

    if (!this.horizontalGesture) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        this.resetGesture();
        return;
      }
      this.horizontalGesture = true;
    }

    event.preventDefault();
    const action = deltaX < 0 ? this.rightAction : this.leftAction;
    const limit = action ? 132 : 18;
    this.offsetX.set(Math.max(-limit, Math.min(limit, deltaX)));
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDragging() || event.pointerId !== this.pointerId) return;

    const action = this.getTriggeredAction();
    if (action) {
      this.actionTriggered.emit(action);
    }
    this.resetGesture();
  }

  onPointerCancel(): void {
    this.resetGesture();
  }

  actionOpacity(action: SwipeActionConfig | null): number {
    if (!action) return 0;
    const distance = action === this.leftAction ? this.offsetX() : -this.offsetX();
    return Math.min(1, Math.max(0, distance / this.threshold));
  }

  private getTriggeredAction(): SwipeActionConfig | null {
    const offset = this.offsetX();
    if (offset >= this.threshold) return this.leftAction;
    if (offset <= -this.threshold) return this.rightAction;
    return null;
  }

  private resetGesture(): void {
    this.pointerId = null;
    this.horizontalGesture = false;
    this.isDragging.set(false);
    this.offsetX.set(0);
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && !!target.closest('button, input, select, textarea, a, [contenteditable="true"]');
  }
}
