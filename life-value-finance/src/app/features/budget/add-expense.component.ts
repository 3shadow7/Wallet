import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { SingleSelectComponent } from '@shared/components/single-select/single-select.component';
import { BudgetStateService } from '@core/state/budget-state.service';
import { ExpenseItem } from '@core/domain/models';

@Component({
  selector: 'app-add-expense',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SingleSelectComponent],
  template: `
    <div class="add-expense-card">
      <h3>Add New Expense</h3>
      <div [formGroup]="expenseForm" class="add-form">
        <div class="form-row">
          
          <!-- Name Input -->
          <div class="input-group name-input">
            <label>Expense Name</label>
            <input type="text" [formControlName]="'name'" placeholder="e.g. Monthly Rent" autofocus>
          </div>
          
          <!-- Priority Select -->
          <div class="input-group prio-input">
            <label>Importance</label>
            <app-single-select
              [options]="priorityOptions"
              [value]="expenseForm.get('priority')?.value"
              (valueChange)="expenseForm.patchValue({priority: $event})"
              placeholder="Select Priority">
            </app-single-select>
          </div>
          
          <!-- Type Select -->
          <div class="input-group type-input">
            <label>Type</label>
            <app-single-select
              [options]="typeOptions"
              [value]="expenseForm.get('type')?.value"
              [variant]="'badge'"
              (valueChange)="expenseForm.patchValue({type: $event})"
              placeholder="Select Type">
            </app-single-select>
          </div>

          <!-- Amount Input -->
          <div class="input-group amt-input">
            <label>Cost ($)</label>
            <input type="number" [formControlName]="'amount'" placeholder="0.00" step="0.01">
          </div>

          <!-- Add Button -->
          <button type="submit" [disabled]="expenseForm.invalid" (click)="submitExpense()">
            Add Expense
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use '../../theme/variables' as v;
    @use '../../theme/mixins' as m;

    :host {
      display: block;
      width: 100%;
      position: relative; /* Ensure z-index works */
      z-index: 50; /* Higher than content below it */
    }
    
    // Ensure app-single-select behaves like a block input
    app-single-select {
        display: block;
        width: 100%;
    }

    .add-expense-card {
      @include m.card-style;
      
      z-index: 2;

      h3 {
        margin: 0 0 v.$spacing-md;
        color: v.$text-primary;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .add-form {
        display: flex;
        flex-direction: column;
        gap: v.$spacing-md;

        @media (min-width: 768px) {
          flex-direction: row;
          align-items: flex-end;
        }

        .form-row {
          display: contents; 
          
          @media (min-width: 768px) {
            display: flex;
            flex: 1;
            gap: v.$spacing-md;
            width: 100%;
          }
        }

        // Input Group Wrapper
        .input-group {
          display: flex;
          flex-direction: column;
          gap: v.$spacing-xs;
          flex: 1;

          &.name-input { flex: 2; }
          &.prio-input { flex: 1.5; }
          &.type-input { flex: 1.2; }
          &.amt-input { flex: 1; }

          label {
            font-size: 0.75rem;
            color: v.$text-secondary;
            font-weight: 500;
            margin-left: v.$spacing-xs;
          }
        }

        input {
          @include m.input-style;
        }

        select {
          @include m.select-style;
        }

        button {
          @include m.btn-primary;
          height: 46px; // Match input height roughly
          align-self: flex-end;
          min-width: 100px;
          
          &:disabled {
            background: v.$text-secondary;
            cursor: not-allowed;
            transform: none;
          }
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class AddExpenseComponent {

  private fb = inject(FormBuilder);
  private budgetState = inject(BudgetStateService);

  priorityOptions = ['Must Have', 'Need', 'Want', 'Emergency', 'Gift'];
  typeOptions = ['Variable','Fixed',  'Savings'];

  expenseForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    priority: [null, Validators.required],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    type: [null, Validators.required],
  });

  submitExpense() {
    if (this.expenseForm.valid) {
      const val = this.expenseForm.value;
      const amount = Number(val.amount);
      
      // Validation: Cannot add Savings if it exceeds remaining free money
      if (val.type === 'Savings') {
          const currentFreeMoney = this.budgetState.remainingIncome();
          if (amount > currentFreeMoney) {
              alert(`Cannot add savings of $${amount} because you only have $${currentFreeMoney.toFixed(2)} free money remaining.`);
              return;
          }
      }

      const newExpense: ExpenseItem = {
        id: crypto.randomUUID(),
        name: val.name,
        // category is optional now
        amount: amount,
        type: val.type,
        priority: val.priority
      };
      
      this.budgetState.addExpense(newExpense);
      
      this.expenseForm.reset({ 
        name: '',
        amount: null,
        type: null,
        priority: null
      });
    }
  }
}
