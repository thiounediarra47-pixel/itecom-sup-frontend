import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, from, map, shareReplay, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '../models/user.model';
import { ApiResponse } from '../models/api-response.model';
import { OfflineService } from './offline.service';
import { rememberAccount, updateAccountSession, verifyOffline } from './offline-auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router, private offline: OfflineService) {
    let stored = localStorage.getItem('user');
    if (stored) this.currentUserSubject.next(JSON.parse(stored));
  }

  get currentUser(): User | null { return this.currentUserSubject.value; }
  get isAuthenticated(): boolean { return !!this.currentUserSubject.value && !!localStorage.getItem('token'); }
  get isStudent(): boolean { return this.currentUser?.role === 'ROLE_STUDENT'; }
  get isTeacher(): boolean { return this.currentUser?.role === 'ROLE_TEACHER'; }
  get isAdmin(): boolean { return this.currentUser?.role === 'ROLE_ADMIN'; }

  /** Connexion en ligne ; sans internet, connexion avec la dernière session gardée sur l'appareil. */
  login(request: LoginRequest): Observable<AuthResponse> {
    if (!navigator.onLine) return this.loginOffline(request);
    return this.http.post<AuthResponse>('/api/auth/login', request).pipe(
      tap(resp => {
        this.startSession(resp);
        rememberAccount(request.email, request.password, resp).catch(() => {});
        this.offline.syncAll(true);
      }),
      catchError(err => err?.status === 0 || err?.headers?.get?.('X-Itecom-Offline')
        ? this.loginOffline(request) : throwError(() => err))
    );
  }

  /** Connexion faite sans internet (vérifiée sur l'appareil). */
  offlineLogin = false;

  private loginOffline(request: LoginRequest): Observable<AuthResponse> {
    return from(verifyOffline(request.email, request.password)).pipe(
      tap(resp => { this.startSession(resp); this.offlineLogin = true; }),
      catchError(e => throwError(() => ({ status: 0, error: { message: e.message } })))
    );
  }

  private startSession(resp: AuthResponse) {
    localStorage.setItem('token', resp.accessToken);
    localStorage.setItem('refreshToken', resp.refreshToken);
    localStorage.setItem('user', JSON.stringify(resp.user));
    this.currentUserSubject.next(resp.user);
  }

  private refreshing$: Observable<string> | null = null;

  /**
   * Session expirée (par exemple après plusieurs jours hors connexion) : nouveau jeton grâce au jeton
   * de rafraîchissement, sans redemander le mot de passe. Un seul appel même si plusieurs requêtes échouent.
   */
  refreshSession(): Observable<string> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return throwError(() => new Error('Aucune session à renouveler'));
    if (!this.refreshing$) {
      this.refreshing$ = this.http.post<AuthResponse>('/api/auth/refresh', { refreshToken }).pipe(
        tap(resp => { this.startSession(resp); updateAccountSession(resp); this.offlineLogin = false; }),
        map(resp => resp.accessToken),
        finalize(() => this.refreshing$ = null),
        shareReplay(1)
      );
    }
    return this.refreshing$;
  }

  register(request: RegisterRequest): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>('/api/auth/register', request);
  }

  verifyEmail(token: string): Observable<ApiResponse<string>> {
    return this.http.get<ApiResponse<string>>(`/api/auth/verify-email?token=${token}`);
  }

  forgotPassword(email: string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>('/api/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>('/api/auth/reset-password', { token, password });
  }

  logout(): void {
    // Les cours téléchargés et la connexion hors ligne restent sur l'appareil (élèves éloignés) ;
    // « Effacer les données de cet appareil » (Mon apprentissage) les supprime sur un appareil partagé.
    this.offlineLogin = false;
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  /** Efface la session (stockage et utilisateur en mémoire) sans naviguer. */
  clearSession(): void {
    // Une session expirée ne doit pas effacer la progression faite hors connexion ni les réglages hors ligne
    const kept = Object.keys(localStorage).filter(k => k.startsWith('itecom-offline'))
      .map(k => [k, localStorage.getItem(k)!] as const);
    localStorage.clear();
    kept.forEach(([k, v]) => localStorage.setItem(k, v));
    this.currentUserSubject.next(null);
  }

  getToken(): string | null { return localStorage.getItem('token'); }

  /** Met à jour l'utilisateur connecté (en mémoire et en stockage) après une modification de profil. */
  updateCurrentUser(changes: Partial<User>): void {
    const current = this.currentUserSubject.value;
    if (!current) return;
    const updated = { ...current, ...changes };
    localStorage.setItem('user', JSON.stringify(updated));
    this.currentUserSubject.next(updated);
  }
}
