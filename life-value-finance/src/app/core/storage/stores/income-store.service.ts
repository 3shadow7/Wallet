import { Injectable, inject } from '@angular/core';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
import { STORAGE_KEYS } from '@core/storage/engine/storage-keys';
import { IncomeData, IncomeStore } from '@core/domain/storage.models';
import { UserIncomeConfig } from '@core/domain/models';

const STORE_VERSION = 1;

const DEFAULT_INCOME_CONFIG: UserIncomeConfig = {
  monthlyIncome: 0,
  workHoursPerMonth: 160,
  hourlyRate: 0,
  isHourlyManual: false,
  calculationMethod: 'weekly',
  weeklyHoursDetails: { hoursPerDay: 8, daysPerWeek: 5 }
};

@Injectable({ providedIn: 'root' })
export class IncomeStoreService {
  private engine = inject(StorageEngineService);

  read(): IncomeStore | null {
    return this.engine.readJson<IncomeStore>(STORAGE_KEYS.income);
  }

  getData(): IncomeData {
    return this.read()?.data ?? this.defaultData();
  }

  setData(data: IncomeData): void {
    this.writeStore(data);
  }

  updateData(patch: Partial<IncomeData>): void {
    const current = this.getData();
    this.writeStore({ ...current, ...patch });
  }

  private writeStore(data: IncomeData): void {
    const now = new Date().toISOString();
    const store: IncomeStore = { version: STORE_VERSION, updatedAt: now, data };
    this.engine.writeJson(STORAGE_KEYS.income, store);
  }

  private defaultData(): IncomeData {
    return {
      incomeConfig: { ...DEFAULT_INCOME_CONFIG },
      sources: []
    };
  }
}
