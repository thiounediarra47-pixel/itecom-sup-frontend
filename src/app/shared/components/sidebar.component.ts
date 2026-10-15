import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserScopeService } from '../../core/services/user-scope.service';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.open]="layout.mobileOpen">
      <div class="sidebar-brand">
        <a routerLink="/dashboard" class="sidebar-logo" (click)="layout.closeMobile()">
          <span class="sidebar-logo-mark"><i class="bi bi-mortarboard-fill"></i></span>
          <span class="sidebar-logo-text">
            <span class="sidebar-logo-name">ITECOM</span>
            <span class="sidebar-logo-sub">E-learning</span>
          </span>
        </a>
        <button type="button" class="sidebar-collapse-btn d-none d-md-inline-flex" (click)="layout.toggleCollapsed()"
                [attr.aria-label]="layout.collapsed ? 'Déplier le menu' : 'Replier le menu'"
                [title]="layout.collapsed ? 'Déplier le menu' : 'Replier le menu'">
          <i class="bi" [ngClass]="layout.collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'"></i>
        </button>
        <button type="button" class="sidebar-collapse-btn d-md-none" (click)="layout.closeMobile()" aria-label="Fermer le menu">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <nav class="sidebar-nav" (click)="layout.closeMobile()">
        <ul class="nav flex-column">
          <li><a class="nav-link" routerLink="/dashboard" routerLinkActive="active" title="Tableau de bord">
            <i class="bi bi-bar-chart-line"></i><span>Tableau de bord</span></a></li>
          <li *ngIf="!authService.isTeacher"><a class="nav-link" routerLink="/courses" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" title="Explorer les cours">
            <i class="bi bi-compass"></i><span>Explorer les cours</span></a></li>
          <li *ngIf="authService.isStudent || authService.isAdmin">
            <a class="nav-link" routerLink="/courses/my-learning" routerLinkActive="active" title="Mon apprentissage">
              <i class="bi bi-mortarboard"></i><span>Mon apprentissage</span></a></li>
          <li *ngIf="authService.isStudent || authService.isAdmin">
            <a class="nav-link" routerLink="/my-exams" routerLinkActive="active" title="Examens en ligne">
              <i class="bi bi-clipboard-check"></i><span>Examens en ligne</span></a></li>
          <li><a class="nav-link" routerLink="/virtual-class" routerLinkActive="active" title="Classes virtuelles">
            <i class="bi bi-camera-video"></i><span>Classes virtuelles</span></a></li>
          <li *ngIf="authService.isStudent">
            <a class="nav-link" routerLink="/scolarite" routerLinkActive="active" title="Ma scolarité">
              <i class="bi bi-wallet2"></i><span>Ma scolarité</span></a></li>

          <ng-container *ngIf="authService.isTeacher || authService.isAdmin">
            <li class="sidebar-heading"><span>Espace professeur</span></li>
            <li><a class="nav-link" routerLink="/teacher/courses" routerLinkActive="active" title="Mes cours">
              <i class="bi bi-collection"></i><span>Mes cours</span></a></li>
            <li><a class="nav-link" routerLink="/teacher/create-course" routerLinkActive="active" title="Créer un cours">
              <i class="bi bi-plus-circle"></i><span>Créer un cours</span></a></li>
            <li><a class="nav-link" routerLink="/teacher/exams" routerLinkActive="active" title="Devoirs et examens">
              <i class="bi bi-journal-check"></i><span>Devoirs et examens</span></a></li>
            <li><a class="nav-link" routerLink="/teacher/students" routerLinkActive="active" title="Étudiants et notes">
              <i class="bi bi-people"></i><span>Étudiants et notes</span></a></li>
          </ng-container>

          <ng-container *ngIf="authService.isAdmin">
            <li class="sidebar-heading"><span>Administration</span></li>
            <li>
              <a class="nav-link" routerLink="/admin/scolarite" routerLinkActive="active" title="Scolarité">
                <i class="bi bi-bank"></i><span>Scolarité</span>
              </a>
            </li>
            <li>
              <a class="nav-link" routerLink="/admin/paiements" routerLinkActive="active" title="Paiements">
                <i class="bi bi-cash-coin"></i><span>Paiements</span>
                <span *ngIf="pendingPayments > 0" class="sidebar-badge">{{ pendingPayments }}</span>
              </a>
            </li>
            <li>
              <a class="nav-link" routerLink="/admin/users" routerLinkActive="active" title="Étudiants et professeurs">
                <i class="bi bi-person-lines-fill"></i><span>Étudiants et professeurs</span>
              </a>
            </li>
          </ng-container>

          <li class="sidebar-heading"><span>Compte</span></li>
          <li><a class="nav-link" routerLink="/profile" routerLinkActive="active" title="Mon profil">
            <i class="bi bi-gear"></i><span>Mon profil</span></a></li>
        </ul>
      </nav>

      <div class="sidebar-footer">
        <button type="button" class="nav-link sidebar-logout" (click)="authService.logout()" title="Déconnexion">
          <i class="bi bi-box-arrow-left"></i><span>Déconnexion</span>
        </button>
      </div>
    </aside>
    <div class="sidebar-backdrop" *ngIf="layout.mobileOpen" (click)="layout.closeMobile()"></div>
  `
})
export class SidebarComponent implements OnInit {
  pendingPayments = 0;

  constructor(public authService: AuthService, public userScope: UserScopeService, private http: HttpClient,
              public layout: LayoutService) {}

  ngOnInit() {
    if (this.authService.isAdmin) {
      this.loadPendingCount();
    }
  }

  loadPendingCount() {
    this.http.get<unknown[]>('/api/admin/scolarite/payments', { params: { status: 'PENDING' } }).subscribe({
      next: (res) => this.pendingPayments = res.length,
      error: () => {}
    });
  }

  /** Visible par les profs/admin, et par les étudiants en filière génie logiciel. */
  get canSeeProjects(): boolean {
    if (this.authService.isTeacher || this.authService.isAdmin) return true;
    return this.authService.currentUser?.specialization === 'genie-logiciel';
  }
}
