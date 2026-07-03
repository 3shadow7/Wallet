
import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, throwError } from "rxjs";
import { AuthStorageService } from "@core/storage/stores/auth-storage.service";
import { AuthService } from "../services/auth.service";

const shouldSkip = (url: string) =>
  url.includes("/auth/login/") || url.includes("/auth/register/") || url.includes("/auth/token/refresh/");

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authStorage = inject(AuthStorageService);

  const token = authStorage.getAccessToken();
  const isAuthRequest = shouldSkip(req.url);

  const authReq = token && !isAuthRequest
    ? req.clone({ headers: req.headers.set("Authorization", `Bearer ${token}`) })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const refresh = authStorage.getRefreshToken();
      // Only try refresh on 401 for non-auth endpoints if we have a refresh token
      if (error.status === 401 && refresh && !isAuthRequest) {
        return authService.refreshAccessToken().pipe(
          switchMap((newAccess) => {
            const retryReq = req.clone({
              headers: req.headers.set("Authorization", `Bearer ${newAccess}`)
            });
            return next(retryReq);
          }),
          catchError((refreshErr) => {
            return throwError(() => refreshErr);
          })
        );
      }
      return throwError(() => error);
    })
  );
};

