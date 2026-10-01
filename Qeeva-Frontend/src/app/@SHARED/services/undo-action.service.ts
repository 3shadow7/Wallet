import { Injectable, signal } from '@angular/core';

export type UndoAlertPosition = 'top' | 'bottom';

export interface UndoActionRequest {
  message: string;
  undo: () => void;
  durationMs?: number;
  showAlert?: boolean;
  position?: UndoAlertPosition;
}

export interface UndoActionState {
  message: string;
  remainingMs: number;
  durationMs: number;
  position: UndoAlertPosition;
}

interface PendingUndo extends UndoActionRequest {
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
  ticker: ReturnType<typeof setInterval>;
}

@Injectable({ providedIn: 'root' })
export class UndoActionService {
  private readonly defaultDurationMs = 6000;
  private pending: PendingUndo | null = null;
  readonly state = signal<UndoActionState | null>(null);

  start(request: UndoActionRequest): void {
    this.clearPending();

    if (request.showAlert === false) return;

    const durationMs = Math.max(1000, request.durationMs ?? this.defaultDurationMs);
    const expiresAt = Date.now() + durationMs;
    const pending: PendingUndo = {
      ...request,
      expiresAt,
      timer: setTimeout(() => this.expire(), durationMs),
      ticker: setInterval(() => this.publishRemaining(), 100)
    };

    this.pending = pending;
    this.publishRemaining();
  }

  undo(): void {
    const pending = this.pending;
    if (!pending) return;

    this.clearPending();
    pending.undo();
  }

  dismiss(): void {
    this.clearPending();
  }

  private publishRemaining(): void {
    if (!this.pending) return;

    const remainingMs = Math.max(0, this.pending.expiresAt - Date.now());
    this.state.set({
      message: this.pending.message,
      remainingMs,
      durationMs: this.pending.durationMs ?? this.defaultDurationMs,
      position: this.pending.position ?? 'bottom'
    });
  }

  private expire(): void {
    this.clearPending();
  }

  private clearPending(): void {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      clearInterval(this.pending.ticker);
      this.pending = null;
    }
    this.state.set(null);
  }
}
