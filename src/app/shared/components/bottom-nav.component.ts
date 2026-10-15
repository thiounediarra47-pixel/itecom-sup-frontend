import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { ScrollService } from '../../core/services/scroll.service';

/** icon : contour ; active : icône pleine de l'onglet ouvert (si elle existe dans Bootstrap Icons). */
interface Tab { label: string; icon: string; active?: string; link: string; }

/** Onglets principaux selon le rôle ; « Plus » ouvre le menu complet. */
const TABS: Record<string, Tab[]> = {
  ROLE_STUDENT: [
    { label: 'Accueil', icon: 'bi-house', active: 'bi-house-fill', link: '/dashboard' },
    { label: 'Mes cours', icon: 'bi-play-btn', active: 'bi-play-btn-fill', link: '/courses/my-learning' },
    { label: 'Devoirs', icon: 'bi-journal-check', link: '/qcm' },
    { label: 'Scolarité', icon: 'bi-wallet', active: 'bi-wallet-fill', link: '/scolarite' }
  ],
  ROLE_TEACHER: [
    { label: 'Accueil', icon: 'bi-house', active: 'bi-house-fill', link: '/dashboard' },
    { label: 'Mes cours', icon: 'bi-collection-play', active: 'bi-collection-play-fill', link: '/teacher/courses' },
    { label: 'Devoirs', icon: 'bi-journal-check', link: '/teacher/exams' },
    { label: 'Classes', icon: 'bi-camera-video', active: 'bi-camera-video-fill', link: '/virtual-class' }
  ],
  ROLE_ADMIN: [
    { label: 'Accueil', icon: 'bi-house', active: 'bi-house-fill', link: '/dashboard' },
    { label: 'Scolarité', icon: 'bi-bank', link: '/admin/scolarite' },
    { label: 'Paiements', icon: 'bi-cash-coin', link: '/admin/paiements' },
    { label: 'Membres', icon: 'bi-people', active: 'bi-people-fill', link: '/admin/users' }
  ]
};

/** Barre d'onglets en bas de l'écran sur téléphone, comme une application mobile. */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-nav d-md-none" [class.bottom-nav-hidden]="hidden" aria-label="Navigation principale">
      <a *ngFor="let t of tabs" class="bottom-tab" [routerLink]="t.link" routerLinkActive="active"
         #rla="routerLinkActive" [attr.aria-current]="rla.isActive ? 'page' : null" (click)="onTab(rla.isActive)">
        <i class="bi" [ngClass]="rla.isActive ? (t.active || t.icon) : t.icon"></i>
        <span>{{ t.label }}</span>
      </a>
      <button type="button" class="bottom-tab" [class.active]="layout.mobileOpen" (click)="layout.toggleMobile()"
              [attr.aria-expanded]="layout.mobileOpen">
        <i class="bi bi-grid"></i><span>Plus</span>
      </button>
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 100;
      display: flex; height: calc(var(--tabbar-height) + var(--safe-bottom)); padding-bottom: var(--safe-bottom);
      background: rgba(250, 250, 251, .94); -webkit-backdrop-filter: saturate(180%) blur(14px); backdrop-filter: saturate(180%) blur(14px);
      border-top: 1px solid var(--surface-border);
      transition: transform .22s ease;
    }
    .bottom-nav-hidden { transform: translateY(100%); }
    .bottom-tab {
      flex: 1 1 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
      border: 0; background: none; color: var(--muted); text-decoration: none; font-size: .68rem; font-weight: 600;
      min-width: 0; padding: 6px 2px;
    }
    .bottom-tab i { font-size: 1.35rem; line-height: 1; }
    .bottom-tab span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .bottom-tab.active { color: var(--primary); }
  `]
})
export class BottomNavComponent {
  /** Cachée en lisant vers le bas ou quand le clavier est ouvert ; revient en remontant. */
  hidden = false;
  private lastY = 0;
  private typing = false;

  constructor(public auth: AuthService, public layout: LayoutService, private scroll: ScrollService) {}

  /** Toucher l'onglet déjà ouvert remonte en haut de la page, comme dans une application. */
  onTab(alreadyActive: boolean) {
    this.layout.closeMobile();
    if (alreadyActive) this.scroll.scrollTop();
  }

  @HostListener('window:scroll')
  onScroll() {
    if (document.body.classList.contains('scroll-locked')) return;
    const y = window.scrollY;
    const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 40;
    if (this.typing) this.hidden = true;
    else if (y < 80 || nearBottom) this.hidden = false;
    else if (y > this.lastY + 8) this.hidden = true;
    else if (y < this.lastY - 8) this.hidden = false;
    this.lastY = y;
  }

  private typingWatch: ReturnType<typeof setInterval> | null = null;

  private static isField(el: Element | null): boolean {
    return !!el?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]), textarea, select, [contenteditable]');
  }

  @HostListener('document:focusin', ['$event'])
  onFocusIn(e: FocusEvent) {
    if (!BottomNavComponent.isField(e.target as Element)) return;
    this.typing = true;
    this.hidden = true;
    // Un champ retiré de la page (popup fermée) ne déclenche pas « focusout » : on vérifie régulièrement
    if (!this.typingWatch) {
      this.typingWatch = setInterval(() => {
        if (!BottomNavComponent.isField(document.activeElement)) this.onFocusOut();
      }, 400);
    }
  }

  @HostListener('document:focusout')
  onFocusOut() {
    // La sélection passe peut-être à un autre champ : on regarde juste après
    setTimeout(() => {
      if (BottomNavComponent.isField(document.activeElement)) return;
      this.typing = false;
      this.hidden = false;
      if (this.typingWatch) { clearInterval(this.typingWatch); this.typingWatch = null; }
    });
  }

  get tabs(): Tab[] {
    return TABS[this.auth.currentUser?.role ?? 'ROLE_STUDENT'] ?? TABS['ROLE_STUDENT'];
  }
}
