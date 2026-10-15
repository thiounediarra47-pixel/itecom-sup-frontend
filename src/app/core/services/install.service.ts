import { Injectable, NgZone } from '@angular/core';

const DISMISS_KEY = 'itecom-offline-install-dismissed';   // « itecom-offline » : conservé à la déconnexion

/**
 * Installation sur l'écran d'accueil : Android/Chrome propose l'installation native (beforeinstallprompt) ;
 * iPhone/Safari n'en a pas, on explique « Partager → Sur l'écran d'accueil ».
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferred: any = null;
  canPrompt = false;

  readonly isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  readonly isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
  readonly isMobile = window.matchMedia?.('(max-width: 767.98px)').matches ?? false;

  constructor(zone: NgZone) {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      zone.run(() => { this.deferred = e; this.canPrompt = true; });
    });
    window.addEventListener('appinstalled', () => zone.run(() => { this.deferred = null; this.canPrompt = false; }));
  }

  /** Bandeau proposé sur téléphone, hors application installée, sauf s'il a été fermé il y a moins de 14 jours. */
  get shouldOffer(): boolean {
    if (this.isStandalone || !this.isMobile || !(this.canPrompt || this.isIos)) return false;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return Date.now() - at > 14 * 86_400_000;
    } catch {
      return true;
    }
  }

  async install(): Promise<boolean> {
    if (!this.deferred) return false;
    this.deferred.prompt();
    const choice = await this.deferred.userChoice.catch(() => null);
    this.deferred = null;
    this.canPrompt = false;
    return choice?.outcome === 'accepted';
  }

  dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { }
  }
}
