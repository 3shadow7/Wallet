export interface MonthlyIncome {
  id: string;
  source: string;
  amount: number;
  isRecurring: boolean;
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly';
}

export interface UserSettings {
  timezone: string;
  lastActiveMonth: string; // "YYYY-MM"
}

export interface UserIncomeConfig {
  monthlyIncome: number;
  workHoursPerMonth?: number;
  hourlyRate?: number; // Optional override, otherwise calculated
  isHourlyManual: boolean;

  // Persistence for user preference
  calculationMethod?: 'weekly' | 'manual';
  weeklyHoursDetails?: {
      hoursPerDay: number;
      daysPerWeek: number;
  };
}

export type PriorityLevel = 'Must' | 'Want' | 'Emergency' | 'Gift';

export interface ExpenseItem {
  id: string;
  category?: string;
  name: string;
  amount: number; // Total Cost (Unit Price * Quantity)
  unitPrice: number; // Base cost for one item
  quantity: number; // Default 1
  isIgnored?: boolean; // If true, excluded from calculations for this month
  type: 'Burn' | 'Tax' | 'Saving';
  priority: PriorityLevel;
  targetTotal?: number; // Optional long-term saving goal (for Saving items)
  isReducible?: boolean; // Saving items can be reduced when shortfall occurs
}

export interface BudgetHistory {
  month: string; // YYYY-MM
  date: string; // ISO Date
  incomeConfig: UserIncomeConfig;
  expenses: ExpenseItem[];
  summary: BudgetSummary;
  excludedFromTotals?: boolean;
}

export interface BudgetSummary {
  totalIncome: number;
  plannedOutflow: number; // Burn + Tax + Saving
  freeMoney: number; // Income - Planned Outflow (can be negative)
  realExpenses: number; // Burn + Tax
  savingsBalance: number; // Income - Real Expenses (can be negative)
  actualSavedTotal: number; // max(0, savingsBalance)
  overspend: number; // max(0, realExpenses - income)
  savingShortfall: number; // max(0, plannedSavings - actualSavedTotal)
  hourlyRate: number; // The effective hourly rate used
  savingsRate: number;
}

export interface MonthlyRecord {
  month: string; // YYYY-MM
  income: number;
  expenses: number; // Planned outflow (Burn + Tax + Saving)
  realExpenses?: number; // Burn + Tax
  freeMoney: number; // Income - Planned Outflow
  transferredToSavings: number;
  plannedSavings: number; // The goal (sum of 'Saving' items)
  savingsImpact: number;  // The deficit (if any) caused by overspending
  manualAdded?: number; // New field for direct additions
  savingsTotalAfterTransfer: number;
  date: string; // ISO date of closing
  excludedFromTotals?: boolean;
}

export interface ValueAnalysis {
  cost: number;
  timeCostMinutes: number;
  timeCostFormatted: string; // "2d 4h"
  financialImpactPercent: number;
  impactLevel: 'Low Impact' | 'Consider Carefully' | 'High Financial Impact';
}
