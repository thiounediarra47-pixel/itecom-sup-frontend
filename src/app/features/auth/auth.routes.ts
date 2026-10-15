import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/auth.guard';

export const authRoutes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },
  // Inscriptions fermées : les comptes sont créés par l'administrateur
  { path: 'register', redirectTo: 'login', pathMatch: 'full' },
  { path: 'verify-email', loadComponent: () => import('./verify-email/verify-email.component').then(m => m.VerifyEmailComponent) },
  { path: 'payment', loadComponent: () => import('./payment/payment.component').then(m => m.PaymentComponent) },
  { path: 'forgot-password', loadComponent: () => import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];
