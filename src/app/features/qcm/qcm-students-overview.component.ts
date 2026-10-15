import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DialogService } from '../../core/services/dialog.service';
import { QcmCreateComponent } from './qcm-create.component';

interface QcmSummary {
  id: number;
  title: string;
  description?: string;
  status: string;
  questionCount: number;
  studentCount: number;
  createdAt?: string;
}

@Component({
  selector: 'app-qcm-students-overview',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink],
  template: `
    <div class="fade-in-up">
      <div class="d-flex align-items-center justify-content-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 class="fw-bold mb-1">Étudiants et notes</h1>
          <p class="text-muted mb-0">Consultez les étudiants et corrigez les notes de vos devoirs.</p>
        </div>
        <button type="button" (click)="openQcmEditor()" class="btn btn-primary">
          <i class="bi bi-plus-circle me-2"></i>Nouveau devoir
        </button>
      </div>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && error" class="alert alert-danger">{{ error }}</div>

      <div *ngIf="!loading && !error && qcms.length === 0" class="text-center py-5">
        <i class="bi bi-people text-muted" style="font-size:3rem"></i>
        <h5 class="mt-3 fw-bold">Aucun devoir disponible</h5>
        <p class="text-muted">Créez d’abord un devoir pour gérer ses étudiants et ses notes.</p>
      </div>

      <div class="row g-3" *ngIf="!loading && qcms.length > 0">
        <div class="col-12 col-md-6 col-xl-4" *ngFor="let qcm of qcms | paginate: qcmsPg.page : qcmsPg.size">
          <div class="card border-0 shadow-sm h-100" style="border-radius:16px;overflow:hidden">
            <div class="card-body p-4 d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <h5 class="fw-bold mb-0">{{ qcm.title }}</h5>
                <span class="status-badge" [class.status-published]="qcm.status === 'PUBLISHED'" [class.status-draft]="qcm.status !== 'PUBLISHED'">
                  {{ qcm.status === 'PUBLISHED' ? 'Publié' : 'Brouillon' }}
                </span>
              </div>
              <p class="text-muted small flex-grow-1">{{ qcm.description || 'Aucune description' }}</p>
              <div class="d-flex gap-3 text-muted small mb-3">
                <span><i class="bi bi-people me-1"></i>{{ qcm.studentCount }} étudiant(s)</span>
                <span><i class="bi bi-list-check me-1"></i>{{ qcm.questionCount }} question(s)</span>
              </div>
              <a [routerLink]="['/teacher/qcms', qcm.id, 'resultats']" class="btn btn-outline-primary w-100">
                <i class="bi bi-people me-2"></i>Voir les étudiants et notes
              </a>
            </div>
          </div>
        </div>
      </div>
      <app-pagination [pager]="qcmsPg" [total]="qcms.length"></app-pagination>
    </div>
  `
})
export class QcmStudentsOverviewComponent implements OnInit {
  /** Pagination des listes. */
  qcmsPg = new Pager(9);
  qcms: QcmSummary[] = [];
  loading = true;
  error = '';

  constructor(private dialogs: DialogService, private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.http.get<QcmSummary[]>('/api/teacher/qcms').subscribe({
      next: qcms => {
        this.qcms = qcms;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger la liste des devoirs.';
        this.loading = false;
      }
    });
  }

  /** Création / modification d'un devoir dans une popup, sans quitter la page. */
  openQcmEditor(id?: number) {
    this.dialogs.open(QcmCreateComponent, {
      title: id ? 'Modifier le devoir' : 'Créer un devoir', icon: id ? 'bi-pencil-square' : 'bi-plus-circle',
      size: 'xl', data: id ? { id } : null
    }).afterClosed.then(saved => { if (saved) { this.load(); } });
  }
}
