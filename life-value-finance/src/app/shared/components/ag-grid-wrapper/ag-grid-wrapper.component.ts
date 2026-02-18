import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, Inject, PLATFORM_ID, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridOptions } from 'ag-grid-community';

@Component({
  selector: 'app-ag-grid-wrapper',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './ag-grid-wrapper.component.html',
  styleUrl: './ag-grid-wrapper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class AgGridWrapperComponent {
  isBrowser: boolean;

  @Input() class: string = '';
  @Input() rowData: any[] = [];
  @Input() columnDefs: ColDef[] = [];
  @Input() defaultColDef: ColDef = {};
  @Input() gridOptions: GridOptions = {};
  @Input() theme: string = 'legacy';
  @Input() domLayout: 'normal' | 'autoHeight' | 'print' = 'normal';

  @Output() gridReady = new EventEmitter<any>();
  @Output() cellValueChanged = new EventEmitter<any>();
  @Output() cellClicked = new EventEmitter<any>();

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  onGridReady(event: any) {
    this.gridReady.emit(event);
  }

  onCellValueChanged(event: any) {
    this.cellValueChanged.emit(event);
  }

  onCellClicked(event: any) {
    this.cellClicked.emit(event);
  }
}
