import { Component, inject, Signal, ChangeDetectionStrategy, ViewEncapsulation, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { 
  ColDef, 
  GridOptions, 
  CellValueChangedEvent,
  ICellRendererParams,
  CellClickedEvent,
  ValueFormatterParams
} from 'ag-grid-community';
import { BudgetStateService } from '@core/state/budget-state.service';
import { ExpenseItem } from '@core/domain/models';
import { AddExpenseComponent } from './add-expense.component';

@Component({
  selector: 'app-budget-table',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular, AddExpenseComponent],
  templateUrl: './budget-table.component.html',
  styleUrl: './budget-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class BudgetTableComponent {
  private budgetState = inject(BudgetStateService);
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);
  
  isBrowser = isPlatformBrowser(this.platformId);
  
  // Signals
  expenses = this.budgetState.expensesSignal;
  totalExpenses = this.budgetState.totalExpenses;

  // Grid Config
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    editable: true,
    flex: 1,
    valueFormatter: (params: ValueFormatterParams) => {
      if (params.value === null || params.value === undefined || params.value === '') {
        return '--';
      }
      return params.value;
    }
  };

  colDefs: ColDef[] = [
    { 
      field: 'name', 
      headerName: 'Expense Name',
      flex: 2,
      editable: true,
      cellClass: 'expense-name'
    },
    // Category removed from grid as requested
    {
      field: 'priority',
      headerName: 'Importance',
      width: 120,
      flex: 0,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['High', 'Medium', 'Low', 'Emergency', 'Gift']
      },
      cellRenderer: (params: ICellRendererParams) => {
        const val = params.value;
        if (!val) return '--';
        const colorMap: Record<string, string> = {
            'High': '#ef4444',
            'Medium': '#f59e0b',
            'Low': '#10b981',
            'Emergency': '#7f1d1d',
            'Gift': '#8b5cf6'
        };
        const color = colorMap[val] || '#6b7280';
        return `<span style="color: ${color}; font-weight: 600;">${val}</span>`;
      }
    },
    { 
      field: 'type', 
      headerName: 'Type',
      width: 130,
      flex: 0,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Fixed', 'Variable']
      },
      cellRenderer: (params: ICellRendererParams) => {
        const type = params.value;
        const lowerType = type ? type.toLowerCase() : 'variable';
        return `<span class="type-badge ${lowerType}">${type}</span>`;
      }
    },
    { 
      field: 'amount', 
      headerName: 'Cost ($)', 
      type: 'numericColumn',
      width: 140,
      flex: 0,
      valueFormatter: (params: ValueFormatterParams) => {
        if (params.value === null || params.value === undefined || params.value === '') return '--';
        return `$${Number(params.value).toFixed(2)}`;
      },
      valueParser: (params) => Number(params.newValue),
      editable: true,
      cellStyle: { 'font-weight': '500' }
    },
    {
      headerName: '',
      field: 'id',
      editable: false,
      sortable: false,
      filter: false,
      width: 70,
      flex: 0,
      cellClass: 'action-cell',
      cellRenderer: (params: ICellRendererParams) => {
        return '<button class="delete-btn" data-action="delete" title="Delete">🗑️</button>';
      },
      cellStyle: { 'display': 'flex', 'justify-content': 'center', 'align-items': 'center' }
    }
  ];

  gridOptions: GridOptions = {
    theme: 'legacy',
    domLayout: 'autoHeight',
    rowSelection: 'single',
    animateRows: true, // Legacy, but supported
    stopEditingWhenCellsLoseFocus: true,
    suppressCellFocus: false 
  };

  onCellValueChanged(event: CellValueChangedEvent) {
    if (event.data) {
      const updatedExpense: ExpenseItem = event.data;
      // Ensure data types
      updatedExpense.amount = Number(updatedExpense.amount);
      this.budgetState.updateExpense(updatedExpense.id, updatedExpense);
    }
  }

  onCellClicked(event: CellClickedEvent) {
    const target = event.event?.target as HTMLElement;
    if (target && target.getAttribute('data-action') === 'delete') {
      if (confirm(`Delete expense "${event.data.name}"?`)) {
        this.budgetState.removeExpense(event.data.id);
      }
    }
  }

  startNewMonth() {
    if (confirm('Start a new month? This will:\n1. Archive current month to history\n2. Clear variable expenses\n3. Keep fixed expenses')) {
        this.budgetState.archiveAndResetMonth();
    }
  }
}
