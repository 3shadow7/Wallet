import { Component, inject, Signal, signal, computed, ChangeDetectionStrategy, ViewEncapsulation, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ThemeService } from '@core/services/theme.service';
import { SingleSelectComponent } from '@shared/components/single-select/single-select.component';
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
  imports: [CommonModule, ReactiveFormsModule, FormsModule, AgGridAngular, SingleSelectComponent],
  templateUrl: './budget-table.component.html',
  styleUrl: './budget-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class BudgetTableComponent {
  private budgetState = inject(BudgetStateService);
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);
  public themeService = inject(ThemeService);
  
  isBrowser = isPlatformBrowser(this.platformId);
  
  // Signals
  expenses = this.budgetState.expensesSignal;
  totalExpenses = this.budgetState.totalExpenses;

  // Mobile Filters
  filterPriority = signal<string>('');
  filterType = signal<string>('');

  // Options for SingleSelect
  priorityOptions = ['Must Have', 'Need', 'Want', 'Emergency', 'Gift'];
  typeOptions = ['Burning', 'Responsibility', 'Saving'];

  filteredExpenses = computed(() => {
    const list = this.expenses();
    const currentPriority = this.filterPriority();
    const currentType = this.filterType();

    return list.filter(item => {
      const matchPriority = !currentPriority || currentPriority === 'All' || item.priority === currentPriority;
      const matchType = !currentType || currentType === 'All' || item.type === currentType;
      return matchPriority && matchType;
    });
  });

  onMobileAmountChange(item: ExpenseItem, event: Event) {
    const input = event.target as HTMLInputElement;
    const newAmount = Number(input.value);
    
    if (isNaN(newAmount) || newAmount < 0) {
        input.value = String(item.amount); // Reset
        return;
    }
    this.updateItem(item, { amount: newAmount });
  }

  onMobileNameChange(item: ExpenseItem, event: Event) {
      const input = event.target as HTMLInputElement;
      const newName = input.value.trim();
      if(!newName) {
          input.value = item.name;
          return;
      }
      this.updateItem(item, { name: newName });
  }

  updateItemPriority(item: ExpenseItem, newPriority: string) {
      if(item.priority === newPriority) return;
      this.updateItem(item, { priority: newPriority as any });
  }

  updateItemType(item: ExpenseItem, newType: string) {
      if(item.type === newType) return;
      this.updateItem(item, { type: newType as any });
  }

  private updateItem(item: ExpenseItem, changes: Partial<ExpenseItem>) {
      // Logic from grid (amount/type checks)
      if (changes.type === 'Saving' || (item.type === 'Saving' && changes.amount !== undefined)) {
          const currentFreeMoney = this.budgetState.remainingIncome();
          const newAmount = changes.amount !== undefined ? changes.amount : item.amount;
          const oldAmount = item.amount;
          
          let diff = 0;
          if (changes.amount !== undefined) {
              diff = newAmount - oldAmount;
          } else if (changes.type === 'Saving' && item.type !== 'Saving') {
              // Becomming a saving, so the cost is now "deducted" from free money? 
              // Actually saving IS an expense in this model (transfer to savings), 
              // so we check if we have enough income to cover it?
              // The logic in onCellValueChanged was:
              // if (updatedExpense.type === 'Saving') {
              //    const currentFreeMoney = this.budgetState.remainingIncome();
              //    ... 
              // }
              // Wait, removing a non-saving expense increases free money? No, all expenses reduce free money.
              // The check is likely ensure we don't over-allocate.
              // Let's rely on the simple check:
              // Free Money = Income - Expenses.
              // If we increase an expense, Free Money goes down.
               diff = (changes.amount ?? item.amount) - item.amount; // If only type changed, diff is 0? 
               // If type changed TO saving, it's still an expense.
               // It seems the implementation in onCellValueChanged implies checking if we have enough 
               // "Allocatable" money?
          }

          if (changes.amount !== undefined) {
             if (currentFreeMoney - diff < 0) {
                alert(`Insufficient funds. Available: $${currentFreeMoney.toFixed(2)}`);
                // Revert UI if needed (complex for inputs) is handled by state not updating
                return; 
             }
          }
      }

      const updated = { ...item, ...changes };
      this.budgetState.updateExpense(item.id, updated);
  }

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
      width: 140,
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
      headerName: 'Category', // More friendly header
      width: 140,
      flex: 0,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Burning', 'Responsibility', 'Saving']
      },
      cellRenderer: (params: ICellRendererParams) => {
        const val = params.value;
        if (!val || val === '--') return '';
        
        const styleMap: Record<string, {bg: string, color: string, border: string}> = {
            'Burning': { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }, // Red (Variable)
            'Responsibility': { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },    // Yellow/Orange (Fixed)
            'Saving': { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' }   // Green (Savings)
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
    // If 'Saving', ensure we have enough funds.
    if (updatedExpense.type === 'Saving') {
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

  deleteMobile(id: string, name: string) {
    if (confirm(`Delete "${name}"?`)) {
        this.budgetState.removeExpense(id);
    }
  }

  startNewMonth() {
    if (confirm('Start a new month? This will:\n1. Archive current month to history\n2. Clear variable expenses\n3. Keep fixed expenses')) {
        this.budgetState.archiveAndResetMonth();
    }
  }
}
