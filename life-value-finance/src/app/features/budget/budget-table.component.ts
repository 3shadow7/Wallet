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
  viewedMonth = this.budgetState.viewedMonthSignal;
  activeMonth = computed(() => this.budgetState.settingsSignal().lastActiveMonth);
  isCurrentMonth = computed(() => this.viewedMonth() === this.activeMonth());

  // Mobile Filters
  filterPriority = signal<string>('');
  filterType = signal<string>('');

  // Options for SingleSelect
  priorityOptions = ['Must Have', 'Want', 'Emergency', 'Gift'];
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

  onMobileQuantityChange(item: ExpenseItem, event: Event) {
    const input = event.target as HTMLInputElement;
    const newQty = Number(input.value);
    
    if (isNaN(newQty) || newQty < 1) {
        input.value = String(item.quantity || 1); // Reset
        return;
    }
    
    // We update item with new quantity. BudgetStateService handles Amount recalculation.
    // However, updateItem validation relies on 'amount' being correct.
    // We should pre-calculate the new amount for validation purposes.
    const projectedAmount = (item.unitPrice || item.amount) * newQty;
    
    // Pass both quantity and the projected amount for validation
    // The service will recalculate precise amount anyway, but validation uses this.
    const success = this.updateItem(item, { quantity: newQty, amount: projectedAmount });
    if (!success) {
        input.value = String(item.quantity || 1);
    }
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
                const deficit = Math.abs(currentFreeMoney - diff);
                const msg = `⚠️ Over Budget Warning\n\n` + 
                            `This change exceeds your available free money by $${deficit.toFixed(2)}.\n` + 
                            `You only have $${currentFreeMoney.toFixed(2)} available.\n\n` +
                            `If you proceed:\n` + 
                            `1. Your savings plan will be marked as "Partially Funded".\n` + 
                            `2. You will see a warning indicator.\n` + 
                            `3. This amount will be deducted from your total planned savings.\n\n` + 
                            `Do you want to proceed anyway?`;
                
                if (!confirm(msg)) {
                    return false; // User rejected
                }
                // User accepted, proceed (returns true at end)
             }
          }
      }

      const updated = { ...item, ...changes };
      this.budgetState.updateExpense(item.id, updated);
      return true;
  }

  // Toggle Ignore Status
  toggleIgnore(id: string, currentlyIgnored: boolean) {
      if (currentlyIgnored) {
          // Re-activating: Might trigger budget validation if it's a Saving item?
          // For now, simple toggle.
          this.budgetState.updateExpense(id, { isIgnored: false });
      } else {
          // Ignoring
          this.budgetState.updateExpense(id, { isIgnored: true });
      }
  }

  // Grid Config
  defaultColDef: ColDef = {
    sortable: true,
    filter: false,
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
        values: ['Must Have', 'Want', 'Emergency', 'Gift']
      },
      cellRenderer: (params: ICellRendererParams) => {
        const val = params.value;
        if (!val || val === '--') return '';
        const colorMap: Record<string, string> = {
            'Must Have': '#ef4444',     // High (Must Have - Red)
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
      cellStyle: { 'display': 'flex', 'align-items': 'center' },
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
             warningHtml = `<span>⚠️</span>`;
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
      field: 'quantity',
      headerName: 'Qty',
      type: 'numericColumn',
      width: 70,
      flex: 0,
      editable: true,
      valueParser: (params) => Number(params.newValue) || 1,
      cellStyle: { 'font-weight': '500' }
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
      width: 100, // Slightly wider for 2 buttons
      flex: 0,
      cellClass: 'action-cell',
      cellRenderer: (params: ICellRendererParams) => {
        const item = params.data;
        if (!item) return '';
        
        const canIgnore = item.type === 'Saving' || item.type === 'Responsibility';
        let ignoreBtn = '';
        
        if (canIgnore) {
            const isIgnored = item.isIgnored;
            // SVGs for visual clarity
            const eyeOpen = `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Z"/></svg>`;
            const eyeSlash = `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T702-576l-84-86q39-16 80-25t82-9q146 0 266 81.5T920-500q-26 65-67 117t-91 87ZM240-84l-52-52 116-116q-19-14-36.5-30.5T234-318q-72-46-126-107T40-500q54-137 174-218.5T480-800q77 0 148 23t135 65l65-64 52 52-640 640ZM480-200q-70 0-134-21.5T226-282q-13-10-25-21t-23-23q51 45 111 75.5T480-200Zm112-256-42-42q-3 6-4.5 12.5T544-474q-5-38-31-64t-65-30q-7 0-13 1.5t-13 4.5l-42-42q22-12 47-18t53-6q75 0 127.5 52.5T660-500q0 28-6 53t-18 47q-9-19-21-36.5T592-456Z"/></svg>`;
            
            // Logic: 
            // If Ignored (isIgnored=true) -> State is "Hidden". Action is "Show". Icon: Eye Slash (Grayed out)
            // If Active (isIgnored=false) -> State is "Visible". Action is "Hide". Icon: Eye Open (Normal)
            
            const icon = isIgnored ? eyeSlash : eyeOpen;
            const title = isIgnored ? 'Ignored (Click to Include)' : 'Active (Click to Ignore)';
            const activeClass = isIgnored ? 'ignored-btn' : 'active-btn';
            
            ignoreBtn = `<button class="action-btn toggle-ignore-btn ${activeClass}" data-action="toggle-ignore" title="${title}">
                           ${icon}
                         </button>`;
        }

        return `<div style="display: flex; gap: 8px; justify-content: flex-end;">
                  ${ignoreBtn}
                  <button class="action-btn delete-btn" data-action="delete" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                  </button>
                </div>`;
      },
      cellStyle: { 'display': 'flex', 'justify-content': 'flex-end', 'align-items': 'center', 'padding-right': '10px' }
    }
  ];

  // Grid Config
  // Use a getter or a method to ensure 'this' context is correct if needed,
  // but arrow function property should capture 'this'.
  // Grid Config
  gridOptions: GridOptions = {
    theme: 'legacy',
    domLayout: 'autoHeight',
    rowSelection: 'single',
    animateRows: true, // Legacy, but supported
    stopEditingWhenCellsLoseFocus: true,
    suppressCellFocus: false,
    // Add rowClassRules here for conditional styling
    rowClassRules: {
        'row-saving-deficit': (params) => {
            // Must use arrow function to access 'this'
            // Ignored items should NOT show deficit warning
            return params.data && !params.data.isIgnored && params.data.type === 'Saving' && this.savingsStatus().hasDeficit;
        },
        'row-ignored': (params) => params.data && params.data.isIgnored
    }
  };

  onCellValueChanged(event: CellValueChangedEvent) {
    const updatedExpense: ExpenseItem = event.data;
    if (!updatedExpense) return;

    // ... (rest of logic) ...
    // Update validation to check for ignore status
    // If ignored, skip validation? 
    // Usually user edits ACTIVE items. If ignored, editing amount should filter through updateItem anyway.
  
    const field = event.colDef.field;

    // Handle Quantity Change special logic
    if (field === 'quantity') {
        const qty = Number(updatedExpense.quantity) || 1;
        const unitPrice = updatedExpense.unitPrice || (updatedExpense.amount / (Number(event.oldValue) || 1));
        const newAmount = unitPrice * qty;
        
        // Update local object to reflect in UI immediately (if grid doesn't auto-refresh)
        updatedExpense.quantity = qty;
        updatedExpense.amount = newAmount;
        updatedExpense.unitPrice = unitPrice;
        
        // Update State
        this.budgetState.updateExpense(updatedExpense.id, { quantity: qty });
        
        // Force refresh of the 'amount' cell
        if (event.node) {
           event.api.refreshCells({ rowNodes: [event.node], columns: ['amount'] });
        }
        return;
    }
    
    // IMPORTANT: If item is IGNORED, we skip validation logic because it doesn't affect budget
    if (updatedExpense.isIgnored) {
        this.budgetState.updateExpense(updatedExpense.id, updatedExpense);
        return;
    }

    if (field === 'amount') {
         const newAmount = Number(updatedExpense.amount);
         const qty = updatedExpense.quantity || 1;
         // Recalculate Unit Price based on new Total
         const newUnitPrice = newAmount / qty;
         
         updatedExpense.unitPrice = newUnitPrice;
         // Proceed to validation...
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
             const deficit = Math.abs(currentFreeMoney - diff);
             const msg = `⚠️ Over Budget Warning\n\n` + 
                            `This change exceeds your available free money by $${deficit.toFixed(2)}.\n` + 
                            `You only have $${currentFreeMoney.toFixed(2)} available.\n\n` +
                            `If you proceed:\n` + 
                            `1. Your savings plan will be marked as "Partially Funded".\n` + 
                            `2. You will see a warning indicator.\n` + 
                            `3. This amount will be deducted from your total planned savings.\n\n` + 
                            `Do you want to proceed anyway?`;
            
            if (!confirm(msg)) {
                 // Revert changes in local object
                if (field === 'amount') updatedExpense.amount = Number(event.oldValue);
                if (field === 'type') updatedExpense.type = event.oldValue;

                // Force grid refresh to show reverted values
                event.api.applyTransaction({ update: [updatedExpense] });
                return;
            }
        }
    }

    this.budgetState.updateExpense(updatedExpense.id, updatedExpense);
  }

  onCellClicked(event: CellClickedEvent) {
    const target = event.event?.target as HTMLElement;
    const action = target?.getAttribute?.('data-action') || target?.parentElement?.getAttribute?.('data-action'); 
    
    if (action === 'delete') {
      if (confirm(`Delete expense "${event.data.name}"?`)) {
        this.budgetState.removeExpense(event.data.id);
      }
    } else if (action === 'toggle-ignore') {
        const item = event.data as ExpenseItem;
        this.toggleIgnore(item.id, !!item.isIgnored);
    }
  }

  deleteMobile(id: string, name: string) {
    if (confirm(`Delete "${name}"?`)) {
        this.budgetState.removeExpense(id);
    }
  }

  startNewMonth() {
    if (confirm('Start a new month? This will:\n1. Archive current month to history\n2. Advance date to next month\n3. Keep current expenses as template')) {
        this.budgetState.archiveAndResetMonth();
    }
  }

  isFutureMonth(): boolean {
      return this.budgetState.isFutureMonth();
  }

  canRevertMonth(): boolean {
      return this.budgetState.canRevertMonth();
  }

  async revertMonth() {
      if (this.canRevertMonth()) {
          if (confirm(`Are you sure you want to DELETE ${this.viewedMonth()} and revert to the previous month? This cannot be undone.`)) {
             this.budgetState.revertToPreviousMonth();
          }
      }
  }
  
  // Navigation
  prevMonth() {
      this.budgetState.viewPreviousMonth();
  }

  nextMonth() {
      this.budgetState.viewNextMonth();
  }
}
