import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UndoActionService } from '@SHARED/services/undo-action.service';

@Component({
  selector: 'app-undo-action-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './undo-action-alert.component.html',
  styleUrl: './undo-action-alert.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UndoActionAlertComponent {
  readonly undoService = inject(UndoActionService);
  readonly state = this.undoService.state;

  undo(): void {
    this.undoService.undo();
  }

  dismiss(): void {
    this.undoService.dismiss();
  }

  secondsRemaining(): number {
    const state = this.state();
    return state ? Math.ceil(state.remainingMs / 1000) : 0;
  }

  progressPercent(): number {
    const state = this.state();
    if (!state || state.durationMs <= 0) return 0;
    return Math.max(0, Math.min(100, (state.remainingMs / state.durationMs) * 100));
  }
}
