import { Component, OnDestroy, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BarChartComponent, BarDatum } from '../../shared/components/bar-chart.component';

interface Segment { joinedAt: string; leftAt: string | null; durationSeconds: number; online: boolean; }
interface Participant {
  name: string | null; email: string; enrolled: boolean; status: 'PRESENT' | 'ABSENT';
  late: boolean; leftEarly: boolean; online: boolean;
  firstJoinAt: string | null; lastLeaveAt: string | null; totalSeconds: number; connections: number;
  rollCallsAnswered: number;
  segments: Segment[];
}
interface AttendanceReport {
  classId: number; title: string; courseTitle: string | null; teacherName: string | null;
  scheduledAt: string | null; durationMinutes: number | null; scheduledEndAt: string | null; status: string;
  enrolledCount: number; presentCount: number; absentCount: number; lateCount: number; leftEarlyCount: number;
  attendanceRate: number; averageSeconds: number;
  teacher: Participant | null; students: Participant[];
  rollCalls: { startedAt: string; answered: number }[];
}
type Filter = 'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY';

/** Rapport de présence d'une séance de classe virtuelle (professeur de la séance et admin). */
@Component({
  selector: 'app-virtual-class-attendance',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, FormsModule, RouterLink, BarChartComponent],
  styles: [`
    .va-title { font-size: 1.5rem; font-weight: 700; color: #1f2a5c; margin: 0; }
    .va-meta { display: flex; flex-wrap: wrap; gap: .4rem 1.25rem; font-size: .88rem; color: var(--muted); }
    .va-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; }
    .va-card { background: var(--surface); border: 1px solid var(--surface-border); border-radius: 16px; padding: 1.5rem; height: 100%; }
    .va-card-title { font-size: 1.1rem; font-weight: 700; color: #1f2a5c; margin-bottom: .25rem; }
    .va-card-sub { font-size: .82rem; color: var(--muted); margin-bottom: 1.1rem; }
    .va-table th { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 700; white-space: nowrap; }
    .va-table td { vertical-align: middle; font-size: .9rem; }
    .va-row { cursor: pointer; }
    .va-row:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
    .va-flag { display: inline-block; font-size: .7rem; font-weight: 600; padding: .15em .55em; border-radius: 999px;
               border: 1px solid var(--surface-border); color: var(--gray-800); background: var(--surface-raised); margin-left: .25rem; }
    .va-online { display: inline-flex; align-items: center; gap: .3rem; font-size: .75rem; color: var(--success); font-weight: 600; }
    .va-online::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--success); }
    .va-timeline { position: relative; height: 14px; min-width: 160px; border-radius: 4px; background: var(--surface-muted); overflow: hidden; }
    .va-timeline .va-window { position: absolute; top: 0; bottom: 0; border-left: 1px dashed #9aa0ad; border-right: 1px dashed #9aa0ad; }
    .va-timeline .va-seg { position: absolute; top: 2px; bottom: 2px; background: var(--primary); border-radius: 3px; min-width: 2px; }
    .va-timeline .va-seg.live { background: var(--primary-dark); }
    .va-axis { display: flex; justify-content: space-between; font-size: .7rem; color: var(--muted); margin-top: 2px; }
    .va-detail td { background: var(--surface-muted) !important; }
    .va-teacher { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem 1rem; }
  `],
  template: `
    <div class="fade-in-up">
      <div class="d-flex align-items-start gap-3 mb-3">
        <a routerLink="/virtual-class" class="btn btn-outline-secondary btn-sm mt-1" title="Retour aux classes virtuelles"><i class="bi bi-arrow-left"></i></a>
        <div class="flex-grow-1 min-w-0">
          <h2 class="va-title text-truncate">{{ report?.title || 'Rapport de présence' }}</h2>
          <div class="va-meta mt-1" *ngIf="report">
            <span *ngIf="report.scheduledAt"><i class="bi bi-calendar3 me-1"></i>{{ fmtDate(report.scheduledAt) }}</span>
            <span *ngIf="report.scheduledAt"><i class="bi bi-clock me-1"></i>{{ fmtTime(report.scheduledAt) }} – {{ fmtTime(report.scheduledEndAt) }} ({{ report.durationMinutes }} min)</span>
            <span *ngIf="report.courseTitle"><i class="bi bi-book me-1"></i>{{ report.courseTitle }}</span>
            <span *ngIf="report.teacherName"><i class="bi bi-person me-1"></i>{{ report.teacherName }}</span>
          </div>
        </div>
        <button *ngIf="report" type="button" class="btn btn-outline-primary btn-sm mt-1" (click)="downloadExcel()" [disabled]="downloading">
          <span *ngIf="downloading" class="spinner-border spinner-border-sm me-1"></span>
          <i *ngIf="!downloading" class="bi bi-file-earmark-spreadsheet me-1"></i>Exporter (Excel)
        </button>
      </div>

      <div *ngIf="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
      <div *ngIf="!loading && error" class="alert alert-danger">{{ error }}</div>

      <ng-container *ngIf="!loading && report">
        <div *ngIf="report.status === 'ONGOING'" class="alert alert-light border small d-flex align-items-center gap-2 mb-3">
          <span class="va-online">Séance en cours</span> — le rapport se met à jour automatiquement toutes les 30 secondes.
        </div>

        <!-- Professeur -->
        <div class="va-card mb-4 py-3" *ngIf="report.teacher">
          <div class="va-teacher">
            <strong style="color:#1f2a5c"><i class="bi bi-person-video3 me-1"></i>Professeur</strong>
            <span>{{ report.teacherName }}</span>
            <ng-container *ngIf="report.teacher.status === 'PRESENT'; else teacherAbsent">
              <span class="text-muted">connecté de <strong>{{ fmtTime(report.teacher.firstJoinAt) }}</strong>
                à <strong>{{ report.teacher.online ? 'maintenant' : fmtTime(report.teacher.lastLeaveAt) }}</strong>
                · {{ formatDuration(report.teacher.totalSeconds) }}</span>
              <span *ngIf="report.teacher.online" class="va-online">En ligne</span>
            </ng-container>
            <ng-template #teacherAbsent><span class="text-muted">ne s'est pas connecté à cette séance</span></ng-template>
          </div>
          <div class="small mt-2">
            <i class="bi bi-person-raised-hand me-1 text-primary"></i>
            <ng-container *ngIf="report.rollCalls.length; else noCall">
              {{ report.rollCalls.length }} appel(s) :
              <span *ngFor="let c of report.rollCalls; let last = last">{{ fmtTime(c.startedAt) }} ({{ c.answered }} présent(s)){{ last ? '' : ', ' }}</span>
            </ng-container>
            <ng-template #noCall><span class="text-muted">Aucun appel fait pendant la séance.</span></ng-template>
          </div>
        </div>

        <!-- Indicateurs -->
        <section class="va-kpis mb-4">
          <div class="kpi-card"><div class="kpi-card-label">Inscrits</div><div class="kpi-card-value">{{ report.enrolledCount }}</div></div>
          <div class="kpi-card"><div class="kpi-card-label">Présents</div><div class="kpi-card-value">{{ report.presentCount }}</div></div>
          <div class="kpi-card"><div class="kpi-card-label">Absents</div><div class="kpi-card-value">{{ report.absentCount }}</div></div>
          <div class="kpi-card"><div class="kpi-card-label">Taux de présence</div><div class="kpi-card-value">{{ round(report.attendanceRate) }}%</div></div>
          <div class="kpi-card"><div class="kpi-card-label">En retard</div><div class="kpi-card-value">{{ report.lateCount }}</div>
            <div class="small text-muted mt-1">plus de 10 min après le début</div></div>
          <div class="kpi-card"><div class="kpi-card-label">Durée moyenne</div><div class="kpi-card-value">{{ formatDuration(report.averageSeconds) }}</div>
            <div class="small text-muted mt-1">par étudiant présent</div></div>
        </section>

        <!-- Graphiques -->
        <section class="row g-4 mb-4">
          <div class="col-12 col-xl-7">
            <div class="va-card">
              <div class="va-card-title">Temps de connexion par étudiant</div>
              <div class="va-card-sub">En minutes{{ report.durationMinutes ? ', sur ' + report.durationMinutes + ' min prévues' : '' }}</div>
              <app-bar-chart orientation="horizontal" [data]="durationChart" unit=" min" [maxValue]="report.durationMinutes || null"
                             labelHeader="Étudiant" valueHeader="Minutes"
                             emptyText="Aucun étudiant connecté pour le moment"></app-bar-chart>
            </div>
          </div>
          <div class="col-12 col-xl-5">
            <div class="va-card">
              <div class="va-card-title">Bilan de la séance</div>
              <div class="va-card-sub">Nombre d'étudiants par situation</div>
              <app-bar-chart orientation="vertical" [data]="summaryChart" labelHeader="Situation" valueHeader="Étudiants"></app-bar-chart>
            </div>
          </div>
        </section>

        <!-- Tableau -->
        <section class="va-card">
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
            <div class="va-card-title mb-0">Présences détaillées</div>
            <div class="d-flex gap-2 flex-wrap">
              <input type="search" class="form-control form-control-sm" style="min-width:220px"
                     placeholder="Rechercher un étudiant…" [(ngModel)]="search" aria-label="Rechercher un étudiant">
              <select class="form-select form-select-sm" style="width:auto" [(ngModel)]="filter" aria-label="Filtrer">
                <option value="ALL">Tous</option>
                <option value="PRESENT">Présents</option>
                <option value="ABSENT">Absents</option>
                <option value="LATE">En retard</option>
                <option value="EARLY">Partis avant la fin</option>
              </select>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table va-table mb-0">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Statut</th>
                  <th>Connexion</th>
                  <th>Départ</th>
                  <th class="text-end">Durée</th>
                  <th class="text-end">Connexions</th>
                  <th class="text-end" *ngIf="report.rollCalls.length">Appels</th>
                  <th style="min-width:200px">Chronologie</th>
                </tr>
              </thead>
              <tbody>
                <ng-container *ngFor="let p of visibleStudents | paginate: studentsPg.page : studentsPg.size">
                  <tr class="va-row" tabindex="0" (click)="toggle(p.email)" (keydown.enter)="toggle(p.email)" [attr.aria-expanded]="expanded === p.email">
                    <td>
                      <div class="fw-semibold">{{ p.name || p.email }}</div>
                      <div class="small text-muted">{{ p.email }}<span *ngIf="!p.enrolled" class="va-flag">hors liste</span></div>
                    </td>
                    <td class="text-nowrap">
                      <span class="status-badge" [class.status-published]="p.status === 'PRESENT'" [class.status-draft]="p.status === 'ABSENT'">
                        {{ p.status === 'PRESENT' ? 'Présent' : 'Absent' }}
                      </span>
                      <span *ngIf="p.late" class="va-flag">Retard</span>
                      <span *ngIf="p.leftEarly" class="va-flag">Parti tôt</span>
                      <div *ngIf="p.online" class="va-online mt-1">En ligne</div>
                    </td>
                    <td class="text-nowrap">{{ p.firstJoinAt ? fmtTime(p.firstJoinAt) : '—' }}</td>
                    <td class="text-nowrap">{{ p.online ? 'En ligne' : (p.lastLeaveAt ? fmtTime(p.lastLeaveAt) : '—') }}</td>
                    <td class="text-end text-nowrap">{{ p.status === 'PRESENT' ? formatDuration(p.totalSeconds) : '—' }}</td>
                    <td class="text-end">{{ p.connections || '—' }}</td>
                    <td class="text-end text-nowrap" *ngIf="report.rollCalls.length"
                        [class.text-danger]="p.rollCallsAnswered < report.rollCalls.length">{{ p.rollCallsAnswered }} / {{ report.rollCalls.length }}</td>
                    <td>
                      <div class="va-timeline" [attr.aria-label]="'Chronologie de connexion de ' + (p.name || p.email)">
                        <div *ngIf="windowBox" class="va-window" [style.left.%]="windowBox.left" [style.width.%]="windowBox.width"></div>
                        <div *ngFor="let s of p.segments" class="va-seg" [class.live]="s.online"
                             [style.left.%]="pos(s.joinedAt)" [style.width.%]="width(s)"
                             [title]="fmtTime(s.joinedAt) + ' → ' + (s.online ? 'en ligne' : fmtTime(s.leftAt))"></div>
                      </div>
                    </td>
                  </tr>
                  <tr *ngIf="expanded === p.email" class="va-detail">
                    <td [attr.colspan]="report.rollCalls.length ? 8 : 7">
                      <div *ngIf="p.segments.length === 0" class="small text-muted px-2">Aucune connexion à cette séance.</div>
                      <div *ngFor="let s of p.segments; let i = index" class="small px-2 py-1">
                        <strong>Connexion {{ i + 1 }}</strong> : de {{ fmtTime(s.joinedAt) }} à
                        {{ s.online ? 'maintenant (en ligne)' : fmtTime(s.leftAt) }} · {{ formatDuration(s.durationSeconds) }}
                      </div>
                    </td>
                  </tr>
                </ng-container>
                <tr *ngIf="visibleStudents.length === 0">
                  <td [attr.colspan]="report.rollCalls.length ? 8 : 7" class="text-center text-muted py-4">Aucun étudiant pour ce filtre.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <app-pagination [pager]="studentsPg" [total]="visibleStudents.length"></app-pagination>
          <div *ngIf="timelineStart && timelineEnd" class="d-flex justify-content-end mt-2">
            <div class="small text-muted"><i class="bi bi-info-circle me-1"></i>Chronologie de {{ fmtTime(timelineStart) }} à {{ fmtTime(timelineEnd) }} ; pointillés : horaire prévu.</div>
          </div>
        </section>
      </ng-container>
    </div>
  `
})
export class VirtualClassAttendanceComponent implements OnInit, OnDestroy {
  /** Pagination des listes. */
  studentsPg = new Pager(20);
  report: AttendanceReport | null = null;
  loading = true;
  error = '';
  downloading = false;
  search = '';
  filter: Filter = 'ALL';
  expanded: string | null = null;

  durationChart: BarDatum[] = [];
  summaryChart: BarDatum[] = [];
  timelineStart: string | null = null;
  timelineEnd: string | null = null;
  windowBox: { left: number; width: number } | null = null;

  private classId = '';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit() {
    this.classId = this.route.snapshot.paramMap.get('id') || '';
    this.load();
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  private load() {
    this.http.get<AttendanceReport>(`/api/teacher/virtual-classes/${this.classId}/attendance`).subscribe({
      next: r => {
        this.report = r;
        this.error = '';
        this.build();
        this.loading = false;
        if (r.status === 'ONGOING' && !this.refreshTimer) {
          this.refreshTimer = setInterval(() => this.load(), 30000);
        } else if (r.status !== 'ONGOING' && this.refreshTimer) {
          clearInterval(this.refreshTimer);
          this.refreshTimer = null;
        }
      },
      error: e => {
        this.error = e?.error?.message || 'Impossible de charger le rapport de présence.';
        this.loading = false;
      }
    });
  }

  get visibleStudents(): Participant[] {
    const q = this.search.trim().toLowerCase();
    return (this.report?.students ?? []).filter(p => {
      if (q && !`${p.name || ''} ${p.email}`.toLowerCase().includes(q)) return false;
      switch (this.filter) {
        case 'PRESENT': return p.status === 'PRESENT';
        case 'ABSENT': return p.status === 'ABSENT';
        case 'LATE': return p.late;
        case 'EARLY': return p.leftEarly;
        default: return true;
      }
    });
  }

  private build() {
    const r = this.report!;
    this.durationChart = r.students.filter(p => p.status === 'PRESENT')
      .sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, 12)
      .map(p => ({ label: p.name || p.email, value: Math.round(p.totalSeconds / 6) / 10 }));

    const onTime = r.students.filter(p => p.status === 'PRESENT' && !p.late && !p.leftEarly).length;
    this.summaryChart = [
      { label: 'À l\'heure', value: onTime },
      { label: 'En retard', value: r.lateCount },
      { label: 'Partis tôt', value: r.leftEarlyCount },
      { label: 'Absents', value: r.absentCount }
    ];

    // Fenêtre de la chronologie : horaire prévu élargi aux connexions réelles
    const times: number[] = [];
    if (r.scheduledAt) times.push(ts(r.scheduledAt));
    if (r.scheduledEndAt) times.push(ts(r.scheduledEndAt));
    const now = Date.now();
    [...r.students, ...(r.teacher ? [r.teacher] : [])].forEach(p => p.segments.forEach(s => {
      times.push(ts(s.joinedAt));
      times.push(s.online || !s.leftAt ? now : ts(s.leftAt));
    }));
    if (times.length < 2) { this.timelineStart = this.timelineEnd = null; this.windowBox = null; return; }
    const start = Math.min(...times), end = Math.max(...times);
    this.span = { start, end: end > start ? end : start + 60000 };
    this.timelineStart = new Date(this.span.start).toISOString();
    this.timelineEnd = new Date(this.span.end).toISOString();
    this.windowBox = r.scheduledAt && r.scheduledEndAt
      ? { left: this.pctOf(ts(r.scheduledAt)), width: this.pctOf(ts(r.scheduledEndAt)) - this.pctOf(ts(r.scheduledAt)) }
      : null;
  }

  private span = { start: 0, end: 1 };

  private pctOf(t: number): number {
    return Math.max(0, Math.min(100, ((t - this.span.start) / (this.span.end - this.span.start)) * 100));
  }

  pos(iso: string): number { return this.pctOf(ts(iso)); }

  width(s: Segment): number {
    const endT = s.online || !s.leftAt ? Date.now() : ts(s.leftAt);
    return Math.max(0.5, this.pctOf(endT) - this.pctOf(ts(s.joinedAt)));
  }

  toggle(email: string) { this.expanded = this.expanded === email ? null : email; }

  downloadExcel() {
    this.downloading = true;
    this.http.get(`/api/teacher/virtual-classes/${this.classId}/attendance.xlsx`, { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `presences-${slug(this.report?.title || 'seance')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading = false;
      },
      error: () => { this.downloading = false; }
    });
  }

  round(v: number): number { return Math.round(v); }

  formatDuration(seconds: number): string {
    if (!seconds) return '0 min';
    if (seconds < 60) return '< 1 min';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }

  fmtDate(iso: string | null): string {
    return iso ? new Date(ts(iso)).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  }

  fmtTime(iso: string | null): string {
    return iso ? new Date(ts(iso)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
  }
}

/** Les dates du serveur sont sans fuseau (heure locale du serveur) ; les ISO « Z » sont en UTC. */
function ts(iso: string): number { return new Date(iso).getTime(); }

function slug(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'seance';
}
