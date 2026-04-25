import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface Expense {
    id?: number;
    name: string;
    category?: string;
    amount: number;
    unit_price: number;
    quantity: number;
    is_ignored: boolean;
    type: string;
    priority: string;
    month: string;
}

export interface UserIncome {
    monthly_income: number;
    work_hours_per_month: number;
    hourly_rate: number;
    is_hourly_manual: boolean;
    calculation_method: 'weekly' | 'manual';
    hours_per_day: number;
    days_per_week: number;
}

@Injectable({
    providedIn: "root"
})
export class FinanceService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiBaseUrl}/finance`;

    getExpenses(month?: string): Observable<Expense[]> {
        let params = new HttpParams();
        if (month) {
            params = params.set("month", month);
        }
        return this.http.get<Expense[]>(this.apiUrl + "/expenses/", { params });
    }

    addExpense(expense: Expense): Observable<Expense> {
        return this.http.post<Expense>(this.apiUrl + "/expenses/", expense);
    }

    updateExpense(id: number, expense: Partial<Expense>): Observable<Expense> {
        return this.http.patch<Expense>(this.apiUrl + "/expenses/" + id + "/", expense);
    }

    deleteExpense(id: number): Observable<any> {
        return this.http.delete(this.apiUrl + "/expenses/" + id + "/");
    }

    getIncome(): Observable<UserIncome> {
        return this.http.get<UserIncome>(this.apiUrl + "/income/");
    }

    updateIncome(payload: Partial<UserIncome>): Observable<UserIncome> {
        return this.http.put<UserIncome>(this.apiUrl + "/income/", payload);
    }
}
