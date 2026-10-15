import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { NavbarComponent } from './shared/components/navbar.component';
import { SidebarComponent } from './shared/components/sidebar.component';
import { AuthService } from './core/services/auth.service';
import { UiChromeService } from './core/services/ui-chrome.service';
import { CommonModule } from '@angular/common';
import { DialogHostComponent } from './shared/components/dialog-host.component';
import { OfflineService } from './core/services/offline.service';
import { ScrollService } from './core/services/scroll.service';
import { BottomNavComponent } from './shared/components/bottom-nav.component';
import { InstallBannerComponent } from './shared/components/install-banner.component';

/** Pages affichées sans menu, même connecté : connexion et vérification publique d'un document. */
function isStandalonePage(url: string): boolean {
  return url.startsWith('/auth') || url.startsWith('/verification');
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NavbarComponent, SidebarComponent, BottomNavComponent, InstallBannerComponent,
            CommonModule, DialogHostComponent],
  template: `
    <!-- Les pages /auth (connexion…) et /verification (QR code) s'affichent toujours sans le menu du tableau de bord -->
    <ng-container *ngIf="authService.isAuthenticated && !(isAuthPage$ | async); else publicLayout">
      <ng-container *ngIf="!(uiChrome.hidden$ | async)">
        <app-navbar></app-navbar>
        <app-sidebar></app-sidebar>
        <!-- Téléphone : onglets en bas et proposition d'installer l'application -->
        <app-bottom-nav></app-bottom-nav>
        <app-install-banner></app-install-banner>
      </ng-container>
      <main class="main-content fade-in-up" [class.main-content-full]="uiChrome.hidden$ | async">
        <div *ngIf="!(offline.online$ | async)" class="alert alert-warning d-flex align-items-center gap-2 py-2 mb-3" role="status">
          <i class="bi bi-wifi-off"></i>
          <span class="flex-grow-1">Vous êtes hors connexion. Les cours téléchargés restent disponibles ; votre progression sera envoyée au retour de la connexion.</span>
          <a routerLink="/courses/my-learning" class="btn btn-sm btn-outline-dark">Mes cours</a>
        </div>
        <router-outlet></router-outlet>
      </main>
    </ng-container>
    <ng-template #publicLayout>
      <router-outlet></router-outlet>
    </ng-template>
    <app-dialog-host></app-dialog-host>
  `
})
export class AppComponent {
  readonly isAuthPage$ = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(e => isStandalonePage(e.urlAfterRedirects)),
    startWith(isStandalonePage(location.pathname))
  );

  constructor(public authService: AuthService, public uiChrome: UiChromeService, private router: Router,
              public offline: OfflineService, _scroll: ScrollService) {}
}
