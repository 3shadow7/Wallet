import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard to protect routes that require authentication OR guest access
 */
export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Allow if authenticated OR guest
    if (authService.isAuthenticated() || authService.isGuest()) {
        return true;
    }

    // Redirect to login if neither authenticated nor guest
    return router.parseUrl('/login');
};

/**
 * Guest Guard to protect routes that should not be accessible if you are already identifying as someone (user or guest)
 */
export const guestGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // If neither authenticated nor guest, then they can see the login/register pages
    if (!authService.isAuthenticated() && !authService.isGuest()) {
        return true;
    }

    // Redirect to home if identified
    return router.parseUrl('/dashboard');
};
