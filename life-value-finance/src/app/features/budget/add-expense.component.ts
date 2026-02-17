import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { BudgetStateService } from '@core/state/budget-state.service';
import { ExpenseItem } from '@core/domain/models';

@Component({
  selector: 'app-add-expense',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="add-expense-card">
      <h3>Add New Expense</h3>
      <form [formGroup]="expenseForm" (ngSubmit)="submitExpense()" class="add-form">
        <div class="form-row">
          
          <!-- Name Input -->
          <div class="input-group name-input">
            <label>Expense Name</label>
            <input type="text" formControlName="name" placeholder="e.g. Monthly Rent" autofocus>
          </div>
          
          <!-- Priority Select -->
          <div class="input-group prio-input">
            <label>Importance</label>
            <select formControlName="priority">
              <option [ngValue]="null" disabled selected>Select...</option>
              <option value="High">High (Must Have)</option>
              <option value="Medium">Medium (Need)</option>
              <option value="Low">Low (Want)</option>
              <option value="Emergency">Emergency</option>
              <option value="Gift">Gift</option>
            </select>
          </div>
          
          <!-- Type Select -->
          <div class="input-group type-input">
            <label>Type</label>
            <select formControlName="type">
              <option [ngValue]="null" disabled selected>Select...</option>
              <option value="Variable">Variable</option>
              <option value="Fixed">Fixed</option>
            </select>
          </div>

          <!-- Amount Input -->
          <div class="input-group amt-input">
            <label>Cost ($)</label>
            <input type="number" formControlName="amount" placeholder="0.00" step="0.01">
          </div>

          <!-- Add Button -->
          <button type="submit" [disabled]="expenseForm.invalid">
            Add Expense
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    @use '../../theme/variables' as v;
    @use '../../theme/mixins' as m;

    :host {
      display: block;
      width: 100%;
    }

    .add-expense-card {
      @include m.card-style;
      
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

        input,
        select {
          @include m.input-style;
          width: 100%;
          height: 42px; // Consistent height
        }

        select {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 1rem center;
          background-size: 1em;
          padding-right: 2.5rem;
          cursor: pointer;
          
          &:invalid {
            color: v.$text-secondary;
          }

          option {
            color: v.$text-primary;
          }
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

  expenseForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    priority: [null, Validators.required],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    type: [null, Validators.required],
  });

  submitExpense() {
    if (this.expenseForm.valid) {
      const val = this.expenseForm.value;
      const newExpense: ExpenseItem = {
        id: crypto.randomUUID(),
        name: val.name,
        // category is optional now
        amount: Number(val.amount),
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
