import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { CourseService } from '../../core/services/course.service';
import { ProgressService } from '../../core/services/progress.service';
import { Course } from '../../core/models/course.model';
import { Progress } from '../../core/models/course.model';
import { COURSE_CATEGORIES } from '../../core/models/course.model';
import { UserScopeService } from '../../core/services/user-scope.service';
import { BarChartComponent, BarDatum } from '../../shared/components/bar-chart.component';
import { AdminStatsComponent } from './admin-stats.component';

/** Devoir vu par un professeur / administrateur (GET /api/teacher/qcms) */
interface StaffQcm { id: number; title: string; status: string; studentCount: number; questionCount: number; createdAt: string | null; }
/** Devoir vu par un étudiant (GET /api/qcm) */
interface StudentQcm { id: number; title: string; alreadyTaken: boolean; score: number | null; maxScore: number | null; createdAt: string | null; }

/** Séance de classe virtuelle (GET /api/virtual-classes) */
interface VirtualClassItem { id: number; title: string; scheduledAt: string; durationMinutes: number; status: string; teacherId: number | null; courseTitle: string | null; }
/** État affiché : SCHEDULED dont l'heure de fin est passée = « non tenue » */
type VcState = 'ONGOING' | 'UPCOMING' | 'MISSED' | 'COMPLETED';

/** `tab` : onglet de la page Classes virtuelles qui liste ces séances */
const VC_STATES: Record<VcState, { label: string; icon: string; color: string; tab: string }> = {
  ONGOING: { label: 'En cours', icon: 'bi-record-circle', color: '#dc2626', tab: 'ongoing' },
  UPCOMING: { label: 'À venir', icon: 'bi-clock', color: '#2b3ea8', tab: 'upcoming' },
  MISSED: { label: 'Non tenue', icon: 'bi-exclamation-circle', color: '#94a3b8', tab: 'past' },
  COMPLETED: { label: 'Terminée', icon: 'bi-check-circle', color: '#16a34a', tab: 'past' }
};

interface Kpi { label: string; value: string | number; link?: string; hint?: string; }
interface TypeOption { value: string; label: string; }

const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BarChartComponent, AdminStatsComponent],
  styles: [`
    :host {
      --db-navy: #1f2d7a; --db-navy-2: #2b3ea8; --db-ink: #1f2a5c; --db-muted: #6b7280;
    }
    .db-hero {
      position: relative; overflow: hidden; border-radius: 20px; padding: 2rem 2.25rem;
      background: var(--db-navy); color: #fff;
    }
    .db-eyebrow { color: rgba(255,255,255,.65); font-weight: 700; font-size: .78rem; letter-spacing: .14em; text-transform: uppercase; }
    .db-hero h1 { font-size: 2.1rem; font-weight: 800; margin: .35rem 0 .6rem; color: #fff; }
    .db-hero p { max-width: 720px; font-size: 1.02rem; line-height: 1.6; color: rgba(255,255,255,.88); margin-bottom: 1.1rem; }
    .db-pill {
      display: inline-flex; align-items: center; gap: .5rem; padding: .45rem 1rem; border-radius: 999px;
      background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); font-weight: 600; font-size: .92rem;
    }

    .db-card { background: var(--surface); border-radius: 16px; border: 1px solid var(--surface-border); }
    .db-filters { padding: 1.25rem 1.5rem; }
    button.db-pill { border: 0; cursor: pointer; font: inherit; }
    .db-pill-caret { font-size: .75rem; margin-left: .35rem; }
    @media (max-width: 767.98px) {
      .db-filters:not(.open) { display: none; }
      .db-filters { padding: 1rem; }
    }
    .db-filters label { font-size: .75rem; font-weight: 700; letter-spacing: .1em; color: var(--db-muted); text-transform: uppercase; margin-bottom: .4rem; }
    .db-filters .form-control, .db-filters .form-select { border-radius: 10px; min-height: 44px; border-color: var(--surface-border); }
    .db-btn-primary { background: var(--db-navy); border-color: var(--db-navy); color: #fff; border-radius: 10px; min-height: 44px; font-weight: 600; padding: 0 1.4rem; }
    .db-btn-primary:hover { background: var(--db-navy-2); border-color: var(--db-navy-2); color: #fff; }
    .db-btn-ghost { border: 1px solid var(--surface-border); color: var(--db-navy); background: var(--surface); border-radius: 10px; min-height: 44px; font-weight: 600; padding: 0 1.2rem; }
    .db-btn-ghost:hover { background: var(--surface-muted); color: var(--db-navy); }

    .db-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem; }
    .db-kpi {
      display: block; text-decoration: none; background: var(--surface); border-radius: 18px; padding: 1.2rem 1.4rem;
      border: 1px solid var(--surface-border);
      transition: transform .15s, box-shadow .15s; min-height: 128px;
    }
    a.db-kpi:hover { border-color: var(--db-navy-2); }
    .db-kpi-label { font-size: .78rem; font-weight: 700; letter-spacing: .1em; color: var(--db-muted); text-transform: uppercase; line-height: 1.35; }
    .db-kpi-value { font-size: 2.4rem; font-weight: 800; color: var(--db-ink); line-height: 1.1; margin-top: .5rem; font-variant-numeric: tabular-nums; }
    .db-kpi-hint { font-size: .78rem; color: var(--db-muted); margin-top: .2rem; }

    .db-chart { padding: 1.5rem; height: 100%; }
    .db-chart-title { display: flex; align-items: center; gap: .6rem; font-size: 1.2rem; font-weight: 700; color: var(--db-ink); margin-bottom: 1.25rem; }
    .db-chart-sub { font-size: .82rem; color: var(--db-muted); margin: -1rem 0 1.1rem; }

    .db-quick a { border-radius: 10px; }

    .db-vc-counts { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; margin-bottom: 1.25rem; }
    @media (max-width: 576px) { .db-vc-counts { grid-template-columns: repeat(2, 1fr); } }
    .db-vc-count { display: block; text-decoration: none; border: 1px solid var(--surface-border); border-radius: 12px; padding: .75rem 1rem; }
    .db-vc-count:hover { border-color: var(--db-navy-2); }
    .db-vc-count-value { font-size: 1.6rem; font-weight: 800; color: var(--db-ink); line-height: 1.1; font-variant-numeric: tabular-nums; }
    .db-vc-count-label { font-size: .78rem; font-weight: 600; color: var(--db-muted); }
    .db-vc-row { display: flex; align-items: center; gap: .75rem; padding: .7rem .5rem; margin: 0 -.5rem; border-top: 1px solid var(--surface-border);
                 text-decoration: none; color: inherit; border-radius: 10px; }
    .db-vc-row:hover { background: var(--surface-muted); color: inherit; }
    .db-vc-row:first-child { border-top: 0; }
    .db-vc-badge { display: inline-flex; align-items: center; gap: .3rem; padding: .2rem .6rem; border-radius: 999px; color: #fff; font-size: .75rem; font-weight: 600; white-space: nowrap; }
    @media (max-width: 576px) {
      .db-hero { padding: 1.5rem; }
      .db-hero h1 { font-size: 1.6rem; }
    }
  `],
  template: `
    <div class="fade-in-up">
      <!-- ── Bannière ─────────────────────────────────────────────────── -->
      <section class="db-hero mb-4">
        <div class="db-eyebrow">ITECOM · {{ roleLabel }}</div>
        <h1>Bonjour {{ authService.currentUser?.firstName }} <span aria-hidden="true">👋</span></h1>
        <p>{{ heroText }}</p>
        <button type="button" class="db-pill" (click)="showFilters = !showFilters" [attr.aria-expanded]="showFilters"
                aria-controls="db-filters" title="Changer la période">
          <i class="bi bi-calendar3"></i>{{ periodLabel }}<i class="bi bi-chevron-down db-pill-caret d-md-none"></i>
        </button>
      </section>

      <!-- ── Filtres ──────────────────────────────────────────────────── -->
      <!-- Téléphone : filtres repliés, ouverts en touchant la période -->
      <section id="db-filters" class="db-card db-filters mb-4" [class.open]="showFilters">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-sm-6 col-lg-3">
            <label class="form-label d-block" for="db-from">Du</label>
            <input id="db-from" type="date" class="form-control" [(ngModel)]="draftFrom" [max]="draftTo || null">
          </div>
          <div class="col-12 col-sm-6 col-lg-3">
            <label class="form-label d-block" for="db-to">Au</label>
            <input id="db-to" type="date" class="form-control" [(ngModel)]="draftTo" [min]="draftFrom || null">
          </div>
          <div class="col-12 col-sm-6 col-lg-2">
            <label class="form-label d-block" for="db-type">Type</label>
            <select id="db-type" class="form-select" [(ngModel)]="draftType">
              <option *ngFor="let t of typeOptions" [value]="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div class="col-12 col-lg-4 d-flex gap-2 justify-content-lg-end">
            <button type="button" class="btn db-btn-primary" (click)="apply()">Appliquer</button>
            <button type="button" class="btn db-btn-ghost" (click)="reset()">Réinitialiser</button>
          </div>
        </div>
      </section>

      <!-- ── Indicateurs ─────────────────────────────────────────────── -->
      <section class="db-kpis mb-4">
        <ng-container *ngFor="let k of kpis">
          <a *ngIf="k.link; else plainKpi" class="db-kpi" [routerLink]="k.link">
            <div class="db-kpi-label">{{ k.label }}</div>
            <div class="db-kpi-value">{{ loading ? '—' : k.value }}</div>
            <div *ngIf="k.hint" class="db-kpi-hint">{{ k.hint }}</div>
          </a>
          <ng-template #plainKpi>
            <div class="db-kpi">
              <div class="db-kpi-label">{{ k.label }}</div>
              <div class="db-kpi-value">{{ loading ? '—' : k.value }}</div>
              <div *ngIf="k.hint" class="db-kpi-hint">{{ k.hint }}</div>
            </div>
          </ng-template>
        </ng-container>
      </section>

      <!-- ── Graphiques ──────────────────────────────────────────────── -->
      <section class="row g-4 mb-4">
        <div class="col-12 col-xl-6">
          <div class="db-card db-chart">
            <div class="db-chart-title">{{ leftChart.title }}</div>
            <div class="db-chart-sub">{{ leftChart.subtitle }}</div>
            <app-bar-chart orientation="horizontal" [data]="leftChart.data" [unit]="leftChart.unit"
                           [maxValue]="leftChart.max" [labelHeader]="leftChart.labelHeader"
                           [valueHeader]="leftChart.valueHeader" [emptyText]="leftChart.empty"></app-bar-chart>
          </div>
        </div>
        <div class="col-12 col-xl-6">
          <div class="db-card db-chart">
            <div class="db-chart-title">{{ rightChart.title }}</div>
            <div class="db-chart-sub">{{ rightChart.subtitle }}</div>
            <app-bar-chart orientation="vertical" [data]="rightChart.data" [unit]="rightChart.unit"
                           [maxValue]="rightChart.max" [labelHeader]="rightChart.labelHeader"
                           [valueHeader]="rightChart.valueHeader" [emptyText]="rightChart.empty"></app-bar-chart>
          </div>
        </div>
      </section>

      <!-- ── Classes virtuelles (enseignant : ses séances ; administrateur : toutes) ── -->
      <section *ngIf="isStaff" class="db-card db-chart mb-4">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="db-chart-title"><i class="bi bi-camera-video"></i>Classes virtuelles</div>
          <a routerLink="/virtual-class" class="btn btn-sm db-btn-ghost d-inline-flex align-items-center" style="min-height:36px">Tout voir</a>
        </div>
        <div class="db-chart-sub">État actuel de {{ authService.isAdmin ? 'toutes les séances' : 'vos séances' }}, sans tenir compte de la période</div>

        <div class="db-vc-counts">
          <a *ngFor="let st of vcStateKeys" class="db-vc-count" routerLink="/virtual-class" [queryParams]="{ tab: vcStates[st].tab }">
            <div class="db-vc-count-value" [style.color]="vcCounts[st] && st === 'ONGOING' ? vcStates[st].color : null">{{ loading ? '—' : vcCounts[st] }}</div>
            <div class="db-vc-count-label"><i class="bi me-1" [ngClass]="vcStates[st].icon" [style.color]="vcStates[st].color"></i>{{ vcStates[st].label }}</div>
          </a>
        </div>

        <div *ngIf="!loading && !vcUpcoming.length" class="text-muted small">Aucune séance en cours ni à venir.</div>
        <a *ngFor="let vc of vcUpcoming" class="db-vc-row" routerLink="/virtual-class" [queryParams]="{ session: vc.id }"
           [attr.aria-label]="'Ouvrir la séance ' + vc.title">
          <span class="db-vc-badge" [style.background]="vcStates[vcState(vc)].color">
            <i class="bi" [ngClass]="vcStates[vcState(vc)].icon"></i>{{ vcStates[vcState(vc)].label }}
          </span>
          <div class="flex-grow-1" style="min-width:0">
            <div class="fw-semibold text-truncate">{{ vc.title }}</div>
            <div class="small text-muted">
              {{ vc.scheduledAt | date:'EEE d MMM · HH:mm':'':'fr' }} · {{ vc.durationMinutes }} min<span *ngIf="vc.courseTitle"> · {{ vc.courseTitle }}</span>
            </div>
          </div>
          <!-- Séance en cours : directement dans la salle -->
          <button *ngIf="vcState(vc) === 'ONGOING'" type="button" class="btn btn-sm btn-danger text-nowrap" (click)="joinRoom($event, vc)">
            <i class="bi bi-box-arrow-in-right me-1"></i>Rejoindre
          </button>
          <i *ngIf="vcState(vc) !== 'ONGOING'" class="bi bi-chevron-right text-muted"></i>
        </a>
      </section>

      <!-- ── Statistiques de l'administrateur ───────────────────────── -->
      <app-admin-stats *ngIf="authService.isAdmin"></app-admin-stats>

      <!-- ── Accès rapide ────────────────────────────────────────────── -->
      <section class="row g-4">
        <div class="col-12 col-xl-5">
          <div class="db-card db-chart">
            <div class="db-chart-title">Accès rapide</div>
            <div class="d-grid gap-2 db-quick">
              <ng-container *ngIf="isStaff">
                <a routerLink="/teacher/qcms/create" class="btn btn-outline-primary text-start"><i class="bi bi-plus-circle me-2"></i>Créer un devoir</a>
                <a routerLink="/teacher/exams" class="btn btn-outline-primary text-start"><i class="bi bi-clipboard-check me-2"></i>Devoirs et examens</a>
                <a routerLink="/teacher/students" class="btn btn-outline-primary text-start"><i class="bi bi-people me-2"></i>Étudiants et notes</a>
              </ng-container>
              <ng-container *ngIf="!isStaff">
                <a routerLink="/courses" class="btn btn-outline-primary text-start"><i class="bi bi-compass me-2"></i>Explorer les cours</a>
                <a routerLink="/qcm" class="btn btn-outline-primary text-start"><i class="bi bi-ui-checks me-2"></i>Mes devoirs</a>
              </ng-container>
              <a routerLink="/virtual-class" class="btn btn-outline-primary text-start"><i class="bi bi-camera-video me-2"></i>Classes virtuelles</a>
            </div>
          </div>
        </div>
        <div *ngIf="!authService.isTeacher" class="col-12 col-xl-7">
          <div class="db-card db-chart">
            <div class="db-chart-title">Catégories</div>
            <div class="d-flex flex-wrap gap-2">
              <a *ngFor="let cat of visibleCategories" [routerLink]="['/courses']" [queryParams]="{category: cat.key}"
                 class="btn btn-sm btn-light border rounded-pill">
                <i class="bi me-1" [ngClass]="cat.icon"></i>{{ cat.label }}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  /** Téléphone : filtres de période repliés par défaut. */
  showFilters = false;
  categories = COURSE_CATEGORIES;
  hideProgramming = false;
  userCategoryKeys: string[] | null = null;

  loading = true;

  // Données brutes
  enrolledCourses: Course[] = [];
  progressList: Progress[] = [];
  teacherCourses: Course[] = [];
  staffQcms: StaffQcm[] = [];
  studentQcms: StudentQcm[] = [];
  adminStats: { students: number; teachers: number; pending: number } | null = null;
  pendingPayments = 0;
  virtualClasses: VirtualClassItem[] = [];

  readonly vcStates = VC_STATES;
  readonly vcStateKeys = Object.keys(VC_STATES) as VcState[];
  vcCounts: Record<VcState, number> = { ONGOING: 0, UPCOMING: 0, MISSED: 0, COMPLETED: 0 };
  /** Séances en cours puis prochaines séances (5 au plus) */
  vcUpcoming: VirtualClassItem[] = [];

  // Filtres : brouillon (formulaire) et appliqués
  draftFrom = '';
  draftTo = '';
  draftType = 'ALL';
  from = '';
  to = '';
  type = 'ALL';

  // Vue calculée
  kpis: Kpi[] = [];
  leftChart = emptyChart();
  rightChart = emptyChart();

  constructor(
    public authService: AuthService,
    private courseService: CourseService,
    private progressService: ProgressService,
    public userScope: UserScopeService,
    private http: HttpClient,
    private router: Router
  ) {}

  get isStaff(): boolean { return this.authService.isTeacher || this.authService.isAdmin; }

  get roleLabel(): string {
    return this.authService.isAdmin ? 'Administration' : this.authService.isTeacher ? 'Espace professeur' : 'Espace étudiant';
  }

  get heroText(): string {
    if (this.authService.isAdmin) {
      return "Bienvenue sur votre espace d'administration. Suivez en un coup d'œil les inscriptions, les devoirs et l'activité des étudiants de la plateforme.";
    }
    if (this.authService.isTeacher) {
      return "Bienvenue sur votre espace professeur. Suivez vos cours, vos devoirs, vos classes virtuelles et le nombre d'étudiants inscrits à chacun.";
    }
    return "Bienvenue sur votre espace d'apprentissage. Suivez votre progression dans vos cours, vos devoirs à rendre et vos notes.";
  }

  get periodLabel(): string {
    if (!this.from && !this.to) return 'Toute la période';
    const f = this.from ? formatDate(this.from) : '…';
    const t = this.to ? formatDate(this.to) : formatDate(todayIso());
    return `${f} → ${t}`;
  }

  get typeOptions(): TypeOption[] {
    return this.isStaff
      ? [
          { value: 'ALL', label: 'Tous' },
          { value: 'PUBLISHED', label: 'Publiés' },
          { value: 'DRAFT', label: 'Brouillons' },
          { value: 'CLOSED', label: 'Clôturés' }
        ]
      : [
          { value: 'ALL', label: 'Tous' },
          { value: 'TODO', label: 'À rendre' },
          { value: 'DONE', label: 'Rendus' }
        ];
  }

  get visibleCategories() {
    if (this.userCategoryKeys && this.userCategoryKeys.length > 0)
      return this.categories.filter(c => this.userCategoryKeys!.includes(c.key));
    return this.hideProgramming
      ? this.categories.filter(c => c.key !== 'algorithms' && !['java','python','javascript','angular','springboot','sql'].includes(c.key))
      : this.categories;
  }

  ngOnInit() {
    this.userScope.hideProgramming$.subscribe(hide => this.hideProgramming = hide);
    this.userScope.userCategoryKeys$.subscribe(keys => this.userCategoryKeys = keys);

    let pending = 0;
    const done = () => { if (--pending <= 0) { this.loading = false; this.recompute(); } };
    const load = <T>(url: string, assign: (v: T) => void) => {
      pending++;
      this.http.get<T>(url).subscribe({ next: v => { assign(v); done(); }, error: () => done() });
    };

    if (this.isStaff) {
      load<StaffQcm[]>('/api/teacher/qcms', v => this.staffQcms = v || []);
      load<VirtualClassItem[]>('/api/virtual-classes', v => this.virtualClasses = v || []);
      pending++;
      this.courseService.getTeacherCourses().subscribe({ next: c => { this.teacherCourses = c || []; done(); }, error: () => done() });
      if (this.authService.isAdmin) {
        load<{ students: number; teachers: number; pending: number }>('/api/admin/users/stats', v => this.adminStats = v);
        load<unknown[]>('/api/admin/scolarite/payments?status=PENDING', v => this.pendingPayments = v?.length ?? 0);
      }
    } else {
      load<StudentQcm[]>('/api/qcm', v => this.studentQcms = v || []);
      pending++;
      this.courseService.getEnrolledCourses().subscribe({ next: c => { this.enrolledCourses = c || []; done(); }, error: () => done() });
      pending++;
      this.progressService.getMyProgress().subscribe({ next: p => { this.progressList = p || []; done(); }, error: () => done() });
    }
    this.recompute();
  }

  apply() {
    this.from = this.draftFrom;
    this.to = this.draftTo;
    this.type = this.draftType;
    this.recompute();
    this.showFilters = false;
  }

  reset() {
    this.draftFrom = this.draftTo = this.from = this.to = '';
    this.draftType = this.type = 'ALL';
    this.recompute();
  }

  private inPeriod(date: string | null): boolean {
    if (!this.from && !this.to) return true;
    if (!date) return false;
    const day = date.slice(0, 10);
    return (!this.from || day >= this.from) && (!this.to || day <= this.to);
  }

  private recompute() {
    if (this.isStaff) this.computeStaff(); else this.computeStudent();
  }

  joinRoom(event: Event, vc: VirtualClassItem) {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/virtual-class', vc.id, 'room']);
  }

  vcState(vc: VirtualClassItem): VcState {
    if (vc.status === 'ONGOING') return 'ONGOING';
    if (vc.status === 'COMPLETED') return 'COMPLETED';
    const end = new Date(vc.scheduledAt).getTime() + (vc.durationMinutes || 0) * 60000;
    return end < Date.now() ? 'MISSED' : 'UPCOMING';
  }

  private computeVirtualClasses() {
    const me = this.authService.currentUser?.id;
    const mine = this.authService.isAdmin ? this.virtualClasses : this.virtualClasses.filter(vc => vc.teacherId === me);
    this.vcCounts = { ONGOING: 0, UPCOMING: 0, MISSED: 0, COMPLETED: 0 };
    mine.forEach(vc => this.vcCounts[this.vcState(vc)]++);
    const rank = (vc: VirtualClassItem) => this.vcState(vc) === 'ONGOING' ? 0 : 1;
    this.vcUpcoming = mine.filter(vc => rank(vc) === 0 || this.vcState(vc) === 'UPCOMING')
      .sort((a, b) => rank(a) - rank(b) || a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, 5);
  }

  private computeStaff() {
    this.computeVirtualClasses();
    const periodQcms = this.staffQcms.filter(q => this.inPeriod(q.createdAt));
    const qcms = this.type === 'ALL' ? periodQcms : periodQcms.filter(q => q.status === this.type);
    const count = (status: string) => periodQcms.filter(q => q.status === status).length;
    const assigned = qcms.reduce((s, q) => s + (q.studentCount || 0), 0);

    this.kpis = [
      { label: 'Devoirs', value: qcms.length, link: '/teacher/exams' },
      { label: 'Étudiants assignés', value: assigned, link: '/teacher/students', hint: 'Total des listes de devoirs' },
      { label: 'Devoirs publiés', value: count('PUBLISHED') },
      { label: 'Brouillons à publier', value: count('DRAFT') }
    ];
    if (this.authService.isAdmin) {
      this.kpis.unshift({ label: 'Étudiants inscrits', value: this.adminStats?.students ?? 0, link: '/admin/users' });
      this.kpis.push({ label: 'Paiements à vérifier', value: this.pendingPayments, link: '/admin/paiements' });
    } else {
      this.kpis.unshift({ label: 'Mes cours', value: this.teacherCourses.length, link: '/teacher/courses' });
      this.kpis.push({ label: 'Devoirs clôturés', value: count('CLOSED') });
    }

    this.leftChart = {
      title: 'Étudiants par devoir',
      subtitle: 'Les 6 devoirs avec le plus d\'étudiants assignés',
      data: [...qcms].sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0)).slice(0, 6)
        .map(q => ({ label: q.title, value: q.studentCount || 0 })),
      unit: '', max: null, labelHeader: 'Devoir', valueHeader: 'Étudiants',
      empty: 'Aucun devoir pour ces filtres'
    };
    this.rightChart = {
      title: 'Devoirs créés par mois',
      subtitle: this.from || this.to ? 'Sur la période sélectionnée' : 'Les 6 derniers mois',
      data: this.monthlyCounts(qcms.map(q => q.createdAt)),
      unit: '', max: null, labelHeader: 'Mois', valueHeader: 'Devoirs',
      empty: 'Aucun devoir pour ces filtres'
    };
  }

  private computeStudent() {
    const periodQcms = this.studentQcms.filter(q => this.inPeriod(q.createdAt));
    const qcms = this.type === 'TODO' ? periodQcms.filter(q => !q.alreadyTaken)
      : this.type === 'DONE' ? periodQcms.filter(q => q.alreadyTaken) : periodQcms;
    const graded = qcms.filter(q => q.alreadyTaken && q.score != null && q.maxScore);
    const avg = graded.length
      ? graded.reduce((s, q) => s + (q.score! / q.maxScore!) * 20, 0) / graded.length
      : null;
    const completedLessons = this.progressList.reduce((s, p) => s + (p.completedLessons || 0), 0);
    const avgProgress = this.progressList.length
      ? Math.round(this.progressList.reduce((s, p) => s + (p.overallPercentage || 0), 0) / this.progressList.length)
      : 0;

    this.kpis = [
      { label: 'Cours inscrits', value: this.enrolledCourses.length, link: '/courses/my-learning' },
      { label: 'Leçons complétées', value: completedLessons },
      { label: 'Progression moyenne', value: `${avgProgress}%` },
      { label: 'Devoirs à rendre', value: qcms.filter(q => !q.alreadyTaken).length, link: '/qcm' },
      { label: 'Moyenne des devoirs', value: avg == null ? '—' : `${avg.toFixed(1).replace('.', ',')}/20`,
        hint: graded.length ? `${graded.length} devoir(s) noté(s)` : 'Aucune note pour le moment' }
    ];

    this.leftChart = {
      title: 'Progression par cours',
      subtitle: 'Pourcentage de leçons terminées',
      data: [...this.progressList].sort((a, b) => b.overallPercentage - a.overallPercentage).slice(0, 6)
        .map(p => ({ label: p.courseTitle, value: Math.round(p.overallPercentage || 0) })),
      unit: '%', max: 100, labelHeader: 'Cours', valueHeader: 'Progression',
      empty: 'Pas encore inscrit à des cours'
    };
    this.rightChart = {
      title: 'Notes des devoirs',
      subtitle: 'Note sur 20 des derniers devoirs rendus',
      data: [...graded].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')).slice(-6)
        .map(q => ({ label: q.title, value: Math.round((q.score! / q.maxScore!) * 200) / 10 })),
      unit: '', max: 20, labelHeader: 'Devoir', valueHeader: 'Note /20',
      empty: 'Aucun devoir noté pour ces filtres'
    };
  }

  /** Nombre d'éléments par mois : période filtrée, ou 6 derniers mois par défaut */
  private monthlyCounts(dates: (string | null)[]): BarDatum[] {
    const end = this.to ? parseLocalDate(this.to) : new Date();
    const start = this.from ? parseLocalDate(this.from) : new Date(end.getFullYear(), end.getMonth() - 5, 1);
    const months: { key: string; label: string }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end && months.length < 12) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: `${MONTHS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}` });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months.map(m => ({ label: m.label, value: dates.filter(d => d?.startsWith(m.key)).length }));
  }
}

function emptyChart() {
  return {
    title: '', subtitle: '', data: [] as BarDatum[], unit: '', max: null as number | null,
    labelHeader: '', valueHeader: '', empty: ''
  };
}

/** « AAAA-MM-JJ » en date locale (new Date(iso) l'interpréterait en UTC) */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
