import { Component, inject, signal, effect, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BudgetStateService } from '@core/state/budget-state.service';
import { UserIncomeConfig } from '@core/domain/models';

@Component({
  selector: 'app-income-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="card income-card">
      <div class="card-header">
        <h3>💰 Income Setup</h3>
        <button class="icon-btn edit-btn" (click)="toggleEdit()" *ngIf="!isEditing()" title="Edit Income">
            <span class="icon">✏️</span> Edit
        </button>
      </div>

      <div *ngIf="!isEditing()" class="summary-view">
        <div class="summary-item main-stat">
          <span class="label">Monthly Income</span>
          <span class="value income-value">{{ incomeConfig().monthlyIncome | currency }}</span>
        </div>
        
        <div class="divider"></div>

        <div class="secondary-stats">
            <div class="summary-item">
            <span class="label">Work Schedule</span>
            <span class="value">{{ incomeConfig().workHoursPerMonth | number:'1.0-0' }}h / mo</span>
            </div>
            <div class="summary-item">
            <span class="label">Real Hourly Rate</span>
            <span class="value">{{ hourlyRate() | currency }}/hr</span>
            </div>
        </div>
      </div>

      <form [formGroup]="form" *ngIf="isEditing()" (ngSubmit)="save()" class="edit-form">
        <div class="form-group">
          <label>Monthly Net Income</label>
          <input type="number" formControlName="monthlyIncome" placeholder="e.g. 5000">
        </div>
        
        <div class="toggle-group">
            <label>Calculation Method:</label>
            <div class="toggles">
                <button type="button" [class.active]="calcMethod() === 'weekly'" (click)="setCalcMethod('weekly')">Weekly Schedule</button>
                <button type="button" [class.active]="calcMethod() === 'manual'" (click)="setCalcMethod('manual')">Manual Hours</button>
            </div>
        </div>

        @if (calcMethod() === 'weekly') {
            <div class="form-row">
                <div class="form-group">
                    <label>Hours/Day</label>
                    <input type="number" formControlName="hoursPerDay" placeholder="8">
                </div>
                <div class="form-group">
                    <label>Days/Week</label>
                    <input type="number" formControlName="daysPerWeek" placeholder="5">
                </div>
            </div>
            <div class="calc-preview">
                ≈ {{ calculateMonthlyHours() | number:'1.0-0' }} hours / month
            </div>
        } @else {
            <div class="form-group">
                <label>Work Hours / Month</label>
                <input type="number" formControlName="workHoursPerMonth" placeholder="e.g. 160">
                <small>Standard: 160h</small>
            </div>
        }

        <div class="actions">
          <button type="button" class="btn-cancel" (click)="cancel()">Cancel</button>
          <button type="submit" class="btn-save" [disabled]="form.invalid">Save Changes</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    @use '../../theme/variables' as v;
    @use '../../theme/mixins' as m;

    :host { display: block; }

    .income-card {
      @include m.card-style;
      border-top: 4px solid var(--primary-color);
      margin-bottom: 0 ;
      height: auto;
      display: flex;
      flex: 1;
      flex-direction: column;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-md);

      h3 {
        margin: 0;
        font-size: var(--font-size-lg);
        color: var(--text-primary);
        font-weight: var(--font-weight-bold);
      }
    }

    .edit-btn {
        background: none;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 4px 12px;
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s;

        &:hover {
            background: var(--bg-input);
            color: var(--primary-color);
            border-color: var(--primary-color);
        }
    }

    .summary-view {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      flex: 1;
      justify-content: center;
    }

    .summary-item {
      display: flex;
      justify-content: space-between;
      align-items: center;

      &.main-stat {
         flex-direction: column;
         align-items: flex-start;
         
         .value {
             font-size: 2rem;
             font-weight: 800;
             background: var(--primary-gradient);
             -webkit-background-clip: text;
             -webkit-text-fill-color: transparent;
         }
      }

      .label {
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
      }
      
      .value {
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    .divider {
        height: 1px;
        background: var(--border-color);
        margin: var(--spacing-xs) 0;
    }

    .secondary-stats {
        display: flex;
        justify-content: space-between;
        gap: var(--spacing-md);
        
        .summary-item {
            flex-direction: column;
            align-items: flex-start;
            
            .value { font-size: 1.1rem; }
        }
    }

    /* Form Styling */
    .edit-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .form-row {
        display: flex;
        gap: var(--spacing-md);
        
        .form-group { flex: 1; min-width: 0; }
    }
    
    .toggle-group {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .toggles {
            display: flex;
            background: v.$bg-input;
            padding: 4px;
            border-radius: var(--radius-sm);
            gap: 4px;

            button {
                flex: 1;
                border: none;
                background: transparent;
                padding: 6px;
                font-size: 0.8rem;
                opacity: 0.7;
                cursor: pointer;
                border-radius: var(--radius-sm);
                transition: all 0.2s;
                
                &.active {
                   background: var(--bg-surface); 
                   opacity: 1;
                   font-weight: 600;
                   color: var(--primary-color);
                   box-shadow: var(--shadow-sm);
                }
            }
        }
    }
    
    .calc-preview {
        font-size: 0.8rem;
        // Approximation of primary color tint if rgba fails
        background: #f3f0ff; 
        color: var(--primary-color);
        padding: 8px;
        border-radius: var(--radius-sm);
        text-align: center;
        font-weight: 600;
    }


    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;

      label {
        font-size: var(--font-size-sm);
        font-weight: 500;
        color: var(--text-secondary);
      }

      input {
        @include m.input-style;
      }
      
      small {
          color: var(--text-secondary);
          font-size: 0.75rem;
      }
    }

    .actions {
      display: flex;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-sm);

      button {
        flex: 1;
        padding: 10px;
        border-radius: var(--radius-md);
        font-weight: 600;
        cursor: pointer;
        border: none;
      }

      .btn-save {
        @include m.btn-primary;
      }

      .btn-cancel {
        background: transparent;
        border: 1px solid v.$border-color;
        color: v.$text-secondary;
        
        &:hover {
          background: v.$bg-input;
          color: v.$text-primary;
        }
      }
    }
  `],
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
