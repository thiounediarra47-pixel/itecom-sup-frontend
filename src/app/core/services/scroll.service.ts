import { Injectable, NgZone } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Défilement de l'application, comme dans une application mobile :
 * - une nouvelle page s'ouvre en haut ; un retour arrière retrouve la position de lecture
 *   (même si le contenu arrive après coup du serveur) ;
 * - popups et menu ouverts : la page derrière ne bouge plus (y compris sur iPhone) ;
 * - l'onglet actif d'une barre d'onglets horizontale reste visible.
 */
@Injectable({ providedIn: 'root' })
export class ScrollService {
  private readonly positions = new Map<string, number>();
  private trigger: 'imperative' | 'popstate' | 'hashchange' = 'imperative';
  private restoreTimer: ReturnType<typeof setInterval> | null = null;
  private locks = 0;
  private lastPath = location.pathname;
  private lockedAt = 0;

  constructor(private router: Router, private zone: NgZone) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    router.events.pipe(filter((e): e is NavigationStart => e instanceof NavigationStart)).subscribe(e => {
      this.positions.set(this.key(router.url), this.locks ? this.lockedAt : window.scrollY);
      this.trigger = e.navigationTrigger ?? 'imperative';
    });
    router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(e => {
      const path = e.urlAfterRedirects.split(/[?#]/)[0];
      const samePage = path === this.lastPath;
      this.lastPath = path;
      const saved = this.positions.get(this.key(e.urlAfterRedirects));
      if (this.trigger === 'popstate' && saved) this.restore(saved);
      // Même page (changement d'onglet ou de filtre dans l'adresse) : on ne bouge pas
      else if (!samePage && !e.urlAfterRedirects.includes('#')) this.scrollTop(false);
      setTimeout(() => this.revealActiveTabs(), 50);
    });

    // Onglets horizontaux : l'onglet touché est ramené au centre de la barre
    zone.runOutsideAngular(() => document.addEventListener('click', ev => {
      const tab = (ev.target as HTMLElement)?.closest?.('.school-tabs .nav-link, .chip-scroll > *');
      if (tab) setTimeout(() => (tab as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }), 0);
    }));
  }

  scrollTop(smooth = true) {
    this.stopRestore();
    window.scrollTo({ top: 0, left: 0, behavior: smooth ? 'smooth' : 'auto' });
  }

  /**
   * Bloque le défilement de la page (popup, menu) : position figée en « fixed », la seule méthode
   * qui fonctionne aussi sur Safari iPhone ; on revient exactement au même endroit à la fermeture.
   */
  lock() {
    if (this.locks++ > 0) return;
    this.lockedAt = window.scrollY;
    const s = document.body.style;
    s.position = 'fixed';
    s.top = `-${this.lockedAt}px`;
    s.left = '0';
    s.right = '0';
    s.overflow = 'hidden';
    document.body.classList.add('scroll-locked');
  }

  unlock() {
    if (this.locks === 0 || --this.locks > 0) return;
    const s = document.body.style;
    s.position = s.top = s.left = s.right = s.overflow = '';
    document.body.classList.remove('scroll-locked');
    window.scrollTo(0, this.lockedAt);
  }

  /** Une même page (sans les paramètres d'onglet) garde sa position. */
  private key(url: string): string {
    return url.split('#')[0];
  }

  /** Le contenu arrive du serveur après la navigation : on réessaie jusqu'à pouvoir atteindre la position. */
  private restore(y: number) {
    this.stopRestore();
    const started = Date.now();
    const userScrolled = () => this.stopRestore();
    this.zone.runOutsideAngular(() => {
      window.addEventListener('touchstart', userScrolled, { once: true, passive: true });
      window.addEventListener('wheel', userScrolled, { once: true, passive: true });
      const attempt = () => {
        window.scrollTo(0, y);
        if (Math.abs(window.scrollY - y) < 2 || Date.now() - started > 3000) this.stopRestore();
      };
      attempt();
      this.restoreTimer = setInterval(attempt, 100);
    });
  }

  private stopRestore() {
    if (this.restoreTimer) clearInterval(this.restoreTimer);
    this.restoreTimer = null;
  }

  private revealActiveTabs() {
    document.querySelectorAll<HTMLElement>('.school-tabs .nav-link.active').forEach(el => {
      const bar = el.closest<HTMLElement>('.school-tabs');
      if (bar) bar.scrollLeft = el.offsetLeft - (bar.clientWidth - el.clientWidth) / 2;
    });
  }
}
