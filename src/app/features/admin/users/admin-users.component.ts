import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, PagerMap } from '../../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../core/services/dialog.service';
import { CreateAccountDialogComponent, CreatedAccount } from './create-account-dialog.component';

interface AppUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  specialization: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: string;
  registrationStatus: string;
  enabled: boolean;
  createdAt: string;
  birthDate?: string | null;
  birthPlace?: string | null;
  level?: string | null;
  subjects?: string | null;
}

interface UserGroup {
  key: string;
  label: string;
  users: AppUser[];
}

const NO_LEVEL = '__none__';
const NO_SUBJECT = '__none__';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink, FormsModule],
  template: `
    <div class="fade-in-up">

      <!-- En-tête -->
      <div class="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <a routerLink="/dashboard" class="btn btn-outline-secondary btn-sm" aria-label="Retour"><i class="bi bi-arrow-left"></i></a>
        <div class="flex-grow-1">
          <h1 class="fw-bold mb-0">Membres de la plateforme</h1>
          <p class="text-muted mb-0">Étudiants groupés par niveau, professeurs groupés par matière</p>
        </div>
        <button class="btn btn-primary fw-semibold px-3" (click)="openCreate()">
          <i class="bi bi-person-plus me-2"></i>Créer un compte
        </button>
      </div>

      <!-- Chiffres clés -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-icon"><i class="bi bi-mortarboard"></i></div>
            <div class="stat-value">{{ students.length }}</div><div class="stat-label">Étudiants</div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-icon"><i class="bi bi-person-video3"></i></div>
            <div class="stat-value">{{ teachers.length }}</div><div class="stat-label">Professeurs</div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card"><div class="stat-icon"><i class="bi bi-diagram-3"></i></div>
            <div class="stat-value">{{ subjectCount }}</div><div class="stat-label">Matières enseignées</div></div>
        </div>
        <div class="col-6 col-md-3">
          <a routerLink="/admin/paiements" class="text-decoration-none">
            <div class="stat-card"><div class="stat-icon"><i class="bi bi-cash-coin"></i></div>
              <div class="stat-value">{{ pendingCount }}</div><div class="stat-label">Paiements à vérifier</div></div>
          </a>
        </div>
      </div>

      <!-- Onglets, recherche et filtre de groupe -->
      <div class="card mb-4" style="border-radius:14px">
        <div class="card-body p-3">
          <div class="d-flex align-items-center gap-3 flex-wrap">
            <div class="btn-group" role="tablist" aria-label="Type de membres">
              <button type="button" class="btn" role="tab" [attr.aria-selected]="activeTab === 'students'"
                      [class.btn-primary]="activeTab === 'students'" [class.btn-light]="activeTab !== 'students'"
                      (click)="setTab('students')">
                <i class="bi bi-mortarboard me-1"></i>Étudiants <span class="ms-1 opacity-75">{{ students.length }}</span>
              </button>
              <button type="button" class="btn" role="tab" [attr.aria-selected]="activeTab === 'teachers'"
                      [class.btn-primary]="activeTab === 'teachers'" [class.btn-light]="activeTab !== 'teachers'"
                      (click)="setTab('teachers')">
                <i class="bi bi-person-video3 me-1"></i>Professeurs <span class="ms-1 opacity-75">{{ teachers.length }}</span>
              </button>
            </div>
            <div class="flex-grow-1" style="min-width:220px">
              <div class="input-group">
                <span class="input-group-text bg-white"><i class="bi bi-search text-muted"></i></span>
                <input type="search" class="form-control" [(ngModel)]="searchQuery"
                       [placeholder]="activeTab === 'students' ? 'Rechercher un étudiant (nom, email, lieu de naissance…)' : 'Rechercher un professeur (nom, email, matière…)'"
                       aria-label="Rechercher">
              </div>
            </div>
          </div>

          <!-- Filtre rapide : un niveau ou une matière -->
          <div class="d-flex flex-wrap gap-2 mt-3" role="group" [attr.aria-label]="activeTab === 'students' ? 'Filtrer par niveau' : 'Filtrer par matière'">
            <button type="button" class="chip" [class.active]="!groupFilter" (click)="groupFilter = ''">Tous</button>
            <button type="button" *ngFor="let g of allGroups" class="chip" [class.active]="groupFilter === g.key" (click)="groupFilter = g.key">
              {{ g.label }} <span class="chip-count">{{ g.users.length }}</span>
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>

      <div *ngIf="!loading && visibleGroups.length === 0" class="text-center py-5">
        <div style="font-size:3rem" class="text-muted"><i class="bi" [ngClass]="activeTab === 'students' ? 'bi-mortarboard' : 'bi-person-video3'"></i></div>
        <h5 class="mt-3 fw-bold">Aucun {{ activeTab === 'students' ? 'étudiant' : 'professeur' }} trouvé</h5>
        <p class="text-muted">{{ searchQuery ? 'Aucun résultat pour « ' + searchQuery + ' ».' : 'Créez un premier compte avec le bouton « Créer un compte ».' }}</p>
      </div>

      <!-- Groupes -->
      <div *ngFor="let g of visibleGroups" class="card mb-3 group-card">
        <button type="button" class="group-head" (click)="toggleGroup(g.key)" [attr.aria-expanded]="!collapsed[g.key]">
          <i class="bi" [ngClass]="collapsed[g.key] ? 'bi-chevron-right' : 'bi-chevron-down'"></i>
          <span class="group-title">{{ g.label }}</span>
          <span class="group-count">{{ g.users.length }} {{ activeTab === 'students' ? 'étudiant' : 'professeur' }}{{ g.users.length > 1 ? 's' : '' }}</span>
        </button>

        <div *ngIf="!collapsed[g.key]" class="table-responsive">
          <table class="table align-middle mb-0 members-table" [class.students]="activeTab === 'students'" [class.teachers]="activeTab === 'teachers'">
            <thead>
              <tr *ngIf="activeTab === 'students'">
                <th>Nom et prénom</th><th>Email</th><th>Naissance</th><th>Filière</th><th>Statut</th><th class="text-end">Action</th>
              </tr>
              <tr *ngIf="activeTab === 'teachers'">
                <th>Nom et prénom</th><th>Email</th><th>Matières</th><th>Statut</th><th class="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of g.users | paginate: userPages.get(g.key).page : userPages.get(g.key).size">
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <span class="avatar">{{ u.firstName.charAt(0) }}{{ u.lastName.charAt(0) }}</span>
                    <span class="fw-semibold">{{ u.lastName }} {{ u.firstName }}</span>
                  </div>
                </td>
                <td class="text-muted small">{{ u.email }}</td>
                <td *ngIf="activeTab === 'students'" class="small">
                  {{ u.birthDate ? (u.birthDate | date:'dd/MM/yyyy') : '—' }}<span *ngIf="u.birthPlace" class="text-muted"> · {{ u.birthPlace }}</span>
                </td>
                <td *ngIf="activeTab === 'students'" class="small">{{ getSpecialization(u.specialization) || '—' }}</td>
                <td *ngIf="activeTab === 'teachers'">
                  <span *ngFor="let m of subjectList(u.subjects)" class="subject-tag">{{ m }}</span>
                  <span *ngIf="!subjectList(u.subjects).length" class="text-muted small">—</span>
                </td>
                <td>
                  <span class="status" [class.off]="!u.enabled"><i class="bi bi-circle-fill me-1"></i>{{ u.enabled ? 'Actif' : 'Désactivé' }}</span>
                </td>
                <td class="text-end">
                  <button type="button" class="btn btn-sm" [class.btn-outline-danger]="u.enabled" [class.btn-outline-primary]="!u.enabled"
                          [disabled]="processing[u.id]" (click)="toggleAccount(u)">
                    <span *ngIf="processing[u.id]" class="spinner-border spinner-border-sm me-1"></span>
                    {{ u.enabled ? 'Désactiver' : 'Réactiver' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <app-pagination [pager]="userPages.get(g.key)" [total]="g.users.length"></app-pagination>
      </div>
    </div>
  `,
  styles: [`
    .chip { border: 1px solid var(--border); background: var(--surface); color: var(--dark); border-radius: 999px; padding: 4px 12px; font-size: .85rem; font-weight: 500; }
    .chip:hover { border-color: var(--dark); }
    .chip.active { background: var(--dark); border-color: var(--dark); color: #fff; }
    .chip-count { opacity: .65; margin-left: 2px; }
    .group-card { border-radius: 14px; overflow: hidden; }
    .group-head {
      width: 100%; display: flex; align-items: center; gap: 10px; padding: 14px 18px; border: 0; background: var(--gray-50);
      border-bottom: 1px solid var(--border); text-align: left;
    }
    .group-title { font-weight: 700; font-size: 1rem; color: var(--dark); }
    .group-count { margin-left: auto; color: var(--muted); font-size: .85rem; }
    .members-table thead th { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); background: var(--surface); white-space: nowrap; }
    .members-table { table-layout: fixed; min-width: 860px; }
    .members-table td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .members-table.teachers td:nth-child(3) { white-space: normal; }
    /* Colonnes identiques d'un groupe à l'autre */
    .members-table.students th:nth-child(1) { width: 26%; } .members-table.students th:nth-child(2) { width: 24%; }
    .members-table.students th:nth-child(3) { width: 20%; } .members-table.students th:nth-child(4) { width: 13%; }
    .members-table.students th:nth-child(5) { width: 9%; }  .members-table.students th:nth-child(6) { width: 8%; }
    .members-table.teachers th:nth-child(1) { width: 26%; } .members-table.teachers th:nth-child(2) { width: 24%; }
    .members-table.teachers th:nth-child(3) { width: 33%; } .members-table.teachers th:nth-child(4) { width: 9%; }
    .members-table.teachers th:nth-child(5) { width: 8%; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--dark); color: #fff; font-size: .75rem; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .subject-tag { display: inline-block; margin: 2px 4px 2px 0; padding: 2px 8px; border-radius: 6px; font-size: .75rem;
      background: var(--gray-100); border: 1px solid var(--border); color: var(--dark); }
    .status { font-size: .8rem; color: var(--success); }
    .status.off { color: var(--danger); }
    .status i { font-size: .5rem; vertical-align: middle; }
  `]
})
export class AdminUsersComponent implements OnInit {
  /** Pagination des listes. */
  userPages = new PagerMap(10);
  activeTab: 'students' | 'teachers' = 'students';
  students: AppUser[] = [];
  teachers: AppUser[] = [];
  searchQuery = '';
  groupFilter = '';
  loading = true;
  pendingCount = 0;
  processing: Record<number, boolean> = {};
  collapsed: Record<string, boolean> = {};

  readonly levels = ['L1', 'L2', 'L3', 'M1', 'M2'];
  private readonly specializationLabels: Record<string, string> = {
    'genie-logiciel': 'Génie Logiciel', 'reseau': 'Réseaux', 'comptabilite': 'Comptabilité', 'sante': 'Santé',
    'marketing-digital': 'Marketing Digital', 'developpement-personnel': 'Développement Personnel'
  };

  constructor(private http: HttpClient, private dialogs: DialogService) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    let done = 0;
    const check = () => { if (++done === 3) this.loading = false; };
    this.http.get<AppUser[]>('/api/admin/users/students').subscribe({ next: d => { this.students = d; check(); }, error: () => check() });
    this.http.get<AppUser[]>('/api/admin/users/teachers').subscribe({ next: d => { this.teachers = d; check(); }, error: () => check() });
    this.http.get<unknown[]>('/api/admin/scolarite/payments', { params: { status: 'PENDING' } })
      .subscribe({ next: d => { this.pendingCount = d.length; check(); }, error: () => check() });
  }

  setTab(tab: 'students' | 'teachers') {
    this.activeTab = tab;
    this.groupFilter = '';
  }

  // ── Groupes ─────────────────────────────────────────────────────────────

  /** Tous les groupes de l'onglet (niveaux ou matières), après la recherche. */
  get allGroups(): UserGroup[] {
    const q = this.searchQuery.trim().toLowerCase();
    const matches = (u: AppUser) => !q || [u.firstName, u.lastName, u.email, u.birthPlace, u.level, u.subjects,
      this.getSpecialization(u.specialization)].some(v => (v || '').toLowerCase().includes(q));
    return this.activeTab === 'students'
      ? this.groupStudents(this.students.filter(matches))
      : this.groupTeachers(this.teachers.filter(matches));
  }

  get visibleGroups(): UserGroup[] {
    return this.allGroups.filter(g => !this.groupFilter || g.key === this.groupFilter);
  }

  get subjectCount(): number {
    return new Set(this.teachers.flatMap(t => this.subjectList(t.subjects).map(s => s.toLowerCase()))).size;
  }

  /** Étudiants par niveau, dans l'ordre L1 → M2, puis ceux sans niveau. */
  private groupStudents(list: AppUser[]): UserGroup[] {
    const groups: UserGroup[] = this.levels.map(l => ({ key: l, label: this.levelLabel(l), users: [] as AppUser[] }));
    const none: UserGroup = { key: NO_LEVEL, label: 'Niveau non renseigné', users: [] };
    for (const u of list) {
      const g = groups.find(x => x.key === (u.level || '').toUpperCase());
      (g || none).users.push(u);
    }
    return [...groups, none].filter(g => g.users.length).map(g => ({ ...g, users: this.sortByName(g.users) }));
  }

  /** Professeurs par matière (un professeur apparaît dans chacune de ses matières), par ordre alphabétique. */
  private groupTeachers(list: AppUser[]): UserGroup[] {
    const map = new Map<string, UserGroup>();
    const none: UserGroup = { key: NO_SUBJECT, label: 'Matière non renseignée', users: [] };
    for (const t of list) {
      const subjects = this.subjectList(t.subjects);
      if (!subjects.length) { none.users.push(t); continue; }
      for (const s of subjects) {
        const key = s.toLowerCase();
        if (!map.has(key)) map.set(key, { key, label: s, users: [] });
        map.get(key)!.users.push(t);
      }
    }
    const groups = [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    return [...groups, none].filter(g => g.users.length).map(g => ({ ...g, users: this.sortByName(g.users) }));
  }

  private sortByName(users: AppUser[]): AppUser[] {
    return [...users].sort((a, b) => (a.lastName + ' ' + a.firstName).localeCompare(b.lastName + ' ' + b.firstName, 'fr'));
  }

  levelLabel(level: string): string {
    return ({ L1: 'Licence 1 (L1)', L2: 'Licence 2 (L2)', L3: 'Licence 3 (L3)', M1: 'Master 1 (M1)', M2: 'Master 2 (M2)' } as Record<string, string>)[level] || level;
  }

  toggleGroup(key: string) {
    this.collapsed[key] = !this.collapsed[key];
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  openCreate() {
    this.dialogs.open<CreatedAccount>(CreateAccountDialogComponent, { title: 'Créer un compte', icon: 'bi-person-plus', size: 'md' })
      .afterClosed.then(res => {
        if (!res) return;
        const user = res.user as AppUser;
        if (user.role === 'ROLE_TEACHER') { this.teachers = [user, ...this.teachers]; this.setTab('teachers'); }
        else { this.students = [user, ...this.students]; this.setTab('students'); }
        if (res.emailSent) this.dialogs.toast(res.message);
        else this.dialogs.alert({ title: 'Compte créé', message: res.message, icon: 'bi-envelope-exclamation', tone: 'warning' });
      });
  }

  toggleAccount(u: AppUser) {
    this.processing[u.id] = true;
    const action = u.enabled ? 'disable' : 'enable';
    this.http.post(`/api/admin/users/${u.id}/${action}`, {}).subscribe({
      next: () => {
        u.enabled = !u.enabled;
        this.processing[u.id] = false;
        this.dialogs.toast(u.enabled ? 'Compte réactivé' : 'Compte désactivé', u.enabled ? 'success' : 'info');
      },
      error: () => { this.processing[u.id] = false; this.dialogs.toast('Action impossible pour le moment.', 'danger'); }
    });
  }

  subjectList(subjects: string | null | undefined): string[] {
    return (subjects || '').split(/[,;]/).map(m => m.trim()).filter(Boolean);
  }

  getSpecialization(s: string | null): string {
    return s ? (this.specializationLabels[s] || s) : '';
  }
}
