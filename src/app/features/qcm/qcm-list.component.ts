import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DialogService } from '../../core/services/dialog.service';
import { QcmCreateComponent } from './qcm-create.component';

interface Qcm { id: number; title: string; description: string; status: string; questionCount: number; createdAt: string; }

@Component({
  selector: 'app-qcm-list',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink],
  template: `
    <div class="fade-in-up">
      <div class="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 class="fw-bold mb-0">Mes devoirs</h1>
          <p class="text-muted mb-0">Créez et gérez vos questionnaires à choix multiples</p>
        </div>
        <button type="button" (click)="openQcmEditor()" class="btn fw-semibold px-4"
           style="background:#2b3ea8;color:white;border-radius:12px">
          <i class="bi bi-plus-circle me-2"></i>Créer un devoir
        </button>
      </div>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && qcms.length === 0" class="text-center py-5">
        <div style="font-size:4rem"><i class="bi bi-journal-text"></i></div>
        <h5 class="mt-3 fw-bold">Aucun devoir créé</h5>
        <p class="text-muted">Commencez par créer votre premier questionnaire.</p>
        <button type="button" (click)="openQcmEditor()" class="btn btn-primary px-4 mt-2">Créer un devoir</button>
      </div>

      <div class="row g-3" *ngIf="!loading && qcms.length > 0">
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
                <button *ngIf="q.status === 'DRAFT'" class="btn btn-sm btn-success"
                        (click)="publish(q)">
                  <i class="bi bi-send me-1"></i>Publier
                </button>
                <button *ngIf="q.status === 'PUBLISHED'" class="btn btn-sm btn-outline-warning"
                        (click)="unpublish(q)">
                  <i class="bi bi-pause-circle me-1"></i>Dépublier
                </button>
                <button class="btn btn-sm btn-outline-danger" (click)="delete(q)">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <app-pagination [pager]="qcmsPg" [total]="qcms.length"></app-pagination>
    </div>
  `
})
export class QcmListComponent implements OnInit {
  /** Pagination des listes. */
  qcmsPg = new Pager(9);
  qcms: Qcm[] = [];
  loading = true;

  constructor(private dialogs: DialogService, private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<Qcm[]>('/api/teacher/qcms').subscribe({
      next: (d) => { this.qcms = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  publish(q: Qcm) {
    this.http.post(`/api/teacher/qcms/${q.id}/publish`, {}).subscribe(() => q.status = 'PUBLISHED');
  }

  unpublish(q: Qcm) {
    this.http.post(`/api/teacher/qcms/${q.id}/unpublish`, {}).subscribe(() => q.status = 'DRAFT');
  }

  async delete(q: Qcm) {
    if (!(await this.dialogs.confirmDelete(`le devoir « ${q.title} »`))) return;
    this.http.delete(`/api/teacher/qcms/${q.id}`).subscribe(() => this.qcms = this.qcms.filter(x => x.id !== q.id));
  }

  /** Création / modification d'un devoir dans une popup, sans quitter la page. */
  openQcmEditor(id?: number) {
    this.dialogs.open(QcmCreateComponent, {
      title: id ? 'Modifier le devoir' : 'Créer un devoir', icon: id ? 'bi-pencil-square' : 'bi-plus-circle',
      size: 'xl', data: id ? { id } : null
    }).afterClosed.then(saved => { if (saved) { this.load(); } });
  }
}
