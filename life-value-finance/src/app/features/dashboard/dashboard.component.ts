import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BudgetStateService } from '@core/state/budget-state.service';
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

  totalIncome = this.budgetState.totalIncome;
  totalExpenses = this.budgetState.totalExpenses;
  remainingIncome = this.budgetState.remainingIncome;
}
