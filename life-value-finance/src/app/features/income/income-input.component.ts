import { Component, inject, signal, effect, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BudgetStateService } from '@core/state/budget-state.service';
import { UserIncomeConfig } from '@core/domain/models';

@Component({
  selector: 'app-income-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './income-input.component.html',
  styleUrl: './income-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class IncomeInputComponent {
  private fb = inject(FormBuilder);
  private budgetState = inject(BudgetStateService);

  incomeConfig = this.budgetState.incomeConfigSignal;
  hourlyRate = this.budgetState.hourlyRate;
  
  isEditing = signal(false);
  calcMethod = signal<'weekly' | 'manual'>('weekly');

  form = this.fb.group({
    monthlyIncome: [0, [Validators.required, Validators.min(0)]],
    workHoursPerMonth: [160, [Validators.required, Validators.min(1)]],
    hoursPerDay: [8, [Validators.min(0), Validators.max(24)]],
    daysPerWeek: [5, [Validators.min(0), Validators.max(7)]],
    hourlyRate: [0], // Optional
    isHourlyManual: [false]
  });

  constructor() {
    // Sync form with state when not editing
    effect(() => {
      const config = this.incomeConfig();
      if (!this.isEditing()) {
          this.form.patchValue({
            monthlyIncome: config.monthlyIncome,
            workHoursPerMonth: config.workHoursPerMonth || 160,
            hoursPerDay: config.weeklyHoursDetails?.hoursPerDay || 8,
            daysPerWeek: config.weeklyHoursDetails?.daysPerWeek || 5,
          }, { emitEvent: false });
          
          if (config.calculationMethod) {
              this.calcMethod.set(config.calculationMethod);
          }
      }
    });

    effect(() => {
        if (this.incomeConfig().monthlyIncome === 0 && !this.isEditing()) {
            this.isEditing.set(true);
        }
    });
  }

  setCalcMethod(method: 'weekly' | 'manual') {
      this.calcMethod.set(method);
  }

  calculateMonthlyHours(): number {
      const { hoursPerDay, daysPerWeek } = this.form.value;
      const h = hoursPerDay || 0;
      const d = daysPerWeek || 0;
      // Using 4 weeks per month standard for simplicity/mental model alignment
      return Math.round((h * d) * 4); 
  }

  toggleEdit() {
    const config = this.incomeConfig();
    this.form.patchValue({
        monthlyIncome: config.monthlyIncome,
        workHoursPerMonth: config.workHoursPerMonth
    });
    this.isEditing.set(true);
  }

  cancel() {
    if (this.incomeConfig().monthlyIncome > 0) {
        this.isEditing.set(false);
    }
  }

  save() {
    if (this.form.valid) {
      const val = this.form.value;
      const hoursPerDay = val.hoursPerDay || 0;
      const daysPerWeek = val.daysPerWeek || 0;

      let finalHours = val.workHoursPerMonth || 160;

      if (this.calcMethod() === 'weekly') {
          // Recalculate ensuring 4-week logic is applied consistently
          finalHours = Math.round((hoursPerDay * daysPerWeek) * 4);
      }

      this.budgetState.updateIncomeConfig({
        monthlyIncome: val.monthlyIncome || 0,
        workHoursPerMonth: finalHours,
        isHourlyManual: false,
        calculationMethod: this.calcMethod(),
        weeklyHoursDetails: {
            hoursPerDay,
            daysPerWeek
        }
      });
      this.isEditing.set(false);
    }
  }
}
