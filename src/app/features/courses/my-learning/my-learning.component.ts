import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { OfflineService, formatSize } from '../../../core/services/offline.service';
import { DialogService } from '../../../core/services/dialog.service';
import { forgetAccounts } from '../../../core/services/offline-auth';
import { CourseService } from '../../../core/services/course.service';
import { ProgressService } from '../../../core/services/progress.service';
import { Course, Progress, COURSE_CATEGORIES } from '../../../core/models/course.model';

@Component({
  selector: 'app-my-learning',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink, DecimalPipe],
  template: `
    <div class="fade-in-up">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-journal-bookmark me-1"></i>Mon Apprentissage</h1>
          <p class="text-muted">Suivez votre progression sur tous vos cours</p>
        </div>
        <a routerLink="/courses" class="btn btn-primary-custom">
          <i class="bi bi-plus-circle me-2"></i>Explorer d'autres cours
        </a>
      </div>

      <!-- Hors connexion : tous les cours gardés sur l'appareil -->
      <div *ngIf="offline.supported" class="card border-0 shadow-sm mb-4" style="border-radius:16px">
        <div class="card-body d-flex flex-wrap align-items-center gap-3">
          <i class="bi fs-3" [ngClass]="(offline.online$ | async) ? 'bi-cloud-check text-primary' : 'bi-wifi-off text-warning'"></i>
          <div class="flex-grow-1" style="min-width:220px">
            <div class="fw-semibold">Cours disponibles sans internet</div>
            <div class="small text-muted" *ngIf="offline.sync$ | async as sync">
              <ng-container *ngIf="sync.running">Synchronisation… {{ sync.done }} / {{ sync.total }} cours</ng-container>
              <ng-container *ngIf="!sync.running">
                {{ (offline.courses$ | async)?.length || 0 }} cours sur l'appareil ({{ storedSize }})
                <span *ngIf="sync.lastSync"> · mis à jour le {{ sync.lastSync | date:'dd/MM à HH:mm' }}</span>
                <span *ngIf="offline.pendingCount"> · {{ offline.pendingCount }} action(s) à envoyer</span>
                <span *ngIf="sync.error" class="text-danger"> · {{ sync.error }}</span>
              </ng-container>
            </div>
          </div>
          <div class="form-check form-switch mb-0">
            <input class="form-check-input" type="checkbox" id="autoSync" [checked]="offline.autoSync" (change)="toggleAutoSync($event)">
            <label class="form-check-label small" for="autoSync">Garder tous mes cours sur l'appareil</label>
          </div>
          <button type="button" class="btn btn-sm btn-outline-primary" [disabled]="!(offline.online$ | async) || (offline.sync$ | async)?.running"
                  (click)="offline.syncAll(true)"><i class="bi bi-arrow-repeat me-1"></i>Synchroniser</button>
          <button type="button" class="btn btn-sm btn-link text-muted" (click)="clearDevice()" title="Appareil partagé : tout effacer">
            <i class="bi bi-trash3 me-1"></i>Effacer de cet appareil</button>
        </div>
      </div>

      <!-- Global stats -->
      <div class="row g-3 mb-4">
        <div class="col-sm-4">
          <div class="card border-0 shadow-sm p-4 text-center" style="border-radius:16px">
            <div style="font-size:2rem"><i class="bi bi-journal-bookmark"></i></div>
            <div class="fw-bold fs-3 mt-1">{{ courses.length }}</div>
            <div class="text-muted small">Cours inscrits</div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card border-0 shadow-sm p-4 text-center" style="border-radius:16px">
            <div style="font-size:2rem"><i class="bi bi-check-circle"></i></div>
            <div class="fw-bold fs-3 mt-1">{{ totalCompleted }}</div>
            <div class="text-muted small">Leçons complétées</div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card border-0 shadow-sm p-4 text-center" style="border-radius:16px">
            <div style="font-size:2rem"><i class="bi bi-fire"></i></div>
            <div class="fw-bold fs-3 mt-1">{{ avgProgress }}%</div>
            <div class="text-muted small">Progression moyenne</div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && courses.length === 0" class="text-center py-5">
        <div style="font-size:5rem"><i class="bi bi-inbox"></i></div>
        <h3 class="mt-3 fw-bold">Aucun cours en cours</h3>
        <p class="text-muted">Inscrivez-vous à des cours pour démarrer votre apprentissage</p>
        <a routerLink="/courses" class="btn btn-primary-custom mt-3">Découvrir les cours</a>
      </div>

      <!-- Courses grid -->
      <div class="row g-4" *ngIf="!loading && courses.length > 0">
        <div class="col-md-6 col-xl-4" *ngFor="let course of courses | paginate: coursesPg.page : coursesPg.size">
          <div class="card course-card h-100">
            <div class="course-thumbnail-placeholder"
                 [style.background]="getCategoryGradient(course.category)">
              <span><i class="bi" [ngClass]="getCategoryIcon(course.category)"></i></span>
            </div>
            <div class="card-body d-flex flex-column p-4">
              <div class="d-flex flex-wrap gap-1 mb-2">
                <span *ngIf="course.category" class="badge-category">{{ getCategoryLabel(course.category) }}</span>
                <span *ngIf="offline.isDownloaded(course.id)" class="badge bg-success-subtle text-success-emphasis border">
                  <i class="bi bi-check2-circle me-1"></i>Hors connexion</span>
              </div>
              <h5 class="fw-bold flex-grow-1">{{ course.title }}</h5>

              <div class="my-3" *ngIf="getProgress(course.id) as p">
                <div class="d-flex justify-content-between small mb-1">
                  <span class="text-muted">{{ p.completedLessons }}/{{ p.totalLessons }} leçons</span>
                  <span class="fw-semibold text-primary">{{ p.overallPercentage | number:'1.0-0' }}%</span>
                </div>
                <div class="progress-custom">
                  <div class="progress-bar" [style.width.%]="p.overallPercentage"></div>
                </div>
                <div *ngIf="p.overallPercentage === 100" class="mt-2 text-center">
                  <span class="badge bg-success rounded-pill px-3"><i class="bi bi-stars me-1"></i>Cours terminé !</span>
                </div>
              </div>

              <div class="d-flex gap-2 mt-auto">
                <a *ngIf="(offline.online$ | async) || offline.isDownloaded(course.id); else notDownloaded"
                   [routerLink]="['/courses', course.id, 'learn']" class="btn btn-primary-custom flex-grow-1">
                  <i class="bi bi-play-fill me-1"></i>
                  {{ getProgress(course.id)?.overallPercentage === 0 ? 'Commencer' : 'Continuer' }}
                </a>
                <ng-template #notDownloaded>
                  <span class="btn btn-light flex-grow-1 disabled small" title="Téléchargez ce cours quand vous avez internet">
                    <i class="bi bi-wifi-off me-1"></i>Non téléchargé</span>
                </ng-template>
                <a [routerLink]="['/courses', course.id]" class="btn btn-outline-secondary">
                  <i class="bi bi-info-circle"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <app-pagination [pager]="coursesPg" [total]="courses.length"></app-pagination>
    </div>
  `
})
export class MyLearningComponent implements OnInit {
  /** Pagination des listes. */
  coursesPg = new Pager(9);
  courses: Course[] = [];
  progressMap: Record<number, Progress> = {};
  loading = true;
  totalCompleted = 0;
  avgProgress = 0;

  constructor(private courseService: CourseService, private progressService: ProgressService,
              public offline: OfflineService, private dialogs: DialogService) {}

  get storedSize(): string {
    return formatSize(this.offline.courses$.value.reduce((n, c) => n + c.sizeBytes, 0));
  }

  toggleAutoSync(event: Event) {
    this.offline.autoSync = (event.target as HTMLInputElement).checked;
  }

  /** Appareil partagé : supprime cours, données, connexion hors ligne et actions non envoyées. */
  async clearDevice() {
    const ok = await this.dialogs.confirm({ title: 'Effacer les données hors connexion ?',
      message: 'Les cours téléchargés, les données gardées et la connexion sans internet seront supprimés de cet appareil. '
        + (this.offline.pendingCount ? `${this.offline.pendingCount} action(s) pas encore envoyée(s) seront perdues.` : ''),
      icon: 'bi-trash3', tone: 'danger', confirmText: 'Tout effacer' });
    if (!ok) return;
    await this.offline.clearUserData();
    forgetAccounts();
    this.dialogs.toast('Données hors connexion effacées de cet appareil.', 'info');
  }

  ngOnInit() {
    this.courseService.getEnrolledCourses().subscribe({
      next: courses => {
        this.courses = courses;
        this.progressService.getMyProgress().subscribe({
          next: progressList => {
            progressList.forEach(p => this.progressMap[p.courseId] = p);
            this.totalCompleted = progressList.reduce((s, p) => s + p.completedLessons, 0);
            this.avgProgress = progressList.length > 0
              ? Math.round(progressList.reduce((s, p) => s + p.overallPercentage, 0) / progressList.length) : 0;
            this.loading = false;
          },
          error: () => this.loading = false
        });
      },
      // Hors connexion sans liste en mémoire : on affiche au moins les cours téléchargés
      error: () => {
        this.courses = this.offline.courses$.value.map(c => ({ id: c.courseId, title: c.title } as Course));
        this.loading = false;
      }
    });
  }

  getProgress(courseId: number): Progress | null { return this.progressMap[courseId] || null; }
  getCategoryIcon(cat: string) { return COURSE_CATEGORIES.find(c => c.key === cat)?.icon || 'bi-journal-bookmark'; }
  getCategoryLabel(cat: string) { return COURSE_CATEGORIES.find(c => c.key === cat)?.label || cat; }
  getCategoryGradient(cat: string) {
    let color = COURSE_CATEGORIES.find(c => c.key === cat)?.color || '#2b3ea8';
    return `linear-gradient(135deg, ${color}22, ${color}55)`;
  }
}
