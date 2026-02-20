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
  templateUrl: './add-expense.component.html',
  styleUrl: './add-expense.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class AddExpenseComponent {

  private fb = inject(FormBuilder);
  private budgetState = inject(BudgetStateService);

  priorityOptions = ['Must Have', 'Want', 'Emergency', 'Gift'];
  typeOptions = ['Burning', 'Responsibility', 'Saving'];

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
      if (val.type === 'Saving') {
          const currentFreeMoney = this.budgetState.remainingIncome();
          if (amount > currentFreeMoney) {
              alert(`Cannot add to saving of $${amount} because you only have $${currentFreeMoney.toFixed(2)} free money remaining.`);
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
