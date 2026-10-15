import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ExamService } from '../../../core/services/exam.service';
import { AuthService } from '../../../core/services/auth.service';
import { Exam } from '../../../core/models/exam.model';
import { DialogService } from '../../../core/services/dialog.service';
import { QcmCreateComponent } from '../../qcm/qcm-create.component';

interface Qcm { id: number; title: string; description: string; status: string; questionCount: number; createdAt: string; }

@Component({
  selector: 'app-exam-list',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink],
  template: `
    <div class="fade-in-up">

      <!-- En-tête -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="fw-bold mb-0">Examens en ligne</h1>
          <p class="text-muted mb-0">Gérez vos examens et devoirs</p>
        </div>
        <div class="d-flex gap-2">
          <!-- <a *ngIf="tab === 'exams'" routerLink="/teacher/exams/create"
             class="btn fw-semibold" style="background:#2b3ea8;color:white;border-radius:12px">
            <i class="bi bi-plus-circle me-2"></i>Créer un examen
          </a> -->
          <button type="button" *ngIf="tab === 'qcm'" (click)="openQcmEditor()"
             class="btn fw-semibold" style="background:#2b3ea8;color:white;border-radius:12px">
            <i class="bi bi-plus-circle me-2"></i>Créer un devoir
          </button>
        </div>
      </div>

      <!-- ═══════════════════════ ONGLET EXAMENS ════════════════════════════ -->
      <ng-container *ngIf="tab === 'exams'">
        <div *ngIf="loadingExams" class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
        <div *ngIf="!loadingExams && exams.length === 0" class="text-center py-5">
          <div style="font-size:4rem"><i class="bi bi-clipboard-check"></i></div>
          <!--  <h5 class="mt-3 fw-bold">Aucun examen créé</h5>
          <p class="text-muted">Commencez par créer votre premier examen.</p>
         <a routerLink="/teacher/exams/create" class="btn btn-primary mt-2">Créer un examen</a> -->
        </div>
        <div class="row g-3" *ngIf="!loadingExams && exams.length > 0">
          <div class="col-md-6 col-lg-4" *ngFor="let exam of exams | paginate: examsPg.page : examsPg.size">
            <div class="card h-100 border-0 shadow-sm" style="border-radius:16px;overflow:hidden">
              <div class="card-body p-4">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <h6 class="card-title fw-bold mb-0 flex-grow-1 me-2">{{ exam.title }}</h6>
                  <span class="status-badge" [ngClass]="getStatusClass(exam.status)">
                    {{ getStatusLabel(exam.status) }}
                  </span>
                </div>
                <p class="text-muted small mb-3">{{ exam.description || 'Aucune description' }}</p>
                <div class="d-flex gap-3 text-muted small mb-3">
                  <span><i class="bi bi-question-circle me-1"></i>{{ exam.questionCount }} questions</span>
                  <span><i class="bi bi-people me-1"></i>{{ exam.studentCount }} étudiants</span>
                </div>
                <p class="text-muted small"><i class="bi bi-calendar me-1"></i>{{ exam.createdAt | date:'dd/MM/yyyy' }}</p>
              </div>
              <div class="card-footer bg-transparent border-0 pb-3 px-4">
                <div class="d-flex gap-2 flex-wrap">
                  <a [routerLink]="['/teacher/exams', exam.id]" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-eye me-1"></i>Détails
                  </a>
                  <button *ngIf="exam.status === 'DRAFT'" (click)="publishExam(exam)" class="btn btn-sm btn-success">
                    <i class="bi bi-send me-1"></i>Publier
                  </button>
                  <button *ngIf="exam.status === 'PUBLISHED'" (click)="closeExam(exam)" class="btn btn-sm btn-warning">
                    <i class="bi bi-x-circle me-1"></i>Clôturer
                  </button>
                  <button (click)="downloadReport(exam)" class="btn btn-sm btn-outline-success"
                          [disabled]="exam.status === 'DRAFT'">
                    <i class="bi bi-download me-1"></i>Rapport
                  </button>
                  <button *ngIf="exam.status === 'DRAFT'" (click)="deleteExam(exam)" class="btn btn-sm btn-outline-danger">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <app-pagination [pager]="examsPg" [total]="exams.length"></app-pagination>
      </ng-container>

      <!-- ═══════════════════════ ONGLET QCMs ═══════════════════════════════ -->
      <ng-container *ngIf="tab === 'qcm'">
        <div *ngIf="loadingQcm" class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
        <div *ngIf="!loadingQcm && qcms.length === 0" class="text-center py-5">
          <div style="font-size:4rem"><i class="bi bi-journal-text"></i></div>
          <h5 class="mt-3 fw-bold">Aucun devoir créé</h5>
          <p class="text-muted">Créez un devoir manuellement ou importez un fichier Word.</p>
          <div class="d-flex gap-2 justify-content-center mt-2">
            <button type="button" (click)="openQcmEditor()" class="btn btn-primary">
              <i class="bi bi-plus-circle me-2"></i>Créer un devoir
            </button>
          </div>
        </div>
        <div class="row g-3" *ngIf="!loadingQcm && qcms.length > 0">
          <div class="col-12 col-md-6 col-xl-4" *ngFor="let q of qcms | paginate: qcmsPg.page : qcmsPg.size">
            <div class="card border-0 shadow-sm h-100" style="border-radius:16px;overflow:hidden">
              <div class="card-body p-4">
                <div class="d-flex align-items-start justify-content-between mb-2">
                  <h6 class="fw-bold mb-0 flex-grow-1 me-2">{{ q.title }}</h6>
                  <span class="status-badge" [class.status-published]="q.status === 'PUBLISHED'" [class.status-draft]="q.status !== 'PUBLISHED'">
                    {{ q.status === 'PUBLISHED' ? 'Publié' : 'Brouillon' }}
                  </span>
                </div>
                <p class="text-muted small mb-3" *ngIf="q.description">{{ q.description }}</p>
                <div class="d-flex gap-3 text-muted small mb-4">
                  <span><i class="bi bi-question-circle me-1"></i>{{ q.questionCount }} question(s)</span>
                  <span><i class="bi bi-calendar3 me-1"></i>{{ q.createdAt | date:'dd/MM/yyyy' }}</span>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button type="button" (click)="openQcmEditor(q.id)" class="btn btn-sm btn-outline-secondary">
                    <i class="bi bi-pencil me-1"></i>Modifier
                  </button>
                  <a [routerLink]="['/teacher/qcms', q.id, 'resultats']" class="btn btn-sm btn-outline-info">
                    <i class="bi bi-bar-chart me-1"></i>Résultats
                  </a>
                  <button *ngIf="q.status === 'DRAFT'" class="btn btn-sm btn-success" (click)="publishQcm(q)">
                    <i class="bi bi-send me-1"></i>Publier
                  </button>
                  <button *ngIf="q.status === 'PUBLISHED'" class="btn btn-sm btn-outline-warning" (click)="unpublishQcm(q)">
                    <i class="bi bi-pause-circle me-1"></i>Dépublier
                  </button>
                  <button class="btn btn-sm btn-outline-danger" (click)="deleteQcm(q)">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <app-pagination [pager]="qcmsPg" [total]="qcms.length"></app-pagination>
      </ng-container>

    </div>
  `
})
export class ExamListComponent implements OnInit {
  /** Pagination des listes. */
  examsPg = new Pager(9);
  qcmsPg = new Pager(9);
  /** Seule la liste des devoirs / examens (QCM) est affichée ; l'ancien onglet « Examens » n'est plus proposé. */
  tab: 'exams' | 'qcm' = 'qcm';

  exams: Exam[] = [];
  loadingExams = true;

  qcms: Qcm[] = [];
  loadingQcm = false;
  qcmsLoaded = false;

  constructor(private dialogs: DialogService, 
    private examService: ExamService,
    public authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadQcms();
    const obs = this.authService.isAdmin ? this.examService.getAllExams() : this.examService.getMyExams();
    obs.subscribe({
      next: r => { this.exams = r.data || []; this.loadingExams = false; },
      error: () => this.loadingExams = false
    });
  }

  loadQcms() {
    if (this.qcmsLoaded) return;
    this.loadingQcm = true;
    this.http.get<Qcm[]>('/api/teacher/qcms').subscribe({
      next: d => { this.qcms = d; this.loadingQcm = false; this.qcmsLoaded = true; },
      error: () => this.loadingQcm = false
    });
  }

  // ── Actions examens ──────────────────────────────────────────────────────
  async publishExam(exam: Exam) {
    if (!(await this.dialogs.confirm({ title: `Publier « ${exam.title} » ?`, message: 'Les étudiants recevront leur invitation.', icon: 'bi-send', confirmText: 'Publier' }))) return;
    this.examService.publishExam(exam.id).subscribe({ next: r => { const i = this.exams.findIndex(e => e.id === exam.id); if (i >= 0) this.exams[i] = r.data; } });
  }
  async closeExam(exam: Exam) {
    if (!(await this.dialogs.confirm({ title: `Clôturer « ${exam.title} » ?`, message: 'Plus aucune copie ne pourra être rendue.', icon: 'bi-lock', tone: 'warning', confirmText: 'Clôturer' }))) return;
    this.examService.closeExam(exam.id).subscribe({ next: r => { const i = this.exams.findIndex(e => e.id === exam.id); if (i >= 0) this.exams[i] = r.data; } });
  }
  async deleteExam(exam: Exam) {
    if (!(await this.dialogs.confirmDelete(`l'examen « ${exam.title} »`))) return;
    this.examService.deleteExam(exam.id).subscribe({ next: () => this.exams = this.exams.filter(e => e.id !== exam.id) });
  }
  downloadReport(exam: Exam) {
    const obs = this.authService.isAdmin ? this.examService.downloadAdminReport(exam.id) : this.examService.downloadReport(exam.id);
    obs.subscribe(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `rapport-${exam.id}.xlsx`; a.click(); URL.revokeObjectURL(url); });
  }

  // ── Actions QCMs ─────────────────────────────────────────────────────────
  publishQcm(q: Qcm) {
    this.http.post(`/api/teacher/qcms/${q.id}/publish`, {}).subscribe(() => q.status = 'PUBLISHED');
  }
  unpublishQcm(q: Qcm) {
    this.http.post(`/api/teacher/qcms/${q.id}/unpublish`, {}).subscribe(() => q.status = 'DRAFT');
  }
  async deleteQcm(q: Qcm) {
    if (!(await this.dialogs.confirmDelete(`le devoir « ${q.title} »`))) return;
    this.http.delete(`/api/teacher/qcms/${q.id}`).subscribe(() => this.qcms = this.qcms.filter(x => x.id !== q.id));
  }

  getStatusClass(s: string) { return { DRAFT: 'status-draft', PUBLISHED: 'status-published', CLOSED: 'status-closed' }[s] || 'status-draft'; }
  getStatusLabel(s: string) { return { DRAFT: 'Brouillon', PUBLISHED: 'Publié', CLOSED: 'Clôturé' }[s] || s; }

  /** Création / modification d'un devoir dans une popup, sans quitter la page. */
  openQcmEditor(id?: number) {
    this.dialogs.open(QcmCreateComponent, {
      title: id ? 'Modifier le devoir' : 'Créer un devoir', icon: id ? 'bi-pencil-square' : 'bi-plus-circle',
      size: 'xl', data: id ? { id } : null
    }).afterClosed.then(saved => { if (saved) { this.qcmsLoaded = false; this.loadQcms(); } });
  }
}
