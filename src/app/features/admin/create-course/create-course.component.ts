import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, map, switchMap } from 'rxjs';
import { CourseService } from '../../../core/services/course.service';
import { UploadService } from '../../../core/services/upload.service';
import { COURSE_LEVELS, Lesson } from '../../../core/models/course.model';
import { DialogService, DialogRef } from '../../../core/services/dialog.service';

/** Un cours = un titre, un niveau, un document PDF (son contenu) et un état publié / brouillon. */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Leçon unique qui porte le PDF du cours. */
export function pdfLesson(title: string, pdfUrl: string): Partial<Lesson> {
  return { title, description: '', type: 'PDF', pdfUrl, videoUrl: '', duration: 0, orderIndex: 0 };
}

@Component({
  selector: 'app-create-course',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  styles: [`
    .upload-dropzone {
      border: 2px dashed #cbd5e1;
      border-radius: 14px;
      padding: 2rem 1rem;
      text-align: center;
      cursor: pointer;
      transition: all .2s;
      background: var(--surface-muted);
    }
    .upload-dropzone:hover, .upload-dropzone.dragover {
      border-color: #2b3ea8;
      background: #eef0fb;
    }
  `],
  template: `
    <div class="fade-in-up">
      <div *ngIf="!inDialog" class="d-flex align-items-center gap-3 mb-4">
        <a routerLink="/teacher/courses" class="btn btn-sm btn-outline-secondary">
          <i class="bi bi-arrow-left"></i>
        </a>
        <div>
          <h1 class="fw-bold mb-0"><i class="bi bi-stars me-1"></i>Créer un cours</h1>
          <p class="text-muted mb-0 small">Un titre, un niveau et le contenu du cours en PDF</p>
        </div>
      </div>

      <form [formGroup]="courseForm" (ngSubmit)="onSubmit()">
        <div class="card border-0 shadow-sm p-4" style="border-radius:16px; max-width:760px">
          <div class="mb-3">
            <label class="form-label fw-semibold" for="cc-title">Titre du cours *</label>
            <input id="cc-title" type="text" class="form-control" formControlName="title"
              placeholder="Ex : Introduction à la comptabilité"
              [class.is-invalid]="courseForm.get('title')?.invalid && courseForm.get('title')?.touched">
            <div class="invalid-feedback">Le titre est obligatoire</div>
          </div>

          <div class="mb-3" style="max-width:260px">
            <label class="form-label fw-semibold" for="cc-level">Niveau *</label>
            <select id="cc-level" class="form-select" formControlName="level">
              <option *ngFor="let l of courseLevels" [value]="l.key">{{ l.label }}</option>
            </select>
          </div>

          <div class="mb-4">
            <label class="form-label fw-semibold">Contenu du cours (PDF) *</label>
            <div *ngIf="!pdfFile" class="upload-dropzone"
                 [class.dragover]="isDragOver"
                 (dragover)="onDragOver($event)"
                 (dragleave)="isDragOver=false"
                 (drop)="onDrop($event)"
                 (click)="fileInput.click()">
              <div style="font-size:2rem"><i class="bi bi-file-earmark-pdf"></i></div>
              <p class="fw-semibold mb-1">Cliquez ou déposez le PDF du cours ici</p>
              <p class="text-muted small mb-0">Un seul fichier PDF</p>
            </div>
            <input #fileInput type="file" hidden accept="application/pdf,.pdf" (change)="onFileSelected($event)">

            <div *ngIf="pdfFile" class="d-flex align-items-center gap-2 p-3 border rounded-3" style="background:var(--surface-muted)">
              <i class="bi bi-file-earmark-pdf fs-4 text-danger"></i>
              <div class="flex-grow-1 small fw-semibold text-truncate">{{ pdfFile.name }}</div>
              <button type="button" class="btn btn-sm btn-outline-secondary" (click)="fileInput.click()" [disabled]="loading">Changer</button>
            </div>
            <div *ngIf="fileError" class="small text-danger mt-2">{{ fileError }}</div>
          </div>

          <div class="mb-4">
            <div class="form-check form-switch">
              <input type="checkbox" class="form-check-input" id="publishSwitch" formControlName="published" style="width:48px;height:24px">
              <label class="form-check-label fw-semibold ms-2" for="publishSwitch">
                {{ courseForm.get('published')?.value ? 'Publié' : 'Brouillon' }}
              </label>
            </div>
            <p class="text-muted small mt-1 mb-0">{{ courseForm.get('published')?.value ? 'Visible par les étudiants' : 'Seul vous pouvez le voir' }}</p>
          </div>

          <div *ngIf="error" class="alert alert-danger py-2 small">{{ error }}</div>
          <div *ngIf="success" class="alert alert-success py-2 small"><i class="bi bi-check-circle me-1"></i>Cours créé avec succès !</div>

          <div class="d-flex gap-2">
            <button type="submit" class="btn btn-primary-custom" [disabled]="loading || courseForm.invalid || !pdfFile">
              <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
              <i *ngIf="!loading" class="bi bi-save me-2"></i>
              {{ loading ? 'Création...' : 'Créer le cours' }}
            </button>
            <button type="button" class="btn btn-outline-secondary" (click)="finish(false)">Annuler</button>
          </div>
        </div>
      </form>
    </div>
  `
})
export class CreateCourseComponent {
  readonly courseLevels = COURSE_LEVELS;
  loading = false;
  error = '';
  success = false;

  courseForm: FormGroup;
  pdfFile: File | null = null;
  fileError = '';
  isDragOver = false;

  /** Ouvert dans une popup (depuis une liste) ou comme page. */
  private readonly dialogRef = inject(DialogRef, { optional: true });
  get inDialog(): boolean { return !!this.dialogRef; }

  constructor(
    private fb: FormBuilder,
    private courseService: CourseService,
    private uploadService: UploadService,
    private router: Router,
    private dialogs: DialogService
  ) {
    this.courseForm = this.fb.group({
      title: ['', Validators.required],
      level: ['L1', Validators.required],
      published: [false]
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.setFile(input.files[0]);
    input.value = '';
  }

  onDragOver(event: DragEvent) { event.preventDefault(); this.isDragOver = true; }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer?.files?.[0]) this.setFile(event.dataTransfer.files[0]);
  }

  private setFile(file: File) {
    if (!isPdfFile(file)) { this.fileError = 'Seuls les fichiers PDF sont acceptés.'; return; }
    this.fileError = '';
    this.pdfFile = file;
  }

  finish(saved: boolean) {
    if (saved) this.dialogs.toast('Cours créé');
    if (this.dialogRef) this.dialogRef.close(saved);
    else this.router.navigate(['/teacher/courses']);
  }

  onSubmit() {
    if (this.courseForm.invalid || !this.pdfFile) return;
    this.loading = true;
    this.error = '';
    const { title, level, published } = this.courseForm.value;
    // Le PDF d'abord : le cours n'est créé qu'avec son contenu
    this.uploadPdf(this.pdfFile).pipe(
      switchMap(url => this.courseService.createCourse({ title, level, published, lessons: [pdfLesson(title, url) as Lesson] }))
    ).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        setTimeout(() => this.finish(true), this.dialogRef ? 0 : 1500);
      },
      error: (err) => { this.error = err.error?.message || err.message || 'Erreur lors de la création'; this.loading = false; }
    });
  }

  private uploadPdf(file: File): Observable<string> {
    return this.uploadService.uploadOne(file).pipe(map(res => {
      if (!res.data?.url) throw new Error('Import du PDF impossible');
      return res.data.url;
    }));
  }
}
