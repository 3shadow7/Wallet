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
// import { AddExpenseComponent } from './add-expense.component';

@Component({
  selector: 'app-budget-table',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular],
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
        values: ['Must Have', 'Need', 'Want', 'Emergency', 'Gift']
      },
      cellRenderer: (params: ICellRendererParams) => {
        const val = params.value;
        if (!val || val === '--') return '';
        const colorMap: Record<string, string> = {
            'Must Have': '#ef4444',     // High (Must Have - Red)
            'Need': '#f59e0b',          // Medium (Need - Amber)
            'Want': '#10b981',          // Low (Want - Green)
            'Emergency': '#000000',     // Emergency (Black)
            'Gift': '#8b5cf6'           // Gift (Purple)
        };
        const color = colorMap[val] || '#6b7280';
        return `<div style="display: flex; align-items: center; gap: 8px;">
                  <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; display: inline-block;"></span>
                  <span>${val}</span>
                </div>`;
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
        values: [ 'Variable','Fixed', 'Savings']
      },
      cellRenderer: (params: ICellRendererParams) => {
        const val = params.value;
        if (!val || val === '--') return '';
        
        const styleMap: Record<string, {bg: string, color: string, border: string}> = {
            'Variable': { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }, // Red (was Blue)
            'Fixed': { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },    // Warning (was Red)
            'Savings': { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' }   // Green (was Purple)
        };
        
        const style = styleMap[val] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
        
        return `<span style="
          background-color: ${style.bg};
          color: ${style.color};
          border: 1px solid ${style.border};
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
          display: inline-block;
          line-height: 1.2;
        ">${val}</span>`;
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
    const updatedExpense: ExpenseItem = event.data;
    if (!updatedExpense) return;

    const field = event.colDef.field;
    if (field !== 'amount' && field !== 'type') {
        // Just update directly if not amount/type
        this.budgetState.updateExpense(updatedExpense.id, updatedExpense);
        return;
    }

    const newAmount = Number(updatedExpense.amount);
    updatedExpense.amount = newAmount; // Ensure number type

    // Logic: 
    // If 'Savings', ensure we have enough funds.
    if (updatedExpense.type === 'Savings') {
        const currentFreeMoney = this.budgetState.remainingIncome();
        
        let diff = 0;
        if (field === 'amount') {
            diff = newAmount - Number(event.oldValue || 0);
        }
        
        // Check if projected free money < 0
        if (currentFreeMoney - diff < 0) {
            alert(`Insufficient funds for this savings amount. You only have $${currentFreeMoney.toFixed(2)} available.`);
            
            // Revert changes in local object
            if (field === 'amount') updatedExpense.amount = Number(event.oldValue);
            if (field === 'type') updatedExpense.type = event.oldValue;

            // Force grid refresh to show reverted values
            event.api.applyTransaction({ update: [updatedExpense] });
            return;
        }
    }

    this.budgetState.updateExpense(updatedExpense.id, updatedExpense);
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
