import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ExamService } from '../../core/services/exam.service';
import { StudentExam } from '../../core/models/exam.model';

interface QcmSummary {
  id: number; title: string; description: string; status: string;
  questionCount: number; createdAt: string; alreadyTaken: boolean;
  score?: number; maxScore?: number;
}

@Component({
  selector: 'app-my-exams',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink],
  template: `
    <div class="fade-in-up">

      <!-- En-tête -->
      <div class="mb-4">
        <h2 class="fw-bold mb-1">Examens en ligne</h2>
        <p class="text-muted mb-0">Vos examens assignés et devoirs</p>
      </div>

      <!-- Onglets -->
      <div class="d-flex gap-2 mb-4">
        <button class="btn px-4 fw-semibold"
                [style.background]="tab === 'exams' ? '#2b3ea8' : '#f3f4f6'"
                [style.color]="tab === 'exams' ? 'white' : '#374151'"
                style="border-radius:12px;border:none"
                (click)="tab = 'exams'">
          <i class="bi bi-clipboard-text me-2"></i>Examens
          <span class="badge ms-1 rounded-pill"
                [style.background]="tab === 'exams' ? 'rgba(255,255,255,.3)' : '#2b3ea8'"
                style="color:white">{{ exams.length }}</span>
        </button>
        <button class="btn px-4 fw-semibold"
                [style.background]="tab === 'qcm' ? '#2b3ea8' : '#f3f4f6'"
                [style.color]="tab === 'qcm' ? 'white' : '#374151'"
                style="border-radius:12px;border:none"
                (click)="tab = 'qcm'; loadQcms()">
          <i class="bi bi-list-check me-2"></i>Devoirs
          <span class="badge ms-1 rounded-pill"
                [style.background]="tab === 'qcm' ? 'rgba(255,255,255,.3)' : '#2b3ea8'"
                style="color:white">{{ qcms.length }}</span>
        </button>
      </div>

      <!-- ═══════════ ONGLET EXAMENS ════════════════════════════════════════ -->
      <ng-container *ngIf="tab === 'exams'">
        <div *ngIf="loading" class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
        <div *ngIf="!loading && exams.length === 0" class="text-center py-5">
          <i class="bi bi-clipboard-x" style="font-size:3rem;color:#ccc"></i>
          <p class="text-muted mt-3">Aucun examen ne vous a été assigné pour le moment.</p>
        </div>
        <div class="row g-3" *ngIf="!loading && exams.length > 0">
          <div class="col-md-6 col-lg-4" *ngFor="let exam of exams | paginate: examsPg.page : examsPg.size">
            <div class="card h-100 border-0 shadow-sm" style="border-radius:16px;overflow:hidden">
              <div class="card-body p-4">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <h5 class="card-title fw-bold mb-0">{{ exam.examTitle }}</h5>
                  <span class="badge" [ngClass]="getStatusClass(exam.studentStatus)">
                    {{ getStatusLabel(exam.studentStatus) }}
                  </span>
                </div>
                <p class="text-muted small mb-3">{{ exam.examDescription || 'Aucune description' }}</p>
                <p class="text-muted small mb-2"><i class="bi bi-person me-1"></i>{{ exam.professorName }}</p>
                <p class="text-muted small mb-3"><i class="bi bi-calendar me-1"></i>{{ exam.createdAt | date:'dd/MM/yyyy HH:mm' }}</p>
                <div *ngIf="exam.studentStatus === 'GRADED'" class="mb-2">
                  <span class="fw-semibold">Note :</span>
                  {{ exam.totalScore | number:'1.1-1' }} / {{ exam.maxScore | number:'1.1-1' }}
                  <span [class]="(exam.percentage ?? 0) >= 50 ? 'text-success fw-semibold' : 'text-danger fw-semibold'">
                    ({{ exam.percentage | number:'1.1-1' }}%)
                  </span>
                </div>
              </div>
              <div class="card-footer bg-transparent border-0 pt-0 pb-3 px-4">
                <a *ngIf="canTakeExam(exam)" [routerLink]="['/exam', exam.accessToken]" class="btn btn-sm btn-primary">
                  <i class="bi bi-pencil-square me-1"></i>Passer l'examen
                </a>
                <span *ngIf="exam.studentStatus === 'SUBMITTED'" class="text-muted small">
                  <i class="bi bi-hourglass-split me-1"></i>En attente de correction
                </span>
                <span *ngIf="exam.examStatus === 'CLOSED' && exam.studentStatus !== 'GRADED' && exam.studentStatus !== 'SUBMITTED'" class="text-muted small">
                  <i class="bi bi-lock me-1"></i>Examen clôturé
                </span>
              </div>
            </div>
          </div>
        </div>
        <app-pagination [pager]="examsPg" [total]="exams.length"></app-pagination>
      </ng-container>

      <!-- ═══════════ ONGLET QCMs ════════════════════════════════════════════ -->
      <ng-container *ngIf="tab === 'qcm'">
        <div *ngIf="loadingQcm" class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
        <div *ngIf="!loadingQcm && qcms.length === 0" class="text-center py-5">
          <div style="font-size:3.5rem"><i class="bi bi-journal-text"></i></div>
          <h5 class="mt-3 fw-bold">Aucun devoir disponible</h5>
          <p class="text-muted">Vos professeurs n'ont pas encore publié de devoir.</p>
        </div>
        <div class="row g-3" *ngIf="!loadingQcm && qcms.length > 0">
          <div class="col-md-6 col-lg-4" *ngFor="let q of qcms | paginate: qcmsPg.page : qcmsPg.size">
            <div class="card border-0 shadow-sm h-100" style="border-radius:16px;overflow:hidden">
              <div class="card-body p-4">
                <div class="d-flex align-items-start justify-content-between mb-2">
                  <h6 class="fw-bold mb-0 flex-grow-1 me-2">{{ q.title }}</h6>
                  <span *ngIf="q.alreadyTaken" class="badge rounded-pill" style="background:#d1fae5;color:#065f46">
                    <i class="bi bi-check-circle me-1"></i>Déjà passé
                  </span>
                </div>
                <p class="text-muted small mb-3" *ngIf="q.description">{{ q.description }}</p>
                <div class="d-flex gap-3 text-muted small mb-3">
                  <span><i class="bi bi-question-circle me-1"></i>{{ q.questionCount }} question(s)</span>
                  <span><i class="bi bi-calendar3 me-1"></i>{{ q.createdAt | date:'dd/MM/yyyy' }}</span>
                </div>
                <!-- Score si déjà passé -->
                <div *ngIf="q.alreadyTaken && q.score != null" class="mb-3">
                  <div class="d-flex align-items-center gap-2">
                    <div class="flex-grow-1 rounded" style="height:8px;background:#e5e7eb;overflow:hidden">
                      <div class="h-100 rounded"
                           [style.width]="scorePercent(q) + '%'"
                           [style.background]="scorePercent(q) >= 50 ? '#10b981' : '#f59e0b'"></div>
                    </div>
                    <span class="fw-semibold small" [style.color]="scorePercent(q) >= 50 ? '#059669' : '#b45309'">
                      {{ q.score }}/{{ q.maxScore }} ({{ scorePercent(q) }}%)
                    </span>
                  </div>
                </div>
              </div>
              <div class="card-footer bg-transparent border-0 pb-3 px-4 pt-0">
                <div class="d-flex gap-2">
                  <a *ngIf="!q.alreadyTaken" [routerLink]="['/qcm', q.id, 'passer']"
                     class="btn btn-sm fw-semibold" style="background:#2b3ea8;color:white;border-radius:8px">
                    <i class="bi bi-play-fill me-1"></i>Commencer
                  </a>
                  <a *ngIf="q.alreadyTaken" [routerLink]="['/qcm', q.id, 'passer']"
                     class="btn btn-sm btn-outline-success">
                    <i class="bi bi-eye me-1"></i>Voir ma correction
                  </a>
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
export class MyExamsComponent implements OnInit {
  /** Pagination des listes. */
  examsPg = new Pager(9);
  qcmsPg = new Pager(9);
  tab: 'exams' | 'qcm' = 'exams';

  exams: StudentExam[] = [];
  loading = true;

  qcms: QcmSummary[] = [];
  loadingQcm = false;
  qcmsLoaded = false;

  constructor(private examService: ExamService, private http: HttpClient) {}

  ngOnInit() {
    this.examService.getMyStudentExams().subscribe({
      next: r => { this.exams = r.data || []; this.loading = false; },
      error: () => this.loading = false
    });
  }

  loadQcms() {
    if (this.qcmsLoaded) return;
    this.loadingQcm = true;
    this.http.get<QcmSummary[]>('/api/qcm').subscribe({
      next: d => { this.qcms = d; this.loadingQcm = false; this.qcmsLoaded = true; },
      error: () => this.loadingQcm = false
    });
  }

  scorePercent(q: QcmSummary): number {
    if (!q.maxScore) return 0;
    return Math.round((q.score! / q.maxScore) * 100);
  }

  canTakeExam(exam: StudentExam): boolean {
    return exam.examStatus === 'PUBLISHED'
      && (exam.studentStatus === 'INVITED' || exam.studentStatus === 'STARTED');
  }

  getStatusClass(status: string): string {
    return { INVITED: 'bg-info', STARTED: 'bg-warning', SUBMITTED: 'bg-primary', GRADED: 'bg-success' }[status] || 'bg-secondary';
  }

  getStatusLabel(status: string): string {
    return { INVITED: 'À passer', STARTED: 'En cours', SUBMITTED: 'Soumis', GRADED: 'Corrigé' }[status] || status;
  }
}
