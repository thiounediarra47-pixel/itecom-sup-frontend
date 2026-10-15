import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpContext } from '@angular/common/http';
import { CommonModule, Location } from '@angular/common';
import { Subscription, filter, timer } from 'rxjs';
import { SILENT_ERRORS } from '../../core/interceptors/error.interceptor';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';

interface PageTitle { title: string; subtitle: string; }

interface AppNotification { id: number; title: string; message: string; link: string | null; category: string; read: boolean; createdAt: string; }

const CATEGORY_ICONS: Record<string, string> = {
  PAIEMENT: 'bi-cash-coin', NOTES: 'bi-journal-text', ATTESTATION: 'bi-patch-check', INSCRIPTION: 'bi-person-vcard', INFO: 'bi-megaphone'
};

/** Titre affiché dans l'en-tête selon l'URL (préfixe le plus long d'abord). */
const PAGE_TITLES: [string, PageTitle][] = [
  ['/dashboard', { title: 'Accueil', subtitle: 'Tableau de bord' }],
  ['/courses/my-learning', { title: 'Mes cours', subtitle: 'Cours suivis' }],
  ['/courses/*/learn', { title: 'Cours', subtitle: 'Leçons' }],
  ['/courses/*', { title: 'Cours', subtitle: 'Présentation' }],
  ['/courses', { title: 'Cours', subtitle: 'Catalogue des formations' }],
  ['/my-exams', { title: 'Examens', subtitle: 'Mes examens en ligne' }],
  ['/qcm', { title: 'Devoirs', subtitle: 'Mes devoirs' }],
  ['/virtual-class', { title: 'Classes virtuelles', subtitle: 'Sessions en direct' }],
  ['/virtual-class/*/attendance', { title: 'Rapport de présence', subtitle: 'Classes virtuelles' }],
  ['/profile', { title: 'Mon profil', subtitle: 'Informations personnelles' }],
  ['/teacher/courses', { title: 'Mes cours', subtitle: 'Espace professeur' }],
  ['/teacher/courses/*/progress', { title: 'Suivi des étudiants', subtitle: 'Mes cours' }],
  ['/teacher/create-course', { title: 'Créer un cours', subtitle: 'Espace professeur' }],
  ['/teacher/exams', { title: 'Devoirs et examens', subtitle: 'Espace professeur' }],
  ['/teacher/qcms', { title: 'Devoirs et examens', subtitle: 'Espace professeur' }],
  ['/teacher/students', { title: 'Étudiants et notes', subtitle: 'Espace professeur' }],
  ['/admin/users', { title: 'Étudiants et professeurs', subtitle: 'Administration' }],
  ['/admin/scolarite', { title: 'Scolarité', subtitle: 'Administration' }],
  ['/admin/paiements', { title: 'Paiements', subtitle: 'Administration' }],
  ['/scolarite', { title: 'Ma scolarité', subtitle: 'Frais, notes et attestations' }],
  ['/library', { title: 'Bibliothèque', subtitle: 'Ressources' }],
  ['/references', { title: 'Références', subtitle: 'Ressources' }]
];

/** Pages ouvertes depuis les onglets ou le menu : pas de bouton retour sur téléphone. */
const ROOT_PAGES = ['/dashboard', '/courses', '/courses/my-learning', '/qcm', '/my-exams', '/scolarite', '/virtual-class',
  '/library', '/references', '/profile', '/teacher/courses', '/teacher/exams', '/teacher/students', '/teacher/create-course',
  '/admin/scolarite', '/admin/paiements', '/admin/users'];

/** Préfixe d'URL, « * » remplaçant un segment (ex. un identifiant). */
function matchesPrefix(path: string, prefix: string): boolean {
  const p = path.split('/'), q = prefix.split('/');
  if (p.length < q.length) return false;
  return q.every((seg, i) => seg === '*' || seg === p[i]);
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="app-header">
      <!-- Téléphone : retour sur les pages secondaires, logo sur les pages principales (menu complet : onglet « Plus ») -->
      <button *ngIf="!isRootPage" type="button" class="header-icon-btn header-back d-md-none" (click)="back()" aria-label="Retour">
        <i class="bi bi-chevron-left"></i>
      </button>
      <span *ngIf="isRootPage" class="header-brand d-md-none" aria-hidden="true"><i class="bi bi-mortarboard-fill"></i></span>

      <div class="header-title" [class.header-title-hidden]="hideTitle">
        <h1>{{ page.title }}</h1>
        <span>{{ page.subtitle }}</span>
      </div>

      <div class="header-actions">
        <div class="dropdown">
          <button type="button" class="header-icon-btn" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Notifications"
                  (click)="loadNotifications()">
            <i class="bi bi-bell"></i>
            <span *ngIf="badgeCount > 0" class="header-dot">{{ badgeCount > 9 ? '9+' : badgeCount }}</span>
          </button>
          <div class="dropdown-menu dropdown-menu-end header-menu" style="width:360px;max-width:92vw">
            <div class="header-menu-title d-flex justify-content-between align-items-center">
              <span>Notifications</span>
              <button *ngIf="unreadCount > 0" type="button" class="btn btn-link btn-sm p-0 text-decoration-none" (click)="markAllRead($event)">Tout marquer comme lu</button>
            </div>
            <a *ngIf="pendingCount > 0" class="dropdown-item d-flex gap-2 align-items-start" routerLink="/admin/paiements">
              <i class="bi bi-cash-coin mt-1"></i>
              <span>{{ pendingCount }} paiement{{ pendingCount > 1 ? 's' : '' }} à vérifier</span>
            </a>
            <div style="max-height:380px;overflow-y:auto">
              <button *ngFor="let n of notifications" type="button" class="dropdown-item d-flex gap-2 align-items-start text-wrap"
                      [class.fw-semibold]="!n.read" (click)="openNotification(n)">
                <i class="bi mt-1" [ngClass]="icon(n.category)" [class.text-primary]="!n.read"></i>
                <span class="flex-grow-1">
                  <span class="d-block">{{ n.title }}</span>
                  <span class="d-block small text-muted fw-normal">{{ n.message }}</span>
                  <span class="d-block small text-muted fw-normal">{{ n.createdAt | date:'dd/MM HH:mm' }}</span>
                </span>
              </button>
            </div>
            <div *ngIf="pendingCount === 0 && notifications.length === 0" class="px-3 py-2 small text-muted">Aucune notification</div>
          </div>
        </div>

        <div class="dropdown">
          <button type="button" class="header-user" data-bs-toggle="dropdown" aria-expanded="false">
            <span class="header-user-text d-none d-sm-flex">
              <span class="header-user-name">{{ authService.currentUser?.firstName }} {{ authService.currentUser?.lastName }}</span>
              <span class="header-user-role">{{ roleLabel }}</span>
            </span>
            <span class="header-avatar">{{ initials }}</span>
            <i class="bi bi-chevron-down header-caret"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end header-menu">
            <li class="px-3 py-2 d-sm-none">
              <div class="fw-semibold">{{ authService.currentUser?.firstName }} {{ authService.currentUser?.lastName }}</div>
              <div class="small text-muted">{{ roleLabel }}</div>
            </li>
            <li><a class="dropdown-item" routerLink="/profile"><i class="bi bi-person me-2"></i>Mon profil</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><button type="button" class="dropdown-item text-danger" (click)="logout()">
              <i class="bi bi-box-arrow-right me-2"></i>Déconnexion</button></li>
          </ul>
        </div>
      </div>
    </header>
  `
})
export class NavbarComponent implements OnInit, OnDestroy {
  page: PageTitle = PAGE_TITLES[0][1];
  isRootPage = true;
  /** Téléphone : le titre de l'en-tête n'apparaît qu'une fois le grand titre de la page sorti de l'écran (comme iOS). */
  hideTitle = false;
  private navigations = 0;
  pendingCount = 0;
  unreadCount = 0;
  notifications: AppNotification[] = [];
  private poll?: Subscription;

  constructor(public authService: AuthService, public layout: LayoutService,
              private router: Router, private http: HttpClient, private location: Location) {}

  get initials(): string {
    const u = this.authService.currentUser;
    return `${u?.firstName?.charAt(0) ?? ''}${u?.lastName?.charAt(0) ?? ''}`.toUpperCase();
  }

  get roleLabel(): string {
    return this.authService.isAdmin ? 'Administrateur' : this.authService.isTeacher ? 'Professeur' : 'Étudiant';
  }

  ngOnInit() {
    this.updateTitle(this.router.url);
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.updateTitle(e.urlAfterRedirects));

    if (this.authService.isAdmin) {
      // Paiements mobiles des étudiants en attente de vérification
      this.http.get<unknown[]>('/api/admin/scolarite/payments', { params: { status: 'PENDING' } }).subscribe({
        next: res => this.pendingCount = res.length,
        error: () => {}
      });
    }
    // Nombre de notifications non lues, rafraîchi chaque minute
    this.poll = timer(0, 60_000).subscribe(() => this.loadUnreadCount());
  }

  ngOnDestroy() { this.poll?.unsubscribe(); }

  get badgeCount(): number { return this.pendingCount + this.unreadCount; }

  icon(category: string): string { return CATEGORY_ICONS[category] ?? 'bi-bell'; }

  private loadUnreadCount() {
    if (!this.authService.isAuthenticated) return;
    this.http.get<{ count: number }>('/api/notifications/unread-count', { context: new HttpContext().set(SILENT_ERRORS, true) })
      .subscribe({ next: r => this.unreadCount = r.count, error: () => {} });
  }

  loadNotifications() {
    this.http.get<AppNotification[]>('/api/notifications', { context: new HttpContext().set(SILENT_ERRORS, true) })
      .subscribe({ next: n => this.notifications = n, error: () => {} });
  }

  openNotification(n: AppNotification) {
    if (!n.read) {
      n.read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.http.post(`/api/notifications/${n.id}/read`, {}).subscribe({ error: () => {} });
    }
    if (n.link) this.router.navigateByUrl(n.link);
  }

  markAllRead(event: Event) {
    event.stopPropagation();
    this.http.post('/api/notifications/read-all', {}).subscribe(() => {
      this.unreadCount = 0;
      this.notifications.forEach(n => n.read = true);
    });
  }

  @HostListener('window:scroll')
  updateTitleVisibility() {
    if (!window.matchMedia('(max-width: 767.98px)').matches) { this.hideTitle = false; return; }
    const pageTitle = document.querySelector('.main-content h1');
    this.hideTitle = !!pageTitle && pageTitle.getBoundingClientRect().bottom > 60;
  }

  /** Retour à la page précédente de l'application, sinon à l'accueil. */
  back() {
    if (this.navigations > 1) this.location.back();
    else this.router.navigateByUrl('/dashboard');
  }

  private updateTitle(url: string) {
    const path = url.split(/[?#]/)[0];
    this.navigations++;
    this.isRootPage = ROOT_PAGES.includes(path);
    // Le contenu de la page arrive après la navigation : on vérifie à nouveau peu après
    [0, 300, 1000].forEach(ms => setTimeout(() => this.updateTitleVisibility(), ms));
    const match = [...PAGE_TITLES].sort((a, b) => b[0].length - a[0].length)
      .find(([prefix]) => matchesPrefix(path, prefix));
    this.page = match ? match[1] : { title: 'ITECOM', subtitle: 'E-learning' };
  }

  logout() { this.authService.logout(); }
}
