
import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { AuthService } from "../services/auth.service";
import { DeviceIdentityService } from "../services/device-identity.service";
import { catchError, switchMap, throwError } from "rxjs";

const shouldSkip = (url: string) =>
  url.includes("/auth/login/") || url.includes("/auth/register/") || url.includes("/auth/token/refresh/");

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const deviceIdentity = inject(DeviceIdentityService);

  const token = localStorage.getItem("access_token");
  const isAuthRequest = shouldSkip(req.url);
  const deviceId = deviceIdentity.getDeviceId();

  const authReq = token && !isAuthRequest
    ? req.clone({
        headers: req.headers
          .set("Authorization", `Bearer ${token}`)
          .set("X-Device-ID", deviceId)
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const refresh = localStorage.getItem("refresh_token");
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

