import { Component, computed, inject, signal, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinancialCalculatorService } from '@core/domain/financial-calculator.service';
import { BudgetStateService } from '@core/state/budget-state.service';
import { NumericInputDirective } from '@shared/numeric-input.directive';
import { ValueAnalysis } from '@core/domain/models';

@Component({
  selector: 'app-value-calculator',
  standalone: true,
  imports: [CommonModule, NumericInputDirective],
  templateUrl: './value-calculator.component.html',
  styleUrl: './value-calculator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class ValueCalculatorComponent {
  private budgetState = inject(BudgetStateService);

  // Inputs
  productPrice = signal<number | null>(null);

  // Context from State
  monthlyIncome = this.budgetState.incomeConfigSignal; // Not used directly, but state is source
  remainingIncome = this.budgetState.remainingIncome;
  hourlyRate = this.budgetState.hourlyRate; // Calculated in service

  // Analysis Result
  analysis = computed<ValueAnalysis>(() => {
    return FinancialCalculatorService.analyzePurchase(
      this.productPrice(),
      this.remainingIncome(),
      this.hourlyRate()
    );
  });

  // Derived UI Helpers
  painEmoji = computed(() => {
    switch (this.analysis().impactLevel) {
      case 'Low Impact': return '😌';
      case 'Consider Carefully': return '🤨';
      case 'High Financial Impact': return '😱';
      default: return '😐';
    }
  });

  // UI Helper
  get painClass() {
    switch (this.analysis().impactLevel) {
      case 'Low Impact': return 'low';
      case 'Consider Carefully': return 'medium';
      case 'High Financial Impact': return 'high';
      default: return '';
    }
  }

  onPriceChange(event: Event) {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.productPrice.set(isNaN(val) ? null : val);
    this.scrollToBottom(); // Ensure results are visible on mobile when keyboard is open
  }

  scrollToBottom() {
    setTimeout(() => {
      const resultsCard = document.querySelector('.results-card');
      if (resultsCard) {
        resultsCard.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    },100 );
  }

}
