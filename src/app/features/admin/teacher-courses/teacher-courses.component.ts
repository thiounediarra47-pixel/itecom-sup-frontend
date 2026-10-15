import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CourseService } from '../../../core/services/course.service';
import { Course, COURSE_CATEGORIES, courseLevelLabel } from '../../../core/models/course.model';
import { DialogService } from '../../../core/services/dialog.service';
import { EditCourseComponent } from '../edit-course/edit-course.component';

@Component({
  selector: 'app-teacher-courses',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink],
  template: `
    <div class="fade-in-up">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-journal-bookmark me-1"></i>Mes Cours</h1>
          <p class="text-muted">Gérez vos cours et suivez l'engagement de vos étudiants</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="row g-3 mb-4">
        <div class="col-sm-4">
          <div class="kpi-card">
            <div class="kpi-card-label">Cours créés</div>
            <div class="kpi-card-value">{{ courses.length }}</div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="kpi-card">
            <div class="kpi-card-label">Cours publiés</div>
            <div class="kpi-card-value">{{ publishedCount }}</div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="kpi-card">
            <div class="kpi-card-label">Brouillons</div>
            <div class="kpi-card-value">{{ draftCount }}</div>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && courses.length === 0" class="text-center py-5">
        <div style="font-size:5rem"><i class="bi bi-inbox"></i></div>
        <h3 class="mt-3">Aucun cours créé</h3>
        <p class="text-muted">Utilisez « Créer un cours » dans le menu pour ajouter votre premier cours.</p>
      </div>

      <div class="row g-4" *ngIf="!loading">
        <div class="col-md-6" *ngFor="let course of courses | paginate: coursesPg.page : coursesPg.size">
          <div class="card h-100" style="border-radius:16px;overflow:hidden;border:1px solid var(--surface-border)">
            <div class="p-3 d-flex align-items-center gap-3" style="background:var(--surface-muted);border-bottom:1px solid var(--surface-border)">
              <div class="d-flex align-items-center justify-content-center flex-shrink-0"
                   style="width:52px;height:52px;border-radius:12px;background:var(--navy);color:#fff;font-size:1.5rem">
                <i class="bi" [ngClass]="getCategoryIcon(course.category)"></i>
              </div>
              <div class="flex-grow-1 min-w-0">
                <div class="fw-bold" style="color:#1f2a5c">{{ course.title }}</div>
                <div class="d-flex gap-2 mt-1 flex-wrap">
                  <span *ngIf="course.category" class="status-badge status-draft">{{ getCategoryLabel(course.category) }}</span>
                  <span class="status-badge" [class.status-published]="course.published" [class.status-draft]="!course.published">
                    {{ course.published ? 'Publié' : 'Brouillon' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="card-body p-4">
              <p class="text-muted small mb-3" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                {{ course.description || 'Aucune description' }}
              </p>
              <div class="d-flex gap-3 small text-muted mb-4">
                <span><i class="bi bi-collection me-1"></i>{{ course.totalLessons }} leçons</span>
                <span><i class="bi bi-clock me-1"></i>{{ formatDuration(course.totalDurationMinutes) }}</span>
                <span class="badge-level {{ course.level }}">{{ getLevelLabel(course.level) }}</span>
              </div>

              <div class="d-flex gap-2">
                <button type="button" (click)="openCourseEditor(course.id)"
                   class="btn btn-outline-primary btn-sm flex-grow-1">
                  <i class="bi bi-pencil me-1"></i>Modifier
                </button>
                <a [routerLink]="['/teacher/courses', course.id, 'progress']"
                   class="btn btn-outline-primary btn-sm" title="Progression et temps passé des étudiants">
                  <i class="bi bi-graph-up me-1"></i>Suivi
                </a>
                <a [routerLink]="['/courses', course.id]"
                   class="btn btn-outline-secondary btn-sm">
                  <i class="bi bi-eye"></i>
                </a>
                <button class="btn btn-sm btn-outline-secondary"
                        [title]="course.published ? 'Dépublier' : 'Publier'"
                        (click)="togglePublish(course)">
                  <i class="bi" [class.bi-eye-slash]="course.published" [class.bi-eye]="!course.published"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" title="Supprimer le cours"
                        (click)="deleteCourse(course)" [disabled]="deletingId === course.id">
                  <span *ngIf="deletingId === course.id" class="spinner-border spinner-border-sm"></span>
                  <i *ngIf="deletingId !== course.id" class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <app-pagination [pager]="coursesPg" [total]="courses.length"></app-pagination>
    </div>
  `
})
export class TeacherCoursesComponent implements OnInit {
  /** Pagination des listes. */
  coursesPg = new Pager(10);
  courses: Course[] = [];
  loading = true;
  deletingId: number | null = null;

  get publishedCount() { return this.courses.filter(c => c.published).length; }
  get draftCount() { return this.courses.filter(c => !c.published).length; }

  constructor(private courseService: CourseService, private dialogs: DialogService) {}

  ngOnInit() { this.load(); }

  load() {
    this.courseService.getTeacherCourses().subscribe({
      next: (courses) => { this.courses = courses; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openCourseEditor(id: number) {
    this.dialogs.open(EditCourseComponent, { title: 'Modifier le cours', icon: 'bi-pencil-square', size: 'xl', data: { id } })
      // Leçons ajoutées ou supprimées dans la popup : enregistrées sans « Sauvegarder », on recharge toujours
      .afterClosed.then(() => this.load());
  }

  togglePublish(course: Course) {
    this.courseService.updateCourse(course.id, { ...course, published: !course.published }).subscribe({
      next: (updated) => { course.published = updated.published; }
    });
  }

  async deleteCourse(course: Course) {
    if (!(await this.dialogs.confirmDelete(`le cours « ${course.title} »`,
      'Son PDF et la progression des étudiants seront aussi supprimés. Cette action est définitive.'))) return;
    this.deletingId = course.id;
    this.courseService.deleteCourse(course.id).subscribe({
      next: () => {
        this.courses = this.courses.filter(c => c.id !== course.id);
        this.deletingId = null;
        this.dialogs.toast('Cours supprimé');
      },
      error: (err) => {
        this.deletingId = null;
        this.dialogs.toast(err.error?.message || 'Suppression impossible', 'danger');
      }
    });
  }

  getCategoryIcon(cat: string) { return COURSE_CATEGORIES.find(c => c.key === cat)?.icon || 'bi-journal-bookmark'; }
  getCategoryLabel(cat: string) { return COURSE_CATEGORIES.find(c => c.key === cat)?.label || cat; }
  getLevelLabel(lvl: string) { return courseLevelLabel(lvl); }
  formatDuration(min: number) { return min < 60 ? `${min}min` : `${Math.floor(min/60)}h${min%60 > 0 ? (min%60)+'min' : ''}`; }
}
