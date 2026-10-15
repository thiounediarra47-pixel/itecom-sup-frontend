import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';
import { CourseService } from '../../../core/services/course.service';
import { UploadService } from '../../../core/services/upload.service';
import { COURSE_LEVELS, Course, Lesson } from '../../../core/models/course.model';
import { DialogService, DialogRef, DIALOG_DATA } from '../../../core/services/dialog.service';
import { isPdfFile, pdfLesson } from '../create-course/create-course.component';

@Component({
  selector: 'app-edit-course',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="fade-in-up">
      <div *ngIf="!inDialog" class="d-flex align-items-center gap-3 mb-4">
        <a routerLink="/teacher/courses" class="btn btn-sm btn-outline-secondary"><i class="bi bi-arrow-left"></i></a>
        <h1 class="fw-bold mb-0"><i class="bi bi-pencil-square me-1"></i>Modifier le cours</h1>
      </div>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <form *ngIf="!loading && courseForm" [formGroup]="courseForm" (ngSubmit)="onSubmit()">
        <div class="card border-0 shadow-sm p-4" style="border-radius:16px; max-width:760px">
          <div class="mb-3">
            <label class="form-label fw-semibold" for="ec-title">Titre du cours *</label>
            <input id="ec-title" type="text" class="form-control" formControlName="title">
          </div>

          <div class="mb-3" style="max-width:260px">
            <label class="form-label fw-semibold" for="ec-level">Niveau *</label>
            <select id="ec-level" class="form-select" formControlName="level">
              <option *ngFor="let l of courseLevels" [value]="l.key">{{ l.label }}</option>
            </select>
          </div>

          <div class="mb-4">
            <label class="form-label fw-semibold">Contenu du cours (PDF) *</label>
            <div class="d-flex align-items-center gap-2 p-3 border rounded-3" style="background:var(--surface-muted)">
              <i class="bi bi-file-earmark-pdf fs-4" [class.text-danger]="hasPdf" [class.text-muted]="!hasPdf"></i>
              <div class="flex-grow-1 small text-truncate">
                <span *ngIf="pdfFile" class="fw-semibold">{{ pdfFile.name }} <span class="text-muted fw-normal">(nouveau)</span></span>
                <a *ngIf="!pdfFile && currentPdfUrl" [href]="currentPdfUrl" target="_blank" class="fw-semibold">Voir le PDF actuel</a>
                <span *ngIf="!pdfFile && !currentPdfUrl" class="text-danger">Aucun PDF : les étudiants ne voient pas de contenu</span>
              </div>
              <button type="button" class="btn btn-sm btn-outline-primary" (click)="fileInput.click()" [disabled]="saving">
                {{ hasPdf ? 'Remplacer' : 'Importer' }}
              </button>
              <input #fileInput type="file" hidden accept="application/pdf,.pdf" (change)="onFileSelected($event)">
            </div>
            <div *ngIf="fileError" class="small text-danger mt-2">{{ fileError }}</div>
          </div>

          <div class="form-check form-switch mb-4">
            <input type="checkbox" class="form-check-input" id="pub" formControlName="published" style="width:48px;height:24px">
            <label class="form-check-label fw-semibold ms-2" for="pub">
              {{ courseForm.get('published')?.value ? 'Publié' : 'Brouillon' }}
            </label>
          </div>

          <div *ngIf="error" class="alert alert-danger py-2">{{ error }}</div>
          <div *ngIf="success" class="alert alert-success py-2"><i class="bi bi-check-circle me-1"></i>Cours mis à jour !</div>
          <button type="submit" class="btn btn-primary-custom" [disabled]="saving || courseForm.invalid || !hasPdf">
            <span *ngIf="saving" class="spinner-border spinner-border-sm me-2"></span>
            Sauvegarder les modifications
          </button>
        </div>
      </form>
    </div>
  `
})
export class EditCourseComponent implements OnInit {
  readonly courseLevels = COURSE_LEVELS;
  courseForm!: FormGroup;
  loading = true;
  saving = false;
  error = '';
  success = false;
  courseId!: number;

  course: Course | null = null;
  /** Leçon qui porte le PDF du cours (la première de type PDF) */
  pdfLessonItem: Lesson | null = null;
  pdfFile: File | null = null;
  fileError = '';

  get currentPdfUrl(): string { return this.pdfLessonItem?.pdfUrl || ''; }
  get hasPdf(): boolean { return !!this.pdfFile || !!this.currentPdfUrl; }

  /** Ouvert dans une popup (depuis une liste) ou comme page. */
  private readonly dialogRef = inject(DialogRef, { optional: true });
  private readonly dialogData = inject<{ id?: number } | null>(DIALOG_DATA, { optional: true });
  get inDialog(): boolean { return !!this.dialogRef; }

  constructor(private dialogs: DialogService,
    private fb: FormBuilder,
    private courseService: CourseService,
    private uploadService: UploadService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.courseId = this.dialogData?.id ?? +this.route.snapshot.paramMap.get('id')!;
    this.courseService.getCourseById(this.courseId).subscribe(course => {
      this.course = course;
      this.pdfLessonItem = (course.lessons || []).slice().sort((a, b) => a.orderIndex - b.orderIndex)
        .find(l => l.type === 'PDF') || null;
      this.courseForm = this.fb.group({
        title: [course.title, Validators.required],
        level: [course.level, Validators.required],
        published: [course.published]
      });
      this.loading = false;
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!isPdfFile(file)) { this.fileError = 'Seuls les fichiers PDF sont acceptés.'; return; }
    this.fileError = '';
    this.pdfFile = file;
  }

  onSubmit() {
    if (this.courseForm.invalid || !this.hasPdf) return;
    this.saving = true;
    this.error = '';
    const { title, level, published } = this.courseForm.value;
    this.savePdf(title).pipe(
      // Description et catégorie : conservées telles quelles (le serveur les remplace sinon)
      switchMap(() => this.courseService.updateCourse(this.courseId, {
        title, level, published, description: this.course?.description, category: this.course?.category
      }))
    ).subscribe({
      next: () => {
        this.saving = false; this.success = true;
        if (this.dialogRef) { this.dialogs.toast('Cours mis à jour'); this.dialogRef.close(true); }
        else setTimeout(() => this.router.navigate(['/teacher/courses']), 1500);
      },
      error: (err) => { this.error = err.error?.message || err.message || 'Erreur'; this.saving = false; }
    });
  }

  /** Nouveau PDF : importé puis rattaché à la leçon du cours (créée si elle n'existe pas). */
  private savePdf(title: string): Observable<unknown> {
    if (!this.pdfFile) return of(null);
    return this.uploadService.uploadOne(this.pdfFile).pipe(
      map(res => {
        if (!res.data?.url) throw new Error('Import du PDF impossible');
        return res.data.url;
      }),
      switchMap(url => this.pdfLessonItem
        ? this.courseService.updateLesson(this.pdfLessonItem.id, { ...this.pdfLessonItem, title: this.pdfLessonItem.title || title, pdfUrl: url, exercise: false })
        : this.courseService.createLesson(this.courseId, pdfLesson(title, url)))
    );
  }
}
