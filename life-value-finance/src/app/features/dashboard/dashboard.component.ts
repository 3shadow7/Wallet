import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BudgetStateService } from '@core/state/budget-state.service';
import { SavingsService } from '@core/services/savings.service';
import { BudgetTableComponent } from '../budget/budget-table.component';
import { ValueCalculatorComponent } from '../value-calculator/value-calculator.component';
import { IncomeInputComponent } from '../income/income-input.component';
import { AddExpenseComponent } from '@features/budget/add-expense.component';

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
