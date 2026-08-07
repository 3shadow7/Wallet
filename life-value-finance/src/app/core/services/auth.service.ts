import { Injectable, signal, inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { Observable, ReplaySubject, catchError, switchMap, tap, throwError } from "rxjs";
import { AuthStorageService } from "@core/storage/stores/auth-storage.service";

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
  private authStorage = inject(AuthStorageService);

  private refreshInProgress = false;
  private refreshSubject = new ReplaySubject<string>(1);

  private apiUrl = "http://localhost:8000/api/auth";

  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);
  isGuest = signal<boolean>(false);

  constructor() {
    this.checkInitialState();
  }

  private checkInitialState() {
  try {
    const token = this.authStorage.getAccessToken();
    const savedUser = this.authStorage.getUser();
    const guestFlag = this.authStorage.isGuest();

    if (token && savedUser) {
      this.currentUser.set(savedUser);
      this.isAuthenticated.set(true);
      this.isGuest.set(false);
    } else if (guestFlag) {
      this.isGuest.set(true);
      this.isAuthenticated.set(false);
      this.currentUser.set(null);
    } else {
      this.logout();
    }
  } catch (e) {
    console.error('Error restoring auth state', e);
    this.logout();
  }
}

  login(credentials: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.apiUrl + "/login/", credentials).pipe(
      tap((response: AuthResponse) => {
        if (isPlatformBrowser(this.platformId)) {
          this.authStorage.setGuest(false);
          this.authStorage.setAccessToken(response.access);
          this.authStorage.setRefreshToken(response.refresh);
          this.authStorage.setUser(response.user);

          this.currentUser.set(response.user);
          this.isAuthenticated.set(true);
          this.isGuest.set(false);
        }
      })
    );
  }

  register(userData: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.apiUrl + "/register/", userData).pipe(
       tap((response: AuthResponse) => {
         if (isPlatformBrowser(this.platformId)) {
            this.authStorage.setGuest(false);
            this.authStorage.setAccessToken(response.access);
            this.authStorage.setRefreshToken(response.refresh);
            this.authStorage.setUser(response.user);
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
      this.authStorage.setGuest(true);
      this.isGuest.set(true);
    }
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      this.authStorage.clearAuth();
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

    const refresh = this.authStorage.getRefreshToken();
    if (!refresh) {
      return throwError(() => new Error("No refresh token"));
    }

    if (this.refreshInProgress) {
      return this.refreshSubject.asObservable();
    }

    this.refreshInProgress = true;

    return this.http.post<{ access: string }>(this.apiUrl + "/token/refresh/", { refresh }).pipe(
      tap((response) => {
        this.authStorage.setAccessToken(response.access);
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
}
