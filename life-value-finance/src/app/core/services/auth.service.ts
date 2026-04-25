import { Injectable, signal, inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { Observable, ReplaySubject, catchError, map, of, switchMap, tap, throwError } from "rxjs";
import { environment } from "../../../environments/environment";
import { BackupService } from "./backup.service";

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

@Injectable({
  providedIn: "root"
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private backupService = inject(BackupService);

  private refreshInProgress = false;
  private refreshSubject = new ReplaySubject<string>(1);

  private apiUrl = `${environment.apiBaseUrl}/auth`;
  private readonly storageKeyAppData = "life_value_finance_data";
  private readonly storageKeySavings = "savingsStorage";
  private readonly storageKeyMonthlyHistory = "monthlyHistory";

  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);
  isGuest = signal<boolean>(false);

  constructor() {
    this.checkInitialState();
  }

  private checkInitialState() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const token = localStorage.getItem("access_token");
        const savedUser = localStorage.getItem("user");
        const guestFlag = localStorage.getItem("is_guest");

        if (token && savedUser) {
          const userData = JSON.parse(savedUser);
          this.currentUser.set(userData);
          this.isAuthenticated.set(true);
          this.isGuest.set(false);
        } else if (guestFlag === "true") {
          this.isGuest.set(true);
          this.isAuthenticated.set(false);
          this.currentUser.set(null);
        } else {
          this.logout();
        }
      } catch (e) {
        console.error("Error restoring auth state", e);
        this.logout();
      }
    }
  }

  login(credentials: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.apiUrl + "/login/", credentials).pipe(
      tap((response: AuthResponse) => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.removeItem("is_guest");
          localStorage.setItem("access_token", response.access);
          localStorage.setItem("refresh_token", response.refresh);
          localStorage.setItem("user", JSON.stringify(response.user));

          this.currentUser.set(response.user);
          this.isAuthenticated.set(true);
          this.isGuest.set(false);
        }
      }),
      switchMap((response: AuthResponse) =>
        this.restoreCloudBackupIfLocalMissing().pipe(map(() => response))
      )
    );
  }

  register(userData: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.apiUrl + "/register/", userData).pipe(
       tap((response: AuthResponse) => {
         if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem("is_guest");
            localStorage.setItem("access_token", response.access);
            localStorage.setItem("refresh_token", response.refresh);
            localStorage.setItem("user", JSON.stringify(response.user));
            this.currentUser.set(response.user);
            this.isAuthenticated.set(true);
            this.isGuest.set(false);
         }
       })
    );
  }

  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(this.apiUrl + "/me/");
  }

  continueAsGuest() {
    if (isPlatformBrowser(this.platformId)) {
      this.logout();
      localStorage.setItem("is_guest", "true");
      this.isGuest.set(true);
    }
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      localStorage.removeItem("is_guest");
      this.currentUser.set(null);
      this.isAuthenticated.set(false);
      this.isGuest.set(false);
      // Route away from protected views so guards re-evaluate
      this.router.navigate(["/login"]);
    }
  }

  refreshAccessToken(): Observable<string> {
    if (!isPlatformBrowser(this.platformId)) {
      return throwError(() => new Error("Refresh not available on server"));
    }

    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) {
      return throwError(() => new Error("No refresh token"));
    }

    if (this.refreshInProgress) {
      return this.refreshSubject.asObservable();
    }

    this.refreshInProgress = true;

    return this.http.post<{ access: string }>(this.apiUrl + "/token/refresh/", { refresh }).pipe(
      tap((response) => {
        localStorage.setItem("access_token", response.access);
        this.refreshSubject.next(response.access);
        this.refreshSubject.complete();
        this.refreshSubject = new ReplaySubject<string>(1); // reset for next time
        this.refreshInProgress = false;
      }),
      switchMap((response) => {
        return new Observable<string>((observer) => {
          observer.next(response.access);
          observer.complete();
        });
      }),
      catchError((err) => {
        this.refreshInProgress = false;
        this.refreshSubject = new ReplaySubject<string>(1);
        this.logout();
        return throwError(() => err);
      })
    );
  }

  private shouldRestoreCloudBackup(): boolean {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === "undefined") {
      return false;
    }

    const hasMainState = !!localStorage.getItem(this.storageKeyAppData);
    const hasSavingsState =
      localStorage.getItem(this.storageKeySavings) !== null ||
      localStorage.getItem(this.storageKeyMonthlyHistory) !== null;

    return !(hasMainState || hasSavingsState);
  }

  private restoreCloudBackupIfLocalMissing(): Observable<void> {
    if (!this.shouldRestoreCloudBackup()) {
      return of(void 0);
    }

    return this.backupService.restoreFromBackend().pipe(
      map(() => void 0),
      catchError((err) => {
        // Do not block login if there is no cloud snapshot or restore fails.
        console.warn("Cloud auto-restore after login failed; continuing with current local state.", err);
        return of(void 0);
      })
    );
  }
}
