import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { deviceGuard } from '@core/guards/device.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'register', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    canActivate: [deviceGuard(['watch', 'mobile', 'tablet' ], '/m-View'), authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'history',
    canActivate: [deviceGuard(['watch', 'mobile', 'tablet' ], '/m-View'), authGuard],
    loadComponent: () => import('./features/history/history.component').then(m => m.HistoryComponent)
  },
  {
    path: 'settings',
    canActivate: [deviceGuard(['watch', 'mobile', 'tablet' ], '/m-View'), authGuard],
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'm-View',
    canActivate: [deviceGuard(['laptop', 'desktop', 'tv'], '/dashboard'), authGuard],
    loadComponent: () => import('./features/device-view/mobile-view/mobile-view.component').then(m => m.MobileViewComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
