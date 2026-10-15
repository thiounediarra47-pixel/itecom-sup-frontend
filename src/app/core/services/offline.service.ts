import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { Course } from '../models/course.model';

/** Cours téléchargé : ce qu'il faut pour le suivre sans connexion. */
export interface OfflineCourse {
  courseId: number;
  title: string;
  lessonCount: number;
  sizeBytes: number;
  downloadedAt: string;
  /** Vidéo téléchargée pour chaque leçon (version légère de préférence). */
  videos: Record<number, string>;
  files: string[];
}

interface QueuedRequest { method: string; url: string; body: unknown; email: string; at: number; }

/** État de la synchronisation automatique des cours. */
export interface SyncState { running: boolean; done: number; total: number; lastSync: number | null; error: string | null; }

const API_CACHE_PREFIX = 'itecom-api';
const MEDIA_CACHE = 'itecom-offline';
const AUTOSYNC_KEY = 'itecom-offline-autosync';
const LAST_SYNC_KEY = 'itecom-offline-last-sync';
/** Synchronisation automatique au plus toutes les 6 heures (ou après une connexion). */
const SYNC_EVERY_MS = 6 * 3600_000;
const INDEX_KEY = '/__offline__/courses.json';
/** Préfixe conservé par AuthService.clearSession (une session expirée n'efface pas le travail hors ligne). */
const QUEUE_KEY = 'itecom-offline-queue';

/**
 * Hors connexion : téléchargement des cours (données, vidéos légères, documents) dans le navigateur,
 * état de la connexion, et progression enregistrée hors ligne puis envoyée au retour du réseau.
 */
@Injectable({ providedIn: 'root' })
export class OfflineService {
  readonly online$ = new BehaviorSubject<boolean>(navigator.onLine);
  readonly courses$ = new BehaviorSubject<OfflineCourse[]>([]);
  /** Téléchargements en cours : identifiant du cours → pourcentage. */
  readonly downloading$ = new BehaviorSubject<Record<number, number>>({});
  readonly supported = typeof caches !== 'undefined' && 'serviceWorker' in navigator;
  readonly sync$ = new BehaviorSubject<SyncState>({ running: false, done: 0, total: 0, lastSync: this.lastSync, error: null });

  constructor(private http: HttpClient, zone: NgZone) {
    window.addEventListener('online', () => zone.run(() => {
      this.online$.next(true);
      this.flushQueue();
      this.syncAll();
    }));
    window.addEventListener('offline', () => zone.run(() => this.online$.next(false)));
    this.loadIndex();
    if (navigator.onLine) setTimeout(() => { this.flushQueue(); this.syncAll(); }, 3000);
  }

  // ── Synchronisation automatique : tous les cours disponibles hors connexion ──

  get autoSync(): boolean {
    try { return localStorage.getItem(AUTOSYNC_KEY) !== '0'; } catch { return true; }
  }

  set autoSync(on: boolean) {
    try { localStorage.setItem(AUTOSYNC_KEY, on ? '1' : '0'); } catch { }
    if (on) this.syncAll(true);
  }

  private get lastSync(): number | null {
    try { return Number(localStorage.getItem(LAST_SYNC_KEY)) || null; } catch { return null; }
  }

  /**
   * Garde tous les cours sur l'appareil : catalogue et contenu de chaque cours (pour tous),
   * et, pour un étudiant, les vidéos légères et documents de ses cours.
   */
  async syncAll(force = false) {
    const state = this.sync$.value;
    if (!this.supported || !this.online || state.running || !localStorage.getItem('token')) return;
    if (!force && (!this.autoSync || (this.lastSync && Date.now() - this.lastSync < SYNC_EVERY_MS))) return;
    this.sync$.next({ ...state, running: true, done: 0, total: 0, error: null });
    try {
      const headers = this.authHeaders();
      // Catalogue et fiche de chaque cours (mis en cache par le service worker)
      const catalog: Course[] = await fetch('/api/courses/public', { headers }).then(r => r.ok ? r.json() : []).catch(() => []);
      const enrolled: Course[] = await fetch('/api/courses/enrolled', { headers }).then(r => r.ok ? r.json() : []).catch(() => []);
      await fetch('/api/progress/my-progress', { headers }).catch(() => null);
      const isStudent = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').role === 'ROLE_STUDENT'; } catch { return false; } })();
      const toDownload = isStudent ? enrolled : [];
      const others = catalog.filter(c => !toDownload.some(e => e.id === c.id));
      this.sync$.next({ ...this.sync$.value, total: toDownload.length + others.length });
      for (const c of others) {
        await fetch(`/api/courses/public/${c.id}`, { headers }).catch(() => null);
        this.sync$.next({ ...this.sync$.value, done: this.sync$.value.done + 1 });
      }
      for (const c of toDownload) {
        if (!this.online) break;
        await this.download(c);
        this.sync$.next({ ...this.sync$.value, done: this.sync$.value.done + 1 });
      }
      try { localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); } catch { }
      this.sync$.next({ ...this.sync$.value, running: false, lastSync: Date.now() });
    } catch (e: any) {
      this.sync$.next({ ...this.sync$.value, running: false, error: e?.message || 'Synchronisation interrompue.' });
    }
  }

  get online(): boolean { return this.online$.value; }

  isDownloaded(courseId: number): boolean {
    return this.courses$.value.some(c => c.courseId === courseId);
  }

  /** Vidéo à lire pour une leçon d'un cours téléchargé (celle qui est stockée sur l'appareil). */
  downloadedVideo(courseId: number, lessonId: number): string | null {
    return this.courses$.value.find(c => c.courseId === courseId)?.videos[lessonId] ?? null;
  }

  // ── Téléchargement ─────────────────────────────────────────────────────────

  /** Télécharge un cours pour le suivre sans connexion. Renvoie le cours enregistré. */
  async download(course: Course): Promise<OfflineCourse> {
    if (!this.supported) throw new Error('Votre navigateur ne permet pas le hors connexion. Utilisez Chrome, Edge ou Firefox récent.');
    if (!this.online) throw new Error('Connectez-vous à internet pour télécharger le cours.');
    const id = course.id;
    this.setProgress(id, 0);
    try {
      // Données du cours et progression : le service worker les garde (cache propre à l'utilisateur)
      const res = await fetch(`/api/courses/public/${id}`, { headers: this.authHeaders() });
      if (!res.ok) throw new Error('Cours introuvable sur le serveur.');
      const fullCourse: Course = await res.json();
      await fetch(`/api/progress/course/${id}`, { headers: this.authHeaders() }).catch(() => null);

      // Vidéos (légères de préférence) et documents
      const videos: Record<number, string> = {};
      const files: string[] = [];
      for (const lesson of fullCourse.lessons ?? []) {
        const video = this.localUrl(lesson.videoLightUrl) ?? this.localUrl(lesson.videoUrl);
        if (video) { videos[lesson.id] = video; files.push(video); }
        const doc = this.localUrl(lesson.pdfUrl);
        if (doc) files.push(doc);
      }
      const unique = [...new Set(files)];
      await this.checkSpace(unique);
      await navigator.storage?.persist?.().catch(() => false);

      const media = await caches.open(MEDIA_CACHE);
      let sizeBytes = 0;
      for (let i = 0; i < unique.length; i++) {
        const url = unique[i];
        const existing = await media.match(url);
        if (existing) {
          sizeBytes += Number(existing.headers.get('Content-Length') || 0);
        } else {
          sizeBytes += await this.fetchInto(media, url, fraction =>
            this.setProgress(id, Math.round(((i + fraction) / unique.length) * 100)));
        }
        this.setProgress(id, Math.round(((i + 1) / unique.length) * 100));
      }

      // Fichiers devenus inutiles (ex. vidéo remplacée par sa version légère)
      const previous = this.courses$.value.find(c => c.courseId === id);
      const usedElsewhere = new Set(this.courses$.value.filter(c => c.courseId !== id).flatMap(c => c.files));
      for (const f of previous?.files ?? []) if (!unique.includes(f) && !usedElsewhere.has(f)) await media.delete(f);

      const entry: OfflineCourse = {
        courseId: id, title: fullCourse.title, lessonCount: fullCourse.lessons?.length ?? 0,
        sizeBytes, downloadedAt: new Date().toISOString(), videos, files: unique
      };
      await this.saveIndex([...this.courses$.value.filter(c => c.courseId !== id), entry]);
      return entry;
    } finally {
      this.setProgress(id, null);
    }
  }

  /** Retire un cours de l'appareil (les fichiers partagés avec un autre cours téléchargé sont gardés). */
  async remove(courseId: number) {
    if (!this.supported) return;
    const others = this.courses$.value.filter(c => c.courseId !== courseId);
    const keep = new Set(others.flatMap(c => c.files));
    const entry = this.courses$.value.find(c => c.courseId === courseId);
    const media = await caches.open(MEDIA_CACHE);
    for (const f of entry?.files ?? []) if (!keep.has(f)) await media.delete(f);
    await this.saveIndex(others);
  }

  /** Appareil partagé : efface cours téléchargés, données gardées, connexion hors ligne et actions non envoyées. */
  async clearUserData() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('itecom-offline')).forEach(k => localStorage.removeItem(k));
    } catch { }
    if (this.supported) {
      navigator.serviceWorker.controller?.postMessage('clear-user-data');
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith(API_CACHE_PREFIX) || k === MEDIA_CACHE).map(k => caches.delete(k)));
    }
    this.courses$.next([]);
    this.sync$.next({ running: false, done: 0, total: 0, lastSync: null, error: null });
  }

  // ── Progression faite hors connexion ───────────────────────────────────────

  /** Garde une action (leçon terminée, temps passé…) pour l'envoyer quand la connexion revient. */
  enqueue(method: string, url: string, body: unknown) {
    const queue = this.readQueue();
    queue.push({ method, url, body, email: this.currentEmail(), at: Date.now() });
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-500))); } catch { }
  }

  get pendingCount(): number { return this.readQueue().filter(q => q.email === this.currentEmail()).length; }

  private currentEmail(): string {
    try { return (JSON.parse(localStorage.getItem('user') || '{}').email || '').toLowerCase(); } catch { return ''; }
  }

  private flushing = false;

  /** Envoie, dans l'ordre, les actions de l'utilisateur connecté (celles d'un autre compte attendent sa connexion). */
  async flushQueue() {
    const email = this.currentEmail();
    if (this.flushing || !this.online || !email || !localStorage.getItem('token')) return;
    this.flushing = true;
    try {
      for (;;) {
        const queue = this.readQueue();
        const index = queue.findIndex(q => (q.email || email) === email);
        if (index < 0 || !this.online) break;
        const item = queue[index];
        try {
          await new Promise<void>((resolve, reject) =>
            this.http.request(item.method || 'POST', item.url, { body: item.body })
              .subscribe({ next: () => resolve(), error: e => reject(e) }));
        } catch (e: any) {
          // Réseau absent ou session à renouveler : on réessaiera ; autre erreur : l'action est abandonnée
          if (e?.status === 0 || e?.status === 401 || e?.status === 503) break;
        }
        const rest = this.readQueue();
        rest.splice(rest.findIndex(q => q.at === item.at && q.url === item.url), 1);
        try { localStorage.setItem(QUEUE_KEY, JSON.stringify(rest)); } catch { }
      }
    } finally {
      this.flushing = false;
    }
  }

  private readQueue(): QueuedRequest[] {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
  }

  // ── Outils ─────────────────────────────────────────────────────────────────

  /** Seuls les fichiers de la plateforme (/uploads) sont téléchargés ; un lien externe (YouTube…) ne l'est pas. */
  private localUrl(url: string | null | undefined): string | null {
    return url && url.startsWith('/uploads/') ? url.split('?')[0] : null;
  }

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Télécharge un fichier dans le cache en suivant l'avancement ; renvoie sa taille. */
  private async fetchInto(cache: Cache, url: string, onProgress: (fraction: number) => void): Promise<number> {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Fichier indisponible : ${url.substring(url.lastIndexOf('/') + 1)}`);
    const total = Number(res.headers.get('Content-Length') || 0);
    const [toCache, toCount] = res.body.tee();
    const headers = new Headers({ 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream' });
    if (total) headers.set('Content-Length', String(total));
    const stored = cache.put(url, new Response(toCache, { status: 200, headers }));
    const reader = toCount.getReader();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (total) onProgress(Math.min(1, received / total));
    }
    await stored;
    return received;
  }

  /** Vérifie la place disponible sur l'appareil avant de télécharger. */
  private async checkSpace(urls: string[]) {
    const estimate = await navigator.storage?.estimate?.().catch(() => null);
    if (!estimate?.quota) return;
    let needed = 0;
    for (const url of urls) {
      const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
      needed += Number(head?.headers.get('Content-Length') || 0);
    }
    const free = estimate.quota - (estimate.usage ?? 0);
    if (needed > free) {
      throw new Error(`Espace insuffisant sur l'appareil : ${this.mb(needed)} nécessaires, ${this.mb(free)} disponibles.`);
    }
  }

  private mb(bytes: number) { return `${Math.max(1, Math.round(bytes / 1048576))} Mo`; }

  private setProgress(courseId: number, value: number | null) {
    const next = { ...this.downloading$.value };
    if (value === null) delete next[courseId]; else next[courseId] = value;
    this.downloading$.next(next);
  }

  private async loadIndex() {
    if (!this.supported) return;
    try {
      const res = await (await caches.open(MEDIA_CACHE)).match(INDEX_KEY);
      this.courses$.next(res ? await res.json() : []);
    } catch {
      this.courses$.next([]);
    }
  }

  private async saveIndex(list: OfflineCourse[]) {
    const media = await caches.open(MEDIA_CACHE);
    await media.put(INDEX_KEY, new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } }));
    this.courses$.next(list);
  }
}

/** Taille lisible : 12,4 Mo. */
export function formatSize(bytes: number): string {
  if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1048576).toFixed(1).replace('.', ',')} Mo`;
}

