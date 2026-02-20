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

  // Savings Analysis
  savingsStatus = computed(() => {
    const list = this.expenses();
    const income = this.budgetState.incomeConfigSignal().monthlyIncome;
    
    const savingItems = list.filter(i => i.type === 'Saving');
    const plannedSavings = savingItems.reduce((sum, i) => sum + i.amount, 0);
    
    // Expenses that MUST be paid (Burning + Responsibility)
    // We treat everything NOT 'Saving' as mandatory for this calculation
    const mandatoryExpenses = list.filter(i => i.type !== 'Saving')
                              .reduce((sum, i) => sum + i.amount, 0);
    
    // Money left after mandatory expenses
    const availableForSavings = Math.max(0, income - mandatoryExpenses);
    
    const deficit = Math.max(0, plannedSavings - availableForSavings);
    
    return {
        hasDeficit: deficit > 0,
        deficitAmount: deficit,
        plannedSavings,
        availableForSavings,
        percentFunded: plannedSavings > 0 ? (availableForSavings / plannedSavings) * 100 : 100
    };
  });

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
    
    const success = this.updateItem(item, { amount: newAmount });
    if (!success) {
        input.value = String(item.amount);
    }
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

  /**
   * Updates an item with validation logic.
   * Returns true if update was successful/applied, false if blocked by validation.
   */
  private updateItem(item: ExpenseItem, changes: Partial<ExpenseItem>): boolean {
      // Logic from grid (amount/type checks)
      if (changes.type === 'Saving' || (item.type === 'Saving' && changes.amount !== undefined)) {
          const currentFreeMoney = this.budgetState.remainingIncome();
          const newAmount = changes.amount !== undefined ? changes.amount : item.amount;
          const oldAmount = item.amount;
          
          let diff = 0;
          if (changes.amount !== undefined) {
              diff = newAmount - oldAmount;
          } else if (changes.type === 'Saving' && item.type !== 'Saving') {
               // When switching TO Saving, we validate if we can afford the full amount?
               // Or if the amount stayed same, diff is 0?
               // Usually switching type doesn't change amount, so diff is effectively 0 relative to "total expenses".
               // BUT, "Saving" relies on "Free Money" (Income - Expenses).
               // Switching a normal expense to Saving doesn't change Total Expenses, so Free Money is same.
               // The validation logic is: "Do I have enough free money to allocate THIS amount to savings?"
               // If it was already an expense, it was already deducted from income to calculate free money?
               // Wait... Free Money = Income - Total Expenses (including Savings).
               // So if I have $1000 Income, $500 Expenses (inc $100 saving). Free Money = $500.
               // We ensure Free Money >= 0.
               // If I increase Savings by $100, Expenses becomes $600. Free Money becomes $400.
               // The validation: `currentFreeMoney - diff < 0` => `500 - 100 = 400`. Valid.
               
               // If I have $1000 Income, $1000 Expenses. Free Money = 0.
               // I increase Savings by $10. Expenses = $1010. Free Money = -10.
               // Validation: `0 - 10 = -10`. Invalid. Correct.
               
               // Case: Switch Type.
               // Expense $100 (Burning). Total Exp $100. Free Money $900.
               // Switch to Saving. Expense still $100. Total Exp $100. Free Money $900.
               // diff = 0. `900 - 0 = 900`. Valid.
               
               // So switching type generally is safe UNLESS the logic implies something else about "Free Money".
               // But let's keep the diff calculation simple.
               diff = (changes.amount ?? item.amount) - item.amount; 
          }

          if (changes.amount !== undefined || changes.type === 'Saving') {
             // Only validate amount changes or type switches to saving (though type switch diff is usually 0)
             if (currentFreeMoney - diff < 0) {
                alert(`Insufficient funds. Available: $${currentFreeMoney.toFixed(2)}`);
                return false; 
             }
          }
      }

      const updated = { ...item, ...changes };
      this.budgetState.updateExpense(item.id, updated);
      return true;
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
        
        let style = styleMap[val] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
        let warningHtml = '';
        let tooltip = '';

        // Check for Savings Deficit
        if (val === 'Saving' && this.savingsStatus().hasDeficit) {
             const percent = Math.floor(this.savingsStatus().percentFunded);
             // Change to warning style (similar to Burning/Danger to indicate risk)
             style = { bg: '#fee2e2', color: '#991b1b', border: '#ef4444' };
             warningHtml = `<span style="margin-right:4px;">⚠️</span>`;
             tooltip = `Partially Funded (Only ${percent}% available)`;
        }
        
        return `<span title="${tooltip}" style="
          background-color: ${style.bg};
          color: ${style.color};
          border: 1px solid ${style.border};
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          line-height: 1.2;
        ">${warningHtml}${val}</span>`;
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
