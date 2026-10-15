import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, throwError } from 'rxjs';
import { OfflineService } from '../services/offline.service';

/**
 * Actions faites sur les cours sans internet : gardées sur l'appareil et envoyées au retour de la connexion.
 * L'application répond tout de suite « enregistré » : l'étudiant continue normalement.
 */
const QUEUEABLE: [string, RegExp][] = [
  ['POST', /^\/api\/progress\/lesson\/\d+\/(complete|scroll|time|save-code|video)$/],
  ['POST', /^\/api\/courses\/\d+\/enroll$/],
  ['PUT', /^\/api\/users\/profile$/],
  ['POST', /^\/api\/notifications\/(\d+\/read|read-all)$/]
];

export function isQueueable(method: string, url: string): boolean {
  const path = url.split('?')[0].replace(/^https?:\/\/[^/]+/, '');
  return QUEUEABLE.some(([m, r]) => m === method && r.test(path));
}

export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || !isQueueable(req.method, req.url)) return next(req);
  const offline = inject(OfflineService);
  const saved = () => {
    offline.enqueue(req.method, req.urlWithParams, req.body);
    return of(new HttpResponse({ status: 200, body: {
      success: true, offline: true, data: null,
      message: 'Enregistré sur l\'appareil : envoyé automatiquement au retour de la connexion.'
    } }));
  };
  if (!navigator.onLine) return saved();
  return next(req).pipe(catchError(err =>
    err?.status === 0 || err?.headers?.get?.('X-Itecom-Offline') ? saved() : throwError(() => err)));
};
