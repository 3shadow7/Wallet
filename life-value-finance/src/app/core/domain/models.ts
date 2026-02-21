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

export type PriorityLevel = 'Must Have' | 'Want' | 'Emergency' | 'Gift';

export interface ExpenseItem {
  id: string;
  category?: string;
  name: string;
  amount: number; // Total Cost (Unit Price * Quantity)
  unitPrice: number; // Base cost for one item
  quantity: number; // Default 1
  isIgnored?: boolean; // If true, excluded from calculations for this month
  type: 'Responsibility' | 'Burning' | 'Saving'; // Updated per user preference
  priority: PriorityLevel;
}

export interface BudgetHistory {
  month: string; // YYYY-MM
  date: string; // ISO Date
  incomeConfig: UserIncomeConfig;
  expenses: ExpenseItem[];
  summary: BudgetSummary;
}

export interface BudgetSummary {
  totalIncome: number;
  totalExpenses: number;
  remainingIncome: number;
  hourlyRate: number; // The effective hourly rate used
  savingsRate: number;
}

export interface ValueAnalysis {
  cost: number;
  timeCostMinutes: number;
  timeCostFormatted: string; // "2d 4h"
  financialImpactPercent: number;
  impactLevel: 'Low Impact' | 'Consider Carefully' | 'High Financial Impact';
}
