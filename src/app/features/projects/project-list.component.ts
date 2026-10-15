import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService, Project } from '../../core/services/project.service';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, ReactiveFormsModule, DatePipe],
  template: `
    <div class="fade-in-up" *ngIf="!accessDenied">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-rocket-takeoff me-1"></i>Projets</h1>
          <p class="text-muted">Cas pratiques Spring Boot — pom.xml prêt avec Lombok, JPA/Hibernate, Spring Data REST et MySQL.</p>
        </div>
        <button *ngIf="isTeacher" class="btn btn-primary-custom" (click)="startCreate()">
          <i class="bi bi-plus-circle me-2"></i>Nouveau projet
        </button>
      </div>

      <!-- Create / edit form -->
      <div *ngIf="form" class="card border-0 shadow-sm p-4 mb-4" style="border-radius:16px">
        <h5 class="fw-bold mb-3">{{ editingId ? 'Modifier' : 'Nouveau' }} projet</h5>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="mb-3">
            <label class="form-label fw-semibold">Titre du projet *</label>
            <input type="text" class="form-control" formControlName="title" placeholder="Ex: Gestion d'une bibliothèque">
          </div>

          <div class="mb-3">
            <label class="form-label fw-semibold">Énoncé du cas pratique</label>
            <textarea class="form-control" rows="5" formControlName="description"
                      placeholder="Décrivez les fonctionnalités attendues, les entités à modéliser, les endpoints REST à exposer..."></textarea>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-md-4">
              <label class="form-label fw-semibold">Group ID</label>
              <input type="text" class="form-control" formControlName="groupId" placeholder="com.eduassist">
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Artifact ID</label>
              <input type="text" class="form-control" formControlName="artifactId" placeholder="bibliotheque-app">
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Package racine</label>
              <input type="text" class="form-control" formControlName="packageName" placeholder="com.eduassist.bibliotheque">
            </div>
          </div>

          <div class="mb-3" style="max-width:280px">
            <label class="form-label fw-semibold">Filière concernée</label>
            <select class="form-select" formControlName="specialization">
              <option value="genie-logiciel">Génie logiciel</option>
              <option value="reseau">Réseau</option>
              <option value="">Toutes filières</option>
            </select>
          </div>

          <div *ngIf="formError" class="alert alert-danger py-2">{{ formError }}</div>

          <div class="d-flex gap-2">
            <button type="submit" class="btn btn-primary-custom" [disabled]="saving">
              <span *ngIf="saving" class="spinner-border spinner-border-sm me-2"></span>
              {{ editingId ? 'Enregistrer' : 'Créer' }}
            </button>
            <button type="button" class="btn btn-outline-secondary" (click)="cancelForm()">Annuler</button>
          </div>
        </form>
      </div>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && projects.length === 0" class="text-center py-5 text-muted">
        <div style="font-size:3rem"><i class="bi bi-rocket-takeoff"></i></div>
        <p class="mt-2">Aucun projet pour le moment.</p>
      </div>

      <div class="row g-3" *ngIf="!loading">
        <div *ngFor="let p of projects | paginate: projectsPg.page : projectsPg.size" class="col-md-6 col-xl-4">
          <div class="card border-0 shadow-sm h-100" style="border-radius:14px;border-left:4px solid #2b3ea8">
            <div class="card-body p-4 d-flex flex-column">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="badge bg-primary"><i class="bi bi-box-seam me-1"></i>{{ p.artifactId }}</span>
                <span *ngIf="p.completed" class="badge bg-success ms-auto"><i class="bi bi-check-lg"></i> Terminé</span>
              </div>
              <h6 class="fw-bold mb-2 flex-grow-1">{{ p.title }}</h6>
              <p *ngIf="p.description" class="text-muted small mb-3" style="display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden">
                {{ p.description }}
              </p>
              <div class="d-flex flex-wrap gap-2 text-muted small mb-3">
                <span *ngIf="p.createdByName"><i class="bi bi-person me-1"></i>{{ p.createdByName }}</span>
                <span><i class="bi bi-calendar3 me-1"></i>{{ p.createdAt | date:'dd/MM/yyyy' }}</span>
              </div>
              <div class="d-flex align-items-center gap-2 mt-auto">
                <button class="btn btn-sm btn-primary-custom flex-grow-1" (click)="downloadProject(p)" [disabled]="downloadingId === p.id">
                  <span *ngIf="downloadingId === p.id" class="spinner-border spinner-border-sm me-2"></span>
                  <i *ngIf="downloadingId !== p.id" class="bi bi-download me-1"></i>
                  {{ downloadingId === p.id ? 'Préparation...' : 'Télécharger le projet' }}
                </button>
                <button *ngIf="!p.completed" class="btn btn-sm btn-outline-success" (click)="markComplete(p)" [disabled]="completingId === p.id" title="Marquer comme terminé">
                  <span *ngIf="completingId === p.id" class="spinner-border spinner-border-sm"></span>
                  <i *ngIf="completingId !== p.id" class="bi bi-check-lg"></i>
                </button>
                <ng-container *ngIf="isTeacher">
                  <button class="btn btn-sm btn-outline-secondary" (click)="startEdit(p)"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" (click)="deleteProject(p)" [disabled]="deletingId === p.id">
                    <span *ngIf="deletingId === p.id" class="spinner-border spinner-border-sm"></span>
                    <i *ngIf="deletingId !== p.id" class="bi bi-trash"></i>
                  </button>
                </ng-container>
              </div>
            </div>
          </div>
        </div>
      </div>
      <app-pagination [pager]="projectsPg" [total]="projects.length"></app-pagination>
    </div>

    <div *ngIf="accessDenied" class="text-center py-5 text-muted">
      <div style="font-size:3rem"><i class="bi bi-lock"></i></div>
      <h5 class="mt-3">Cette section est réservée à la filière Génie logiciel.</h5>
    </div>
  `
})
export class ProjectListComponent implements OnInit {
  /** Pagination des listes. */
  projectsPg = new Pager(9);
  accessDenied = false;
  projects: Project[] = [];
  loading = true;

  form: FormGroup | null = null;
  editingId: number | null = null;
  saving = false;
  formError = '';
  deletingId: number | null = null;
  completingId: number | null = null;
  downloadingId: number | null = null;

  get isTeacher(): boolean {
    return this.authService.isTeacher || this.authService.isAdmin;
  }

  constructor(private dialogs: DialogService, 
    private fb: FormBuilder,
    private authService: AuthService,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    const user = this.authService.currentUser;
    if (!this.isTeacher && user?.specialization !== 'genie-logiciel') {
      this.accessDenied = true;
      this.loading = false;
      return;
    }
    this.load();
  }

  load() {
    this.loading = true;
    const source$ = this.isTeacher ? this.projectService.getMyProjects() : this.projectService.getAllProjects();
    source$.subscribe({
      next: (projects) => { this.projects = projects; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  startCreate() {
    this.editingId = null;
    this.formError = '';
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      groupId: ['com.eduassist', Validators.required],
      artifactId: ['', Validators.required],
      packageName: ['', Validators.required],
      specialization: ['genie-logiciel']
    });
  }

  startEdit(p: Project) {
    this.editingId = p.id;
    this.formError = '';
    this.form = this.fb.group({
      title: [p.title, Validators.required],
      description: [p.description || ''],
      groupId: [p.groupId, Validators.required],
      artifactId: [p.artifactId, Validators.required],
      packageName: [p.packageName, Validators.required],
      specialization: [p.specialization || 'genie-logiciel']
    });
  }

  cancelForm() {
    this.form = null;
    this.editingId = null;
    this.formError = '';
  }

  onSubmit() {
    if (!this.form) return;
    this.formError = '';
    if (this.form.invalid) { this.formError = 'Renseignez le titre, le Group ID, l\'Artifact ID et le package racine.'; return; }
    this.saving = true;
    const value = this.form.value;

    const request$ = this.editingId
      ? this.projectService.updateProject(this.editingId, value)
      : this.projectService.createProject(value);

    request$.subscribe({
      next: (saved) => {
        if (this.editingId) {
          const idx = this.projects.findIndex(p => p.id === this.editingId);
          if (idx >= 0) this.projects[idx] = saved;
        } else {
          this.projects.unshift(saved);
        }
        this.saving = false;
        this.cancelForm();
      },
      error: (err) => { this.formError = err.error?.message || 'Erreur'; this.saving = false; }
    });
  }

  async deleteProject(p: Project) {
    if (!(await this.dialogs.confirmDelete(`« ${p.title} »`))) return;
    this.deletingId = p.id;
    this.projectService.deleteProject(p.id).subscribe({
      next: () => {
        this.projects = this.projects.filter(x => x.id !== p.id);
        this.deletingId = null;
      },
      error: () => { this.deletingId = null; }
    });
  }

  markComplete(p: Project) {
    this.completingId = p.id;
    this.projectService.markComplete(p.id).subscribe({
      next: () => {
        p.completed = true;
        this.completingId = null;
      },
      error: () => { this.completingId = null; }
    });
  }

  downloadProject(p: Project) {
    this.downloadingId = p.id;
    this.projectService.download(p.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${p.artifactId}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.downloadingId = null;
      },
      error: () => { this.downloadingId = null; this.dialogs.toast('Erreur lors du téléchargement du projet.', 'danger'); }
    });
  }
}
