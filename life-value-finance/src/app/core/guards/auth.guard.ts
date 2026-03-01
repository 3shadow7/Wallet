import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard to protect routes that require authentication OR guest access
 */
export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // If fully authenticated user, allow access
    if (authService.isAuthenticated()) {
        return true;
    }

    // If identifying as guest, allow access
    else if (authService.isGuest()) {
        return true;
    }
    // Redirect to register if neither authenticated nor guest
    else return router.parseUrl('/register');
};

/**
 * Guest Guard to protect routes that should not be accessible if you are already identifying as someone (user or guest)
 * Update: Allow guests to access login/register so they can upgrade their account.
 */
export const guestGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // If they are fully authenticated (logged in user), redirect them to dashboard
    if (authService.isAuthenticated()) {
        return router.parseUrl('/dashboard');
    }

    // Allow access to login/register if they are NOT authenticated 
    // (even if they have the 'isGuest' flag so they can choose to register/login)
    return true;
};
