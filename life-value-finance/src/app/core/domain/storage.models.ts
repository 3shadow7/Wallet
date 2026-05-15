import {
  BudgetHistory,
  ExpenseItem,
  MonthlyIncome,
  UserIncomeConfig,
  MonthlyRecord
} from './models';

export interface StorageEnvelope<T> {
  version: number;
  updatedAt: string; // ISO date-time
  data: T;
}

export type IncomeStore = StorageEnvelope<IncomeData>;
export type HistoryStore = StorageEnvelope<HistoryData>;
export type ItemsStore = StorageEnvelope<ItemsData>;

export interface IncomeData {
  incomeConfig: UserIncomeConfig;
  sources?: MonthlyIncome[];
  taxProfile?: TaxProfile;
  savingsGoal?: SavingsGoal;
  calculation?: IncomeCalculation;
}

export interface HistoryData {
  budgetHistory?: BudgetHistory[];
  savingsHistory?: MonthlyRecord[];
  savingsSummary?: SavingsSummary;
  analysis?: HistoryAnalysis;
}

export interface ItemsData {
  currentMonth: MonthlyItems;
  months: Record<string, MonthlyItems>;
}

export interface MonthlyItems {
  month: string; // YYYY-MM
  items: ExpenseItem[];
  updatedAt: string; // ISO date-time
}

export interface TaxProfile {
  mode: 'fixed' | 'percentage' | 'progressive';
  percentage?: number;
  fixedAmount?: number;
  brackets?: TaxBracket[];
}

export interface TaxBracket {
  upTo: number;
  rate: number;
}

export interface SavingsGoal {
  enabled: boolean;
  type: 'fixed' | 'percent_of_income';
  target: number;
}

export interface IncomeCalculation {
  grossMonthlyIncome: number;
  estimatedTaxes: number;
  netMonthlyIncome: number;
  effectiveHourlyRate: number;
  lastCalculatedAt: string; // ISO date-time
}

export interface SavingsSummary {
  totalSavings: number;
  manualSavingsLog: number;
  lastUpdated: string; // ISO date-time
}

export interface HistoryAnalysis {
  monthsCount: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  averageSavingsRate: number;
  lastUpdated: string; // ISO date-time
}
