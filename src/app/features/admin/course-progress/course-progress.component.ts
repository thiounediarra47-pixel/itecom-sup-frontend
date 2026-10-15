import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BarChartComponent, BarDatum } from '../../../shared/components/bar-chart.component';

interface LessonInfo { id: number; title: string; orderIndex: number | null; }
interface LessonProgress { lessonId: number; completed: boolean; percentage: number; timeSpentSeconds: number; }
interface StudentProgress {
  id: number; firstName: string; lastName: string; email: string; level: string | null;
  completedLessons: number; percentage: number; timeSpentSeconds: number; lastActivity: string | null;
  lessons: LessonProgress[];
}
interface CourseProgress { courseId: number; courseTitle: string; totalLessons: number; lessons: LessonInfo[]; students: StudentProgress[]; }

type SortKey = 'name' | 'progress' | 'time' | 'activity';

/** Suivi d'un cours : progression et temps passé de chaque étudiant (vue professeur). */
@Component({
  selector: 'app-course-progress',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, FormsModule, RouterLink, BarChartComponent],
  styles: [`
    .cp-title { font-size: 1.5rem; font-weight: 700; color: #1f2a5c; margin: 0; }
    .cp-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
    .cp-card { background: var(--surface); border: 1px solid var(--surface-border); border-radius: 16px; padding: 1.5rem; height: 100%; }
    .cp-card-title { font-size: 1.1rem; font-weight: 700; color: #1f2a5c; margin-bottom: .25rem; }
    .cp-card-sub { font-size: .82rem; color: var(--muted); margin-bottom: 1.1rem; }
    .cp-table th { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 700; white-space: nowrap; }
    .cp-table td { vertical-align: middle; font-size: .9rem; }
    .cp-row { cursor: pointer; }
    .cp-row:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
    .cp-bar { height: 8px; border-radius: 4px; background: var(--surface-muted); overflow: hidden; min-width: 90px; }
    .cp-bar > div { height: 100%; background: var(--primary); border-radius: 4px; }
    .cp-detail td { background: var(--surface-muted) !important; }
    .cp-lesson { display: flex; align-items: center; gap: .6rem; padding: .3rem 0; font-size: .85rem; }
    .cp-lesson i { width: 1rem; }
    .cp-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--navy); color: #fff; font-weight: 700; font-size: .8rem;
                 display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  `],
  template: `
    <div class="fade-in-up">
      <div class="d-flex align-items-center gap-3 mb-4">
        <a routerLink="/teacher/courses" class="btn btn-outline-secondary btn-sm" title="Retour à mes cours"><i class="bi bi-arrow-left"></i></a>
        <div class="min-w-0">
          <h2 class="cp-title text-truncate">{{ data?.courseTitle || 'Suivi du cours' }}</h2>
          <div class="text-muted small">Progression et temps passé par les étudiants</div>
        </div>
      </div>

      <div *ngIf="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
      <div *ngIf="!loading && error" class="alert alert-danger">{{ error }}</div>

      <ng-container *ngIf="!loading && data">
        <!-- Indicateurs -->
        <section class="cp-kpis mb-4">
          <div class="kpi-card">
            <div class="kpi-card-label">Étudiants suivis</div>
            <div class="kpi-card-value">{{ data.students.length }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card-label">Progression moyenne</div>
            <div class="kpi-card-value">{{ avgProgress }}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card-label">Cours terminé</div>
            <div class="kpi-card-value">{{ finishedCount }}</div>
            <div class="small text-muted mt-1">étudiant(s) à 100 %</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card-label">Temps total</div>
            <div class="kpi-card-value">{{ formatDuration(totalSeconds) }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card-label">Temps moyen / étudiant</div>
            <div class="kpi-card-value">{{ formatDuration(avgSeconds) }}</div>
          </div>
        </section>

        <div *ngIf="data.students.length === 0" class="cp-card text-center text-muted py-5 mb-4">
          <i class="bi bi-people" style="font-size:2.5rem"></i>
          <p class="mt-2 mb-0">Aucun étudiant n'est encore inscrit à ce cours.</p>
        </div>

        <ng-container *ngIf="data.students.length > 0">
          <!-- Graphiques -->
          <section class="row g-4 mb-4">
            <div class="col-12 col-xl-6">
              <div class="cp-card">
                <div class="cp-card-title">Progression par étudiant</div>
                <div class="cp-card-sub">{{ chartSubtitle('Pourcentage de leçons terminées') }}</div>
                <app-bar-chart orientation="horizontal" [data]="progressChart" unit="%" [maxValue]="100"
                               labelHeader="Étudiant" valueHeader="Progression"></app-bar-chart>
              </div>
            </div>
            <div class="col-12 col-xl-6">
              <div class="cp-card">
                <div class="cp-card-title">Temps passé par étudiant</div>
                <div class="cp-card-sub">{{ chartSubtitle('En minutes, sur l\\'ensemble du cours') }}</div>
                <app-bar-chart orientation="horizontal" [data]="timeChart" unit=" min"
                               labelHeader="Étudiant" valueHeader="Minutes"
                               emptyText="Aucun temps enregistré pour le moment"></app-bar-chart>
              </div>
            </div>
            <div class="col-12 col-xl-6">
              <div class="cp-card">
                <div class="cp-card-title">Répartition des étudiants</div>
                <div class="cp-card-sub">Nombre d'étudiants par tranche de progression</div>
                <app-bar-chart orientation="vertical" [data]="distributionChart"
                               labelHeader="Progression" valueHeader="Étudiants"></app-bar-chart>
              </div>
            </div>
            <div class="col-12 col-xl-6">
              <div class="cp-card">
                <div class="cp-card-title">Temps passé par leçon</div>
                <div class="cp-card-sub">Total de tous les étudiants, en minutes</div>
                <app-bar-chart orientation="vertical" [data]="lessonTimeChart" unit=" min"
                               labelHeader="Leçon" valueHeader="Minutes"
                               emptyText="Aucune leçon dans ce cours"></app-bar-chart>
              </div>
            </div>
          </section>

          <!-- Tableau détaillé -->
          <section class="cp-card">
            <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
              <div class="cp-card-title mb-0">Détail par étudiant</div>
              <div class="d-flex gap-2 flex-wrap">
                <input type="search" class="form-control form-control-sm" style="min-width:220px"
                       placeholder="Rechercher un étudiant…" [(ngModel)]="search" aria-label="Rechercher un étudiant">
                <select class="form-select form-select-sm" style="width:auto" [(ngModel)]="sortKey" aria-label="Trier">
                  <option value="name">Trier par nom</option>
                  <option value="progress">Trier par progression</option>
                  <option value="time">Trier par temps passé</option>
                  <option value="activity">Trier par dernière activité</option>
                </select>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table cp-table mb-0">
                <thead>
                  <tr>
                    <th>Étudiant</th>
                    <th>Niveau</th>
                    <th style="min-width:180px">Progression</th>
                    <th class="text-end">Leçons</th>
                    <th class="text-end">Temps passé</th>
                    <th>Dernière activité</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <ng-container *ngFor="let s of visibleStudents | paginate: studentsPg.page : studentsPg.size">
                    <tr class="cp-row" tabindex="0" (click)="toggle(s.id)" (keydown.enter)="toggle(s.id)"
                        [attr.aria-expanded]="expandedId === s.id">
                      <td>
                        <div class="d-flex align-items-center gap-2">
                          <span class="cp-avatar">{{ initials(s) }}</span>
                          <div class="min-w-0">
                            <div class="fw-semibold text-truncate">{{ s.firstName }} {{ s.lastName }}</div>
                            <div class="small text-muted text-truncate">{{ s.email }}</div>
                          </div>
                        </div>
                      </td>
                      <td><span *ngIf="s.level" class="badge-level">{{ s.level }}</span><span *ngIf="!s.level" class="text-muted">—</span></td>
                      <td>
                        <div class="d-flex align-items-center gap-2">
                          <div class="cp-bar flex-grow-1"><div [style.width.%]="s.percentage"></div></div>
                          <span class="fw-semibold small" style="min-width:42px;text-align:right">{{ round(s.percentage) }}%</span>
                        </div>
                      </td>
                      <td class="text-end">{{ s.completedLessons }}/{{ data.totalLessons }}</td>
                      <td class="text-end">{{ formatDuration(s.timeSpentSeconds) }}</td>
                      <td class="text-muted small">{{ s.lastActivity ? formatDate(s.lastActivity) : 'Jamais' }}</td>
                      <td class="text-end"><i class="bi" [ngClass]="expandedId === s.id ? 'bi-chevron-up' : 'bi-chevron-down'"></i></td>
                    </tr>
                    <tr *ngIf="expandedId === s.id" class="cp-detail">
                      <td colspan="7">
                        <div class="row g-1 px-2 py-1">
                          <div class="col-12 col-md-6" *ngFor="let l of data.lessons; let i = index">
                            <div class="cp-lesson">
                              <i class="bi" [ngClass]="lessonOf(s, l.id)?.completed ? 'bi-check-circle-fill text-primary' : 'bi-circle text-muted'"></i>
                              <span class="flex-grow-1 text-truncate">{{ i + 1 }}. {{ l.title }}</span>
                              <span class="text-muted small">{{ formatDuration(lessonOf(s, l.id)?.timeSpentSeconds || 0) }}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </ng-container>
                  <tr *ngIf="visibleStudents.length === 0">
                    <td colspan="7" class="text-center text-muted py-4">Aucun étudiant ne correspond à la recherche.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <app-pagination [pager]="studentsPg" [total]="visibleStudents.length"></app-pagination>
          </section>
        </ng-container>
      </ng-container>
    </div>
  `
})
export class CourseProgressComponent implements OnInit {
  /** Pagination des listes. */
  studentsPg = new Pager(20);
  private static readonly CHART_LIMIT = 10;

  data: CourseProgress | null = null;
  loading = true;
  error = '';
  search = '';
  sortKey: SortKey = 'name';
  expandedId: number | null = null;

  progressChart: BarDatum[] = [];
  timeChart: BarDatum[] = [];
  distributionChart: BarDatum[] = [];
  lessonTimeChart: BarDatum[] = [];

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<CourseProgress>(`/api/teacher/courses/${id}/students-progress`).subscribe({
      next: d => { this.data = d; this.buildCharts(); this.loading = false; },
      error: e => {
        this.error = e?.error?.message || 'Impossible de charger le suivi de ce cours.';
        this.loading = false;
      }
    });
  }

  get students(): StudentProgress[] { return this.data?.students ?? []; }
  get totalSeconds(): number { return this.students.reduce((s, x) => s + x.timeSpentSeconds, 0); }
  get avgSeconds(): number { return this.students.length ? Math.round(this.totalSeconds / this.students.length) : 0; }
  get avgProgress(): number {
    return this.students.length ? Math.round(this.students.reduce((s, x) => s + x.percentage, 0) / this.students.length) : 0;
  }
  get finishedCount(): number { return this.students.filter(s => s.percentage >= 100).length; }

  get visibleStudents(): StudentProgress[] {
    const q = this.search.trim().toLowerCase();
    const list = this.students.filter(s => !q
      || `${s.firstName} ${s.lastName} ${s.email} ${s.level || ''}`.toLowerCase().includes(q));
    const byName = (a: StudentProgress, b: StudentProgress) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr');
    const sorters: Record<SortKey, (a: StudentProgress, b: StudentProgress) => number> = {
      name: byName,
      progress: (a, b) => b.percentage - a.percentage || byName(a, b),
      time: (a, b) => b.timeSpentSeconds - a.timeSpentSeconds || byName(a, b),
      activity: (a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || '') || byName(a, b)
    };
    return [...list].sort(sorters[this.sortKey]);
  }

  chartSubtitle(base: string): string {
    return this.students.length > CourseProgressComponent.CHART_LIMIT
      ? `${base} — les ${CourseProgressComponent.CHART_LIMIT} premiers (tous dans le tableau ci-dessous)`
      : base;
  }

  private buildCharts() {
    const name = (s: StudentProgress) => `${s.firstName} ${s.lastName}`.trim() || s.email;
    const limit = CourseProgressComponent.CHART_LIMIT;

    this.progressChart = [...this.students].sort((a, b) => b.percentage - a.percentage).slice(0, limit)
      .map(s => ({ label: name(s), value: this.round(s.percentage) }));

    const withTime = this.students.filter(s => s.timeSpentSeconds > 0);
    this.timeChart = [...withTime].sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds).slice(0, limit)
      .map(s => ({ label: name(s), value: toMinutes(s.timeSpentSeconds) }));

    const buckets: [string, (p: number) => boolean][] = [
      ['0 %', p => p <= 0],
      ['1–24 %', p => p > 0 && p < 25],
      ['25–49 %', p => p >= 25 && p < 50],
      ['50–74 %', p => p >= 50 && p < 75],
      ['75–99 %', p => p >= 75 && p < 100],
      ['100 %', p => p >= 100]
    ];
    this.distributionChart = buckets.map(([label, test]) => ({ label, value: this.students.filter(s => test(s.percentage)).length }));

    this.lessonTimeChart = (this.data?.lessons ?? []).map((l, i) => ({
      label: `${i + 1}. ${l.title}`,
      value: toMinutes(this.students.reduce((sum, s) => sum + (this.lessonOf(s, l.id)?.timeSpentSeconds || 0), 0))
    }));
  }

  toggle(id: number) { this.expandedId = this.expandedId === id ? null : id; }

  lessonOf(s: StudentProgress, lessonId: number): LessonProgress | undefined {
    return s.lessons.find(l => l.lessonId === lessonId);
  }

  initials(s: StudentProgress): string {
    return `${s.firstName?.charAt(0) ?? ''}${s.lastName?.charAt(0) ?? ''}`.toUpperCase() || '?';
  }

  round(v: number): number { return Math.round(v); }

  formatDuration(seconds: number): string {
    if (!seconds) return '0 min';
    if (seconds < 60) return '< 1 min';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

function toMinutes(seconds: number): number {
  return Math.round(seconds / 6) / 10;
}
