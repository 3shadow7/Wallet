import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BudgetStateService } from '@SERVICES/state/budget-state.service';
import { SavingsService } from '@SERVICES/savings.service';
import { BudgetTableComponent } from '@COMPONENTS/pages/dashboard/budget-table/budget-table.component';
import { ValueCalculatorComponent } from '@COMPONENTS/pages/dashboard/value-calculator/value-calculator.component';
import { IncomeInputComponent } from '@COMPONENTS/pages/dashboard/income-input/income-input.component';
import { AddExpenseComponent } from '@COMPONENTS/pages/dashboard/add-expense/add-expense.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BudgetTableComponent, ValueCalculatorComponent, IncomeInputComponent, AddExpenseComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class DashboardComponent {
  private budgetState = inject(BudgetStateService);
  private savingsService = inject(SavingsService);

  totalIncome = this.budgetState.totalIncome;
  totalExpenses = this.budgetState.totalExpenses;
  remainingIncome = this.budgetState.remainingIncome;
  freeMoneyDisplay = computed(() => Math.max(0, this.remainingIncome()));

  // Savings
  totalSavings = this.savingsService.totalSavingsSignal;
  lastSavingsTransfer = this.savingsService.lastMonthTransfer;

  addSavings(amountStr: string, input: HTMLInputElement) {
    const amount = parseFloat(amountStr);
    if (!isNaN(amount) && amount > 0) {
      this.budgetState.trackManualSavings(amount); // Use budget state tracker instead of direct savings service
      input.value = ''; // Clear input
    }
  }
}
