import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation, computed } from '@angular/core';
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

  priorityOptions = ['Must', 'Want', 'Emergency', 'Gift'];
  typeOptions = ['Burn', 'Tax', 'Saving'];

  viewedMonth = this.budgetState.viewedMonthSignal;

  expenseForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    priority: [null, Validators.required],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    type: [null, Validators.required],
    // Long-term saving goal; only meaningful when type === 'Saving'.
    // Matches ExpenseItem.targetTotal in @core/domain/models.
    targetTotal: [null],
  });

  // Keeps the targetTotal field required only while Type = Saving,
  // and clears any stale value/error when the user switches away from it.
  onTypeChange(type: string) {
    this.expenseForm.patchValue({ type });

    const goalControl = this.expenseForm.get('targetTotal');
    if (!goalControl) return;

    if (type === 'Saving') {
      goalControl.setValidators([Validators.required, Validators.min(0.01)]);
    } else {
      goalControl.clearValidators();
      goalControl.setValue(null);
    }
    goalControl.updateValueAndValidity();
  }

  submitExpense() {
    if (this.expenseForm.valid) {
      const val = this.expenseForm.value;
      const amount = Number(val.amount);

        if (val.type === 'Saving') {
          const currentFreeMoney = this.budgetState.remainingIncome();
          if (currentFreeMoney - amount < 0) {
            const deficit = Math.abs(currentFreeMoney - amount);
            const msg = `⚠️ Savings Overcommitted\n\n` +
                  `This saving item exceeds your available free money by $${deficit.toFixed(2)}.\n` +
                  `You have $${currentFreeMoney.toFixed(2)} available right now.\n\n` +
                  `You can still add it and adjust which saving items are reduced later.`;
            if (!confirm(msg)) {
              return;
            }
          }
        }

      const newExpense: ExpenseItem = {
        id: crypto.randomUUID(),
        name: val.name,
        // category is optional now
        amount: amount,
        unitPrice: amount, // Default for single item
        quantity: 1,       // Default for single item
        type: val.type,
        priority: val.priority,
        // Long-term target for Saving-type items; undefined for all other types
        targetTotal: val.type === 'Saving' ? Number(val.targetTotal) : undefined,
      };

      this.budgetState.addExpense(newExpense);

      this.expenseForm.reset({
        name: '',
        amount: null,
        type: null,
        priority: null,
        targetTotal: null,
      });
    }
  }
}
