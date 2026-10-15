import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BarChartComponent, BarDatum } from '../../shared/components/bar-chart.component';

/** Réponse de GET /api/admin/dashboard */
interface CourseStats { total: number; published: number; lessons: number; enrolledStudents: number; activeStudents: number; averageProgress: number; timeSpentSeconds: number; }
interface CourseReport { id: number; title: string; teacher: string | null; level: string | null; category: string | null; published: boolean; lessons: number; enrolled: number; active: number; completed: number; averageProgress: number; timeSpentSeconds: number; }
interface FollowedStudent { id: number; firstName: string; lastName: string; email: string; level: string | null; courses: number; completedLessons: number; averageProgress: number; timeSpentSeconds: number; lastActivity: string | null; }
interface ExamStats { devoirs: number; devoirsPublished: number; examens: number; examensPublished: number; expectedCopies: number; submittedCopies: number; averageOn20: number | null; passRate: number | null; }
interface ExamReport { id: number; type: string; title: string; teacher: string | null; status: string | null; createdAt: string | null; assigned: number; submitted: number; averageOn20: number | null; passRate: number | null; }
interface LevelReport { level: string; evaluations: number; assigned: number; submitted: number; excluded: number; averageOn20: number | null; passRate: number | null; best: number | null; worst: number | null; }
interface AdminDashboard {
  courses: CourseStats; courseReports: CourseReport[]; followedStudents: FollowedStudent[];
  exams: ExamStats; examReports: ExamReport[]; levelReports: LevelReport[];
}

type Tab = 'courses' | 'students' | 'exams' | 'levels';

const STATUS_LABELS: Record<string, string> = { PUBLISHED: 'Publié', DRAFT: 'Brouillon', CLOSED: 'Clôturé' };

/** Statistiques de l'administrateur : cours en ligne, étudiants suivis, examens et rapports par niveau. */
@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, FormsModule, RouterLink, BarChartComponent],
  styles: [`
    .as-card { background: var(--surface); border-radius: 16px; border: 1px solid var(--surface-border); }
    .as-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; padding: 1.25rem 1.5rem .5rem; }
    .as-title { font-size: 1.2rem; font-weight: 700; color: #1f2a5c; margin: 0; }
    .as-tabs { display: flex; flex-wrap: wrap; gap: .4rem; padding: 0 1.5rem; border-bottom: 1px solid var(--surface-border); }
    .as-tab {
      border: 0; background: none; padding: .7rem .9rem; font-weight: 600; color: #6b7280;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .as-tab.active { color: #1f2d7a; border-bottom-color: #1f2d7a; }
    .as-body { padding: 1.25rem 1.5rem 1.5rem; }
    .as-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .75rem; margin-bottom: 1.25rem; }
    .as-kpi { border: 1px solid var(--surface-border); border-radius: 12px; padding: .85rem 1rem; }
    .as-kpi-label { font-size: .72rem; font-weight: 700; letter-spacing: .08em; color: #6b7280; text-transform: uppercase; }
    .as-kpi-value { font-size: 1.6rem; font-weight: 800; color: #1f2a5c; font-variant-numeric: tabular-nums; }
    .as-kpi-hint { font-size: .75rem; color: #6b7280; }
    .as-table { font-size: .9rem; }
    .as-table th { font-size: .72rem; letter-spacing: .06em; text-transform: uppercase; color: #6b7280; white-space: nowrap; }
    .as-table td { vertical-align: middle; font-variant-numeric: tabular-nums; }
    .as-bar { height: 6px; border-radius: 3px; background: var(--surface-muted); min-width: 70px; overflow: hidden; }
    .as-bar > span { display: block; height: 100%; background: #2b3ea8; }
    .as-sub { font-size: .82rem; color: #6b7280; margin-bottom: 1rem; }
    .as-search { max-width: 280px; }
  `],
  template: `
    <section class="as-card mb-4">
      <div class="as-head">
        <h2 class="as-title"><i class="bi bi-bar-chart-line me-2"></i>Statistiques de la plateforme</h2>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="load()" [disabled]="loading">
          <i class="bi bi-arrow-clockwise me-1"></i>Actualiser
        </button>
      </div>
      <nav class="as-tabs" role="tablist">
        <button *ngFor="let t of tabs" type="button" class="as-tab" role="tab" [class.active]="tab === t.key"
                [attr.aria-selected]="tab === t.key" (click)="tab = t.key">
          <i class="bi me-1" [ngClass]="t.icon"></i>{{ t.label }}
        </button>
      </nav>

      <div class="as-body">
        <div *ngIf="loading" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Chargement…</div>
        <div *ngIf="error && !loading" class="alert alert-danger mb-0">{{ error }}</div>

        <ng-container *ngIf="data && !loading">
          <!-- ── Cours en ligne ─────────────────────────────────────── -->
          <ng-container *ngIf="tab === 'courses'">
            <div class="as-kpis">
              <div class="as-kpi"><div class="as-kpi-label">Cours</div><div class="as-kpi-value">{{ data.courses.total }}</div>
                <div class="as-kpi-hint">{{ data.courses.published }} publié(s)</div></div>
              <div class="as-kpi"><div class="as-kpi-label">Leçons</div><div class="as-kpi-value">{{ data.courses.lessons }}</div></div>
              <div class="as-kpi"><div class="as-kpi-label">Étudiants inscrits</div><div class="as-kpi-value">{{ data.courses.enrolledStudents }}</div>
                <div class="as-kpi-hint">{{ data.courses.activeStudents }} actif(s)</div></div>
              <div class="as-kpi"><div class="as-kpi-label">Progression moyenne</div><div class="as-kpi-value">{{ pct(data.courses.averageProgress) }}</div></div>
              <div class="as-kpi"><div class="as-kpi-label">Temps d'apprentissage</div><div class="as-kpi-value">{{ duration(data.courses.timeSpentSeconds) }}</div></div>
            </div>
            <h3 class="h6 fw-bold mb-1">Rapport de chaque cours</h3>
            <div class="as-sub">Inscrits, étudiants actifs, cours terminés et progression moyenne.</div>
            <div class="table-responsive">
              <table class="table table-hover as-table mb-0">
                <thead><tr><th>Cours</th><th>Professeur</th><th>Niveau</th><th class="text-end">Leçons</th><th class="text-end">Inscrits</th>
                  <th class="text-end">Actifs</th><th class="text-end">Terminé</th><th>Progression</th><th class="text-end">Temps</th><th></th></tr></thead>
                <tbody>
                  <tr *ngFor="let c of data.courseReports | paginate: coursesPg.page : coursesPg.size">
                    <td class="fw-semibold">{{ c.title }}
                      <span *ngIf="!c.published" class="badge text-bg-light border ms-1">Brouillon</span></td>
                    <td>{{ c.teacher || '—' }}</td>
                    <td>{{ c.level || '—' }}</td>
                    <td class="text-end">{{ c.lessons }}</td>
                    <td class="text-end">{{ c.enrolled }}</td>
                    <td class="text-end">{{ c.active }}</td>
                    <td class="text-end">{{ c.completed }}</td>
                    <td><div class="d-flex align-items-center gap-2"><div class="as-bar flex-grow-1"><span [style.width.%]="c.averageProgress"></span></div>{{ pct(c.averageProgress) }}</div></td>
                    <td class="text-end">{{ duration(c.timeSpentSeconds) }}</td>
                    <td class="text-end"><a [routerLink]="['/teacher/courses', c.id, 'progress']" class="btn btn-sm btn-outline-primary" title="Suivi détaillé"><i class="bi bi-eye"></i></a></td>
                  </tr>
                  <tr *ngIf="!data.courseReports.length"><td colspan="10" class="text-center text-muted py-3">Aucun cours</td></tr>
                </tbody>
              </table>
            </div>
            <app-pagination [pager]="coursesPg" [total]="data.courseReports.length"></app-pagination>
          </ng-container>

          <!-- ── Étudiants suivis ───────────────────────────────────── -->
          <ng-container *ngIf="tab === 'students'">
            <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
              <div>
                <h3 class="h6 fw-bold mb-1">Étudiants suivis</h3>
                <div class="as-sub mb-0">{{ data.followedStudents.length }} étudiant(s) inscrit(s) à au moins un cours en ligne.</div>
              </div>
              <input type="search" class="form-control form-control-sm as-search" placeholder="Rechercher un étudiant…" [(ngModel)]="studentQuery">
            </div>
            <div class="table-responsive">
              <table class="table table-hover as-table mb-0">
                <thead><tr><th>Étudiant</th><th>Niveau</th><th class="text-end">Cours</th><th class="text-end">Leçons terminées</th>
                  <th>Progression</th><th class="text-end">Temps</th><th>Dernière activité</th></tr></thead>
                <tbody>
                  <tr *ngFor="let s of filteredStudents | paginate: studentsPg.page : studentsPg.size">
                    <td><div class="fw-semibold">{{ s.lastName }} {{ s.firstName }}</div><div class="small text-muted">{{ s.email }}</div></td>
                    <td>{{ s.level || '—' }}</td>
                    <td class="text-end">{{ s.courses }}</td>
                    <td class="text-end">{{ s.completedLessons }}</td>
                    <td><div class="d-flex align-items-center gap-2"><div class="as-bar flex-grow-1"><span [style.width.%]="s.averageProgress"></span></div>{{ pct(s.averageProgress) }}</div></td>
                    <td class="text-end">{{ duration(s.timeSpentSeconds) }}</td>
                    <td>{{ s.lastActivity ? (s.lastActivity | date:'dd/MM/yyyy HH:mm') : 'Jamais' }}</td>
                  </tr>
                  <tr *ngIf="!filteredStudents.length"><td colspan="7" class="text-center text-muted py-3">Aucun étudiant</td></tr>
                </tbody>
              </table>
            </div>
            <app-pagination [pager]="studentsPg" [total]="filteredStudents.length"></app-pagination>
          </ng-container>

          <!-- ── Examens ────────────────────────────────────────────── -->
          <ng-container *ngIf="tab === 'exams'">
            <div class="as-kpis">
              <div class="as-kpi"><div class="as-kpi-label">Devoirs</div><div class="as-kpi-value">{{ data.exams.devoirs }}</div>
                <div class="as-kpi-hint">{{ data.exams.devoirsPublished }} publié(s)</div></div>
              <div class="as-kpi"><div class="as-kpi-label">Examens</div><div class="as-kpi-value">{{ data.exams.examens }}</div>
                <div class="as-kpi-hint">{{ data.exams.examensPublished }} publié(s)</div></div>
              <div class="as-kpi"><div class="as-kpi-label">Copies rendues</div><div class="as-kpi-value">{{ data.exams.submittedCopies }}</div>
                <div class="as-kpi-hint">sur {{ data.exams.expectedCopies }} attendue(s)</div></div>
              <div class="as-kpi"><div class="as-kpi-label">Moyenne générale</div><div class="as-kpi-value">{{ note(data.exams.averageOn20) }}</div></div>
              <div class="as-kpi"><div class="as-kpi-label">Taux de réussite</div><div class="as-kpi-value">{{ pct(data.exams.passRate) }}</div>
                <div class="as-kpi-hint">Copies ≥ 10/20</div></div>
            </div>
            <div class="table-responsive">
              <table class="table table-hover as-table mb-0">
                <thead><tr><th>Type</th><th>Titre</th><th>Professeur</th><th>Statut</th><th>Créé le</th><th class="text-end">Rendues</th>
                  <th class="text-end">Moyenne</th><th class="text-end">Réussite</th><th></th></tr></thead>
                <tbody>
                  <tr *ngFor="let e of data.examReports | paginate: examsPg.page : examsPg.size">
                    <td><span class="badge" [ngClass]="e.type === 'Devoir' ? 'text-bg-primary' : 'text-bg-secondary'">{{ e.type }}</span></td>
                    <td class="fw-semibold">{{ e.title }}</td>
                    <td>{{ e.teacher || '—' }}</td>
                    <td>{{ statusLabel(e.status) }}</td>
                    <td>{{ e.createdAt ? (e.createdAt | date:'dd/MM/yyyy') : '—' }}</td>
                    <td class="text-end">{{ e.submitted }} / {{ e.assigned }}</td>
                    <td class="text-end">{{ note(e.averageOn20) }}</td>
                    <td class="text-end">{{ pct(e.passRate) }}</td>
                    <td class="text-end">
                      <a [routerLink]="e.type === 'Devoir' ? ['/teacher/qcms', e.id, 'resultats'] : ['/teacher/exams', e.id]"
                         class="btn btn-sm btn-outline-primary" title="Voir les résultats"><i class="bi bi-eye"></i></a>
                    </td>
                  </tr>
                  <tr *ngIf="!data.examReports.length"><td colspan="9" class="text-center text-muted py-3">Aucun devoir ni examen</td></tr>
                </tbody>
              </table>
            </div>
            <app-pagination [pager]="examsPg" [total]="data.examReports.length"></app-pagination>
          </ng-container>

          <!-- ── Rapports par niveau ────────────────────────────────── -->
          <ng-container *ngIf="tab === 'levels'">
            <div class="row g-4">
              <div class="col-12 col-xl-5">
                <h3 class="h6 fw-bold mb-1">Moyenne par niveau</h3>
                <div class="as-sub">Note moyenne sur 20 des copies notées (devoirs et examens).</div>
                <app-bar-chart orientation="vertical" [data]="levelChart" unit="" [maxValue]="20"
                               labelHeader="Niveau" valueHeader="Moyenne /20" emptyText="Aucune copie notée"></app-bar-chart>
              </div>
              <div class="col-12 col-xl-7">
                <h3 class="h6 fw-bold mb-1">Rapport des examens par niveau</h3>
                <div class="as-sub">Niveau déclaré par l'étudiant au début du devoir, sinon celui de son compte.</div>
                <div class="table-responsive">
                  <table class="table table-hover as-table mb-0">
                    <thead><tr><th>Niveau</th><th class="text-end">Évaluations</th><th class="text-end">Rendues</th><th class="text-end">Moyenne</th>
                      <th class="text-end">Réussite</th><th class="text-end">Meilleure</th><th class="text-end">Plus basse</th><th class="text-end">Exclus</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let l of data.levelReports">
                        <td class="fw-semibold">{{ l.level }}</td>
                        <td class="text-end">{{ l.evaluations }}</td>
                        <td class="text-end">{{ l.submitted }} / {{ l.assigned }}</td>
                        <td class="text-end">{{ note(l.averageOn20) }}</td>
                        <td class="text-end">{{ pct(l.passRate) }}</td>
                        <td class="text-end">{{ note(l.best) }}</td>
                        <td class="text-end">{{ note(l.worst) }}</td>
                        <td class="text-end">{{ l.excluded }}</td>
                      </tr>
                      <tr *ngIf="!data.levelReports.length"><td colspan="8" class="text-center text-muted py-3">Aucune donnée</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ng-container>
        </ng-container>
      </div>
    </section>
  `
})
export class AdminStatsComponent implements OnInit {
  /** Pagination des listes. */
  coursesPg = new Pager(10);
  studentsPg = new Pager(20);
  examsPg = new Pager(10);
  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'courses', label: 'Cours en ligne', icon: 'bi-play-btn' },
    { key: 'students', label: 'Étudiants suivis', icon: 'bi-people' },
    { key: 'exams', label: 'Examens', icon: 'bi-clipboard-check' },
    { key: 'levels', label: 'Rapports par niveau', icon: 'bi-layers' }
  ];
  tab: Tab = 'courses';
  data: AdminDashboard | null = null;
  loading = true;
  error = '';
  studentQuery = '';
  levelChart: BarDatum[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.error = '';
    this.http.get<AdminDashboard>('/api/admin/dashboard').subscribe({
      next: d => {
        this.data = d;
        this.levelChart = d.levelReports.filter(l => l.averageOn20 != null)
          .map(l => ({ label: l.level, value: l.averageOn20! }));
        this.loading = false;
      },
      error: () => { this.error = 'Impossible de charger les statistiques.'; this.loading = false; }
    });
  }

  get filteredStudents(): FollowedStudent[] {
    const list = this.data?.followedStudents ?? [];
    const q = this.studentQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(s => `${s.lastName} ${s.firstName} ${s.email} ${s.level ?? ''}`.toLowerCase().includes(q));
  }

  statusLabel(status: string | null): string { return status ? STATUS_LABELS[status] ?? status : '—'; }

  note(v: number | null): string { return v == null ? '—' : `${v.toFixed(1).replace('.', ',')}/20`; }

  pct(v: number | null): string { return v == null ? '—' : `${Math.round(v)}%`; }

  duration(seconds: number): string {
    if (!seconds) return '0 min';
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
  }
}
