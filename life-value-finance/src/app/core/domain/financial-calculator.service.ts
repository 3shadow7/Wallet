import { BudgetSummary, ExpenseItem, UserIncomeConfig, ValueAnalysis } from './models';

// ----------------------------------------------------------------------------
// FINANCIAL CALCULATOR SERVICE (Pure Logic, No Angular)
// ----------------------------------------------------------------------------

export class FinancialCalculatorService {

  /**
   * Calculates the remaining income after all expenses.
   */
  static calculateBudget(config: UserIncomeConfig, expenses: ExpenseItem[]): BudgetSummary {
    const totalExpenses = this.sumExpenses(expenses);
    const income = config.monthlyIncome || 0;
    const remaining = Math.max(0, income - totalExpenses);

    let hourlyRate = 0;
    if (config.isHourlyManual && config.hourlyRate) {
      hourlyRate = config.hourlyRate;
    } else if (config.workHoursPerMonth && config.workHoursPerMonth > 0) {
      hourlyRate = income / config.workHoursPerMonth;
    } else {
      // Fallback: assume standard 160h work month if nothing else provided
      hourlyRate = income > 0 ? income / 160 : 0;
    }

    return {
      totalIncome: income,
      totalExpenses: this.round(totalExpenses),
      remainingIncome: this.round(remaining),
      hourlyRate: this.round(hourlyRate),
      savingsRate: income > 0 ? this.round((remaining / income) * 100) : 0
    };
  }

  /**
   * Analyzes a potential purchase against the user's budget.
   */
  static analyzePurchase(price: number, remainingIncome: number, hourlyRate: number): ValueAnalysis {
    if (price < 0) price = 0;
    
    // Time Cost Calculation
    const effectiveHourly = hourlyRate > 0 ? hourlyRate : 1; // Prevent division by zero
    const hoursDecimal = price / effectiveHourly;
    const timeCostMinutes = Math.round(hoursDecimal * 60);

    // Impact Calculation
    let impactPercentage = 0;
    if (remainingIncome > 0) {
      impactPercentage = (price / remainingIncome) * 100;
    } else {
      impactPercentage = 100; // If no money left, it's 100% impact
    }

    let impactLevel: 'Low Impact' | 'Consider Carefully' | 'High Financial Impact';
    if (impactPercentage <= 5) impactLevel = 'Low Impact';
    else if (impactPercentage <= 20) impactLevel = 'Consider Carefully';
    else impactLevel = 'High Financial Impact';

    return {
      cost: price,
      timeCostMinutes: timeCostMinutes,
      timeCostFormatted: this.formatTimeCost(timeCostMinutes),
      financialImpactPercent: this.round(impactPercentage),
      impactLevel: impactLevel
    };
  }

  /**
   * Formats minutes into human-readable string based on requirements.
   * - < 1 hour -> minutes
   * - < 24 hours -> hours + minutes
   * - >= 24 hours -> days + hours (assumes 8h workday for life-energy context)
   */
  private static formatTimeCost(totalMinutes: number): string {
    if (totalMinutes === 0) return '0 minutes';

    const minutesInHour = 60;
    const hoursInWorkDay = 8; 

    // Rule 1: < 1 hour
    if (totalMinutes < minutesInHour) {
      return `${totalMinutes} minutes`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    // Rule 2: < 24 hours
    if (hours < 24) {
      return mins > 0 ? `${hours} hours ${mins} minutes` : `${hours} hours`;
    }

    // Rule 3: >= 24 hours
    const days = Math.floor(hours / hoursInWorkDay); 
    const remainingHours = hours % hoursInWorkDay;
    
    return remainingHours > 0 ? `${days} days ${remainingHours} hours` : `${days} days`;
  }

  private static sumExpenses(expenses: ExpenseItem[]): number {
    return expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  }

  private static round(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }
}
