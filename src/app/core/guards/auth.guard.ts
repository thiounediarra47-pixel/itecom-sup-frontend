import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  let authService = inject(AuthService);
  let router = inject(Router);
  if (authService.isAuthenticated) return true;
  router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

export const studentGuard: CanActivateFn = (route, state) => {
  let authService = inject(AuthService);
  if (authService.isAuthenticated && (authService.isStudent || authService.isAdmin)) return true;
  return inject(Router).createUrlTree([authService.isAuthenticated ? '/dashboard' : '/auth/login']);
};

export const teacherGuard: CanActivateFn = (route, state) => {
  let authService = inject(AuthService);
  if (authService.isAuthenticated && (authService.isTeacher || authService.isAdmin)) return true;
  return inject(Router).createUrlTree([authService.isAuthenticated ? '/dashboard' : '/auth/login']);
};

/** Catalogue des cours : réservé aux étudiants (et à l'administrateur) ; le professeur va sur ses cours. */
export const catalogGuard: CanActivateFn = () => {
  let authService = inject(AuthService);
  return authService.isTeacher ? inject(Router).createUrlTree(['/teacher/courses']) : true;
};

export const adminGuard: CanActivateFn = () => {
  let authService = inject(AuthService);
  if (authService.isAuthenticated && authService.isAdmin) return true;
  return inject(Router).createUrlTree([authService.isAuthenticated ? '/dashboard' : '/auth/login']);
};

/** Pages de connexion : un utilisateur déjà connecté est renvoyé vers son tableau de bord. */
export const guestGuard: CanActivateFn = () => {
  let authService = inject(AuthService);
  return authService.isAuthenticated ? inject(Router).createUrlTree(['/dashboard']) : true;
};

/** Adresse de retour après connexion : uniquement une page interne, jamais une page /auth. */
export function safeReturnUrl(url: string | null): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/auth')) return '/dashboard';
  return url;
}
