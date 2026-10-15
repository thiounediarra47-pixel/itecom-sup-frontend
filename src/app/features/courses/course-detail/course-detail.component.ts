import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { CourseService } from '../../../core/services/course.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { Course, COURSE_CATEGORIES, courseLevelLabel } from '../../../core/models/course.model';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="fade-in-up" *ngIf="course">
      <!-- Hero -->
      <div class="rounded-4 p-5 mb-4 position-relative overflow-hidden"
           [style.background]="getCategoryGradient(course.category)">
        <div class="row align-items-center">
          <div class="col-lg-8">
            <div class="d-flex gap-2 mb-3">
              <span *ngIf="course.category" class="badge bg-white text-dark rounded-pill fw-semibold">
                <i class="bi me-1" [ngClass]="getCategoryIcon(course.category)"></i>{{ getCategoryLabel(course.category) }}
              </span>
              <span class="badge rounded-pill fw-semibold text-white"
                    [style.background]="getLevelColor(course.level)">
                {{ getLevelLabel(course.level) }}
              </span>
            </div>
            <h1 class="fw-bold text-white mb-3" style="font-size:2rem">{{ course.title }}</h1>
            <p class="text-white opacity-85 mb-4">{{ course.description }}</p>
            <div class="d-flex gap-4 text-white opacity-75 small mb-4">
              <span><i class="bi bi-collection me-1"></i>{{ course.totalLessons }} leçons</span>
              <span><i class="bi bi-clock me-1"></i>{{ formatDuration(course.totalDurationMinutes) }}</span>
              <span *ngIf="course.teacher"><i class="bi bi-person me-1"></i>{{ course.teacher.firstName }} {{ course.teacher.lastName }}</span>
            </div>

            <div class="d-flex gap-3">
              <button *ngIf="!isEnrolled" class="btn btn-light fw-bold px-4 py-2"
                      (click)="enroll()" [disabled]="enrollLoading">
                <span *ngIf="enrollLoading" class="spinner-border spinner-border-sm me-2"></span>
                <i *ngIf="!enrollLoading" class="bi bi-plus-circle me-2"></i>
                {{ enrollLoading ? "Inscription..." : "S'inscrire gratuitement" }}
              </button>
              <a *ngIf="isEnrolled" [routerLink]="['/courses', course.id, 'learn']"
                 class="btn btn-light fw-bold px-4 py-2">
                <i class="bi bi-play-circle me-2"></i>Continuer l'apprentissage
              </a>
              <a *ngIf="!authService.isAuthenticated" routerLink="/auth/login"
                 class="btn btn-outline-light fw-bold px-4 py-2">
                Se connecter pour s'inscrire
              </a>
            </div>
          </div>

          <div class="col-lg-4 text-center d-none d-lg-block">
            <div style="font-size:8rem; opacity:0.3"><i class="bi" [ngClass]="getCategoryIcon(course.category)"></i></div>
          </div>
        </div>
      </div>

      <!-- Progress (if enrolled) -->
      <div *ngIf="isEnrolled && progress" class="card border-0 shadow-sm mb-4 p-4" style="border-radius:16px">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="fw-semibold"><i class="bi bi-graph-up-arrow me-1"></i>Votre progression</span>
          <span class="badge bg-primary rounded-pill">{{ progress.overallPercentage | number:'1.0-0' }}%</span>
        </div>
        <div class="progress-custom">
          <div class="progress-bar" [style.width.%]="progress.overallPercentage"></div>
        </div>
        <div class="text-muted small mt-1">{{ progress.completedLessons }}/{{ progress.totalLessons }} leçons complétées</div>
      </div>

      <div class="row g-4">
        <!-- Lessons -->
        <div class="col-lg-8">
          <div class="card border-0 shadow-sm" style="border-radius:16px">
            <div class="card-header bg-white border-0 p-4">
              <h4 class="fw-bold mb-0"><i class="bi bi-clipboard-check me-1"></i>Programme du cours</h4>
            </div>
            <div class="card-body p-0">
              <div *ngIf="!course.lessons || course.lessons.length === 0" class="text-center py-5 text-muted">
                <div style="font-size:3rem"><i class="bi bi-inbox"></i></div>
                <p class="mt-2">Aucune leçon disponible pour l'instant</p>
              </div>
              <div *ngFor="let lesson of course.lessons; let i = index"
                   class="d-flex align-items-center gap-3 p-4 border-bottom"
                   style="transition: background 0.2s"
                   [class.bg-light]="lesson.completed">
                <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                     [class.bg-success]="lesson.completed"
                     [class.bg-primary]="!lesson.completed"
                     style="width:36px;height:36px;color:white;font-size:0.8rem;font-weight:700">
                  <i *ngIf="lesson.completed" class="bi bi-check-lg"></i>
                  <span *ngIf="!lesson.completed">{{ i+1 }}</span>
                </div>
                <div class="flex-grow-1">
                  <div class="fw-semibold">{{ lesson.title }}</div>
                  <div class="text-muted small d-flex gap-3 mt-1">
                    <span>
                      <i class="me-1" [class.bi-play-circle]="lesson.type === 'VIDEO'"
                         [class.bi-file-pdf]="lesson.type === 'PDF'"
                         [class.bi-code-slash]="lesson.type === 'CODE_EXERCISE'"
                         [class.bi-table]="lesson.type === 'EXCEL_EXERCISE'"
                         [class.bi-question-circle]="lesson.type === 'QUIZ'"></i>
                      {{ getLessonTypeLabel(lesson.type) }}
                    </span>
                    <span *ngIf="lesson.duration"><i class="bi bi-clock me-1"></i>{{ lesson.duration }}min</span>
                  </div>
                </div>
                <span *ngIf="!isEnrolled" class="text-muted"><i class="bi bi-lock"></i></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar info -->
        <div class="col-lg-4">
          <div class="card border-0 shadow-sm mb-3 p-4" style="border-radius:16px">
            <h5 class="fw-bold mb-3">Ce que vous apprendrez</h5>
            <ul class="list-unstyled">
              <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Fondamentaux du langage</li>
              <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Bonnes pratiques</li>
              <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Projets pratiques</li>
              <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Exercices de code en direct</li>
              <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Support IA intégré</li>
            </ul>
          </div>

          <div class="card border-0 shadow-sm p-4" style="border-radius:16px">
            <h5 class="fw-bold mb-3">Ce cours inclut</h5>
            <div class="d-flex flex-column gap-2 text-muted small">
              <div><i class="bi bi-play-circle me-2 text-primary"></i>Vidéos HD</div>
              <div><i class="bi bi-file-pdf me-2 text-danger"></i>Ressources PDF</div>
              <div><i class="bi bi-code-slash me-2 text-success"></i>IDE intégré</div>
              <div><i class="bi bi-robot me-2 text-info"></i>Assistant IA</div>
              <div><i class="bi bi-infinity me-2 text-warning"></i>Accès illimité</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div *ngIf="!course && !error" class="text-center py-5">
      <div class="spinner-border text-primary" style="width:3rem;height:3rem;"></div>
      <p class="mt-3 text-muted">Chargement du cours...</p>
    </div>

    <div *ngIf="error" class="text-center py-5">
      <div style="font-size:4rem"><i class="bi bi-emoji-frown"></i></div>
      <h4 class="mt-3">Cours introuvable</h4>
      <a routerLink="/courses" class="btn btn-primary-custom mt-3">Retour aux cours</a>
    </div>
  `
})
export class CourseDetailComponent implements OnInit {
  course: Course | null = null;
  error = false;
  isEnrolled = false;
  enrollLoading = false;
  progress: any = null;

  constructor(
    private route: ActivatedRoute,
    private courseService: CourseService,
    private progressService: ProgressService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    let id = +this.route.snapshot.paramMap.get('id')!;
    this.courseService.getCourseById(id).subscribe({
      next: (course) => {
        // Un professeur ne consulte que ses propres cours
        if (this.authService.isTeacher && course.teacher?.id !== this.authService.currentUser?.id) {
          this.router.navigate(['/teacher/courses']);
          return;
        }
        this.course = course;
        if (this.authService.isAuthenticated) {
          this.courseService.getEnrolledCourses().subscribe(enrolled => {
            this.isEnrolled = enrolled.some(c => c.id === id);
            if (this.isEnrolled) {
              this.progressService.getCourseProgress(id).subscribe(p => this.progress = p);
            }
          });
        }
      },
      error: () => { this.error = true; }
    });
  }

  enroll() {
    if (!this.authService.isAuthenticated) { this.router.navigate(['/auth/login']); return; }
    this.enrollLoading = true;
    this.courseService.enrollCourse(this.course!.id).subscribe({
      next: () => { this.isEnrolled = true; this.enrollLoading = false; },
      error: () => { this.enrollLoading = false; }
    });
  }

  getCategoryIcon(cat: string) { return COURSE_CATEGORIES.find(c => c.key === cat)?.icon || 'bi-journal-bookmark'; }
  getCategoryLabel(cat: string) { return COURSE_CATEGORIES.find(c => c.key === cat)?.label || cat; }
  getCategoryGradient(cat: string) {
    let color = COURSE_CATEGORIES.find(c => c.key === cat)?.color || '#2b3ea8';
    return `linear-gradient(135deg, ${color}, ${color}cc)`;
  }
  getLevelLabel(lvl: string) { return courseLevelLabel(lvl); }
  getLevelColor(_lvl: string) { return 'var(--dark)'; }
  getLessonTypeLabel(t: string) { return { VIDEO: 'Vidéo', PDF: 'Document PDF', CODE_EXERCISE: 'Exercice de code', EXCEL_EXERCISE: 'Exercice Excel', QUIZ: 'Quiz' }[t] || t; }
  formatDuration(min: number) { if (!min) return '—'; return min < 60 ? `${min}min` : `${Math.floor(min/60)}h${min%60 > 0 ? (min%60)+'min' : ''}`; }
}
