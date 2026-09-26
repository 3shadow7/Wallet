import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './@SERVICES/auth/auth.guard';
import { deviceGuard } from '@SERVICES/guards/device.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'register', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('@COMPONENTS/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('@COMPONENTS/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    canActivate: [deviceGuard(['watch', 'mobile', 'tablet' ], '/m-View'), authGuard],
    loadComponent: () => import('./@COMPONENTS/pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'history',
    canActivate: [deviceGuard(['watch', 'mobile', 'tablet' ], '/m-View'), authGuard],
    loadComponent: () => import('./@COMPONENTS/pages/history/history.component').then(m => m.HistoryComponent)
  },
  {
    path: 'settings',
    canActivate: [deviceGuard(['watch', 'mobile', 'tablet' ], '/m-View'), authGuard],
    loadComponent: () => import('./@COMPONENTS/pages/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'm-View',
    canActivate: [deviceGuard(['laptop', 'desktop', 'tv'], '/dashboard'), authGuard],
    loadComponent: () => import('./@COMPONENTS/device-view/mobile-view/mobile-view.component').then(m => m.MobileViewComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
