import { Injectable, signal, inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";

export interface User {
  id: number;
  username: string;
  email: string;
}

@Injectable({
  providedIn: "root"
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  private apiUrl = "http://localhost:8000/api/auth";

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

  login(credentials: any): Observable<any> {
    return this.http.post<any>(this.apiUrl + "/login/", credentials).pipe(
      tap((response: any) => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.removeItem("is_guest");
          localStorage.setItem("access_token", response.access);
          localStorage.setItem("refresh_token", response.refresh);
          
          // SimpleJWT doesn"t return user by default, we build a simple object
          // unless you customize the ObtainPair view in Django.
          const userData = { username: credentials.username } as User;
          localStorage.setItem("user", JSON.stringify(userData));
          
          this.currentUser.set(userData);
          this.isAuthenticated.set(true);
          this.isGuest.set(false);
        }
      })
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(this.apiUrl + "/register/", userData).pipe(
       tap((response: any) => {
         if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem("access_token", response.access);
            localStorage.setItem("refresh_token", response.refresh);
            localStorage.setItem("user", JSON.stringify(response.user));
            this.currentUser.set(response.user);
            this.isAuthenticated.set(true);
         }
       })
    );
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
    }
  }
}
