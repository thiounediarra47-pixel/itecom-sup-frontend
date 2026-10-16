import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DialogService } from '../services/dialog.service';

/** À poser sur une requête de fond (ex. envoi du temps passé) pour ne pas afficher de message d'erreur. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);
/** Requête déjà rejouée après un renouvellement de session (pas de boucle). */
const RETRIED = new HttpContextToken<boolean>(() => false);

// Évite d'empiler le même message quand plusieurs requêtes échouent en même temps
let lastToast = { message: '', at: 0 };

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  let router = inject(Router);
  let authService = inject(AuthService);
  let dialogs = inject(DialogService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Le même compte s'est connecté ailleurs : cette session est terminée, inutile de la renouveler
      if (error.status === 401 && isSessionReplaced(error)) {
        authService.clearSession();
        router.navigate(['/auth/login'], { queryParams: { reason: 'session-replaced' } });
        return throwError(() => error);
      }
      // Session expirée (souvent après des jours hors connexion) : on la renouvelle et on rejoue la requête
      if (error.status === 401 && !req.url.includes('/api/auth/') && !req.context.get(RETRIED)
          && localStorage.getItem('refreshToken')) {
        return authService.refreshSession().pipe(
          switchMap(token => next(retry(req, token))),
          catchError(refreshError => {
            authService.clearSession();
            router.navigate(['/auth/login'], { queryParams: isSessionReplaced(refreshError)
              ? { reason: 'session-replaced' } : { returnUrl: router.url } });
            return throwError(() => error);
          })
        );
      }
      if (error.status === 401) {
        authService.clearSession();
        router.navigate(['/auth/login'], {
          queryParams: { returnUrl: router.url }
        });
      } else if (!req.context.get(SILENT_ERRORS)
                 // Connexion et lien d'examen affichent eux-mêmes le message du serveur (ex. compte désactivé)
                 && !req.url.includes('/api/auth/') && !req.url.includes('/api/exam/access/')) {
        // Les erreurs 400/404/409 sont affichées par les formulaires eux-mêmes ;
        // les autres échouaient souvent sans aucun message (page vide).
        const message = globalErrorMessage(error);
        if (message && (message !== lastToast.message || Date.now() - lastToast.at > 4000)) {
          lastToast = { message, at: Date.now() };
          dialogs.toast(message, 'danger', 5000);
        }
      }
      return throwError(() => error);
    })
  );
};

/** Réponse du serveur quand une connexion plus récente du même compte a remplacé cette session. */
function isSessionReplaced(error: unknown): boolean {
  const body = (error as HttpErrorResponse)?.error;
  return body?.code === 'SESSION_REPLACED' || /autre appareil/.test(body?.message || '');
}

function retry(req: HttpRequest<unknown>, token: string) {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` }, context: req.context.set(RETRIED, true) });
}

function globalErrorMessage(error: HttpErrorResponse): string | null {
  if (!navigator.onLine || error.headers?.get('X-Itecom-Offline')) {
    return 'Vous êtes hors connexion : cette action nécessite internet. Les cours restent disponibles.';
  }
  if (error.status === 0) return 'Serveur injoignable. Vérifiez votre connexion internet puis réessayez.';
  if (error.status === 403) return 'Accès refusé : vous n\'avez pas les droits pour cette action.';
  if (error.status >= 500) return 'Le serveur a rencontré une erreur. Réessayez dans un instant.';
  return null;
}
