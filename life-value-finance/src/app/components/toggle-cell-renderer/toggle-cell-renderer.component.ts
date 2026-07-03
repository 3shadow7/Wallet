import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-toggle-cell-renderer',
  standalone: true,
  imports: [],
  template: `
    <div class="custom-toggle">
      <label class="toggle-switch-wrapper">
        <input
          type="checkbox"
          class="toggle-input"
          [checked]="!params.data.excludedFromTotals"
          (change)="onToggle()">

        <div class="toggle-track" [attr.data-on]="'Count'" [attr.data-off]="'Ignore'">
          <div class="toggle-knob"></div>
        </div>
      </label>
    </div>
  `,
  styleUrls: ['./toggle-cell-renderer.component.scss']
})
export class ToggleCellRendererComponent implements ICellRendererAngularComp {
  params!: ICellRendererParams;

  agInit(params: ICellRendererParams): void {
    this.params = params;
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    return true;
  }

  onToggle(): void {
    // call back into your parent component's handler
    this.params.context.componentParent.toggleHistoryMonthExcluded(this.params.data.month);
  }
}
