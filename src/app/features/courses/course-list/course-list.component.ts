import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CourseService } from '../../../core/services/course.service';
import { Course, COURSE_CATEGORIES, COURSE_LEVELS, courseLevelLabel } from '../../../core/models/course.model';
import { UserScopeService } from '../../../core/services/user-scope.service';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink, FormsModule],
  template: `
    <div class="fade-in-up">
      <!-- Header -->
      <div class="text-center py-5 mb-4 rounded-4"
           style="background: #2b3ea8;">
        <h1 class="fw-bold text-white mb-2"><i class="bi bi-mortarboard me-1"></i>Nos Cours</h1>
        <p class="text-white opacity-75 mb-4">Maîtrisez les technologies les plus demandées</p>
        <div class="d-flex justify-content-center">
          <div class="input-group" style="max-width: 480px;">
            <span class="input-group-text bg-white border-0"><i class="bi bi-search text-muted"></i></span>
            <input type="text" class="form-control border-0 shadow-none" placeholder="Rechercher un cours..."
              [(ngModel)]="searchTerm" (ngModelChange)="onSearch()">
          </div>
        </div>
      </div>

      <!-- Category Filters -->
      <div class="d-flex gap-2 flex-wrap mb-4">
        <button class="btn rounded-pill fw-semibold"
          [class.btn-dark]="!selectedCategory"
          [class.btn-outline-secondary]="selectedCategory"
          (click)="filterByCategory(null)">
          Tous les cours
        </button>
        <button *ngFor="let cat of visibleCategories"
          class="btn rounded-pill fw-semibold"
          [class.btn-dark]="selectedCategory === cat.key"
          [class.btn-outline-secondary]="selectedCategory !== cat.key"
          (click)="filterByCategory(cat.key)">
          <i class="bi me-1" [ngClass]="cat.icon"></i>{{ cat.label }}
        </button>
      </div>

      <!-- Level filter : inutile si tous les cours sont du même niveau (étudiant : cours de son niveau seulement) -->
      <div *ngIf="availableLevels.length > 1" class="d-flex gap-2 mb-4 align-items-center">
        <span class="text-muted small fw-semibold">Niveau :</span>
        <button *ngFor="let lvl of availableLevels"
          class="btn btn-sm rounded-pill"
          [class.btn-primary]="selectedLevel === lvl.key"
          [class.btn-outline-secondary]="selectedLevel !== lvl.key"
          (click)="selectedLevel = selectedLevel === lvl.key ? null : lvl.key; applyFilters()">
          {{ lvl.label }}
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="row g-4">
        <div class="col-md-6 col-xl-4" *ngFor="let _ of [1,2,3,4,5,6]">
          <div class="card border-0 shadow-sm" style="border-radius:16px">
            <div class="placeholder-glow">
              <div class="placeholder bg-secondary" style="height:160px;width:100%;border-radius:16px 16px 0 0"></div>
            </div>
            <div class="card-body p-4">
              <div class="placeholder-glow">
                <span class="placeholder col-8 mb-2"></span>
                <span class="placeholder col-12"></span>
                <span class="placeholder col-10"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Courses Grid -->
      <div *ngIf="!loading">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span class="text-muted small">{{ filteredCourses.length }} cours trouvé(s)</span>
        </div>

        <div *ngIf="filteredCourses.length === 0" class="text-center py-5">
          <div style="font-size:4rem"><i class="bi bi-search"></i></div>
          <h4 class="mt-3">Aucun cours trouvé</h4>
          <p class="text-muted">Essayez d'autres filtres ou mots-clés</p>
          <button class="btn btn-primary-custom" (click)="resetFilters()">Réinitialiser</button>
        </div>

        <div class="row g-4">
          <div class="col-md-6 col-xl-4" *ngFor="let course of filteredCourses | paginate: coursesPg.page : coursesPg.size">
            <div class="course-card card h-100">
              <!-- Thumbnail -->
              <div class="course-thumbnail-placeholder"
                   [style.background]="getCategoryColor(course.category)">
                <span><i class="bi" [ngClass]="getCategoryIcon(course.category)"></i></span>
              </div>

              <div class="card-body d-flex flex-column p-4">
                <div class="d-flex gap-2 mb-2 flex-wrap">
                  <span *ngIf="course.category" class="badge-category">{{ getCategoryLabel(course.category) }}</span>
                  <span class="badge-level {{ course.level }}">{{ getLevelLabel(course.level) }}</span>
                </div>

                <h5 class="fw-bold mb-2 flex-grow-1">{{ course.title }}</h5>
                <p class="text-muted small mb-3" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                  {{ course.description }}
                </p>

                <div class="d-flex gap-3 text-muted small mb-3">
                  <span><i class="bi bi-collection me-1"></i>{{ course.totalLessons }} leçons</span>
                  <span><i class="bi bi-clock me-1"></i>{{ formatDuration(course.totalDurationMinutes) }}</span>
                </div>

                <div class="d-flex align-items-center gap-2 mb-3" *ngIf="course.teacher">
                  <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white"
                       style="width:28px;height:28px;font-size:0.7rem;flex-shrink:0">
                    {{ course.teacher.firstName?.charAt(0) }}{{ course.teacher.lastName?.charAt(0) }}
                  </div>
                  <span class="small text-muted">{{ course.teacher.firstName }} {{ course.teacher.lastName }}</span>
                </div>

                <a [routerLink]="['/courses', course.id]"
                   class="btn btn-primary-custom w-100">
                  Voir le cours <i class="bi bi-arrow-right ms-1"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
        <app-pagination [pager]="coursesPg" [total]="filteredCourses.length"></app-pagination>
      </div>
    </div>
  `
})
export class CourseListComponent implements OnInit {
  /** Pagination des listes. */
  coursesPg = new Pager(9);
  courses: Course[] = [];
  filteredCourses: Course[] = [];
  loading = true;
  searchTerm = '';
  selectedCategory: string | null = null;
  selectedLevel: string | null = null;

  categories = COURSE_CATEGORIES;
  userCategoryKeys: string[] | null = null;
  levels = COURSE_LEVELS;

  /** Niveaux présents dans les cours reçus (le serveur ne renvoie à un étudiant que ceux de son niveau). */
  availableLevels = COURSE_LEVELS;

  get visibleCategories() {
    if (this.userCategoryKeys && this.userCategoryKeys.length > 0)
      return this.categories.filter(c => this.userCategoryKeys!.includes(c.key));
    return this.categories;
  }

  constructor(private courseService: CourseService, private route: ActivatedRoute, private userScope: UserScopeService) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['category']) this.selectedCategory = params['category'];
    });
    this.userScope.userCategoryKeys$.subscribe(keys => {
      this.userCategoryKeys = keys;
      if (keys && this.selectedCategory && !keys.includes(this.selectedCategory)) {
        this.selectedCategory = null;
      }
      this.applyFilters();
    });
    this.loadCourses();
  }

  loadCourses() {
    this.loading = true;
    this.courseService.getPublicCourses().subscribe({
      next: (courses) => {
        this.courses = courses;
        this.availableLevels = this.levels.filter(l => courses.some(c => c.level === l.key));
        this.applyFilters();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onSearch() { this.applyFilters(); }

  filterByCategory(cat: string | null) {
    this.selectedCategory = cat;
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.courses];
    if (this.searchTerm.trim()) {
      let term = this.searchTerm.toLowerCase();
      result = result.filter(c => c.title.toLowerCase().includes(term) || c.description?.toLowerCase().includes(term));
    }
    if (this.selectedCategory) result = result.filter(c => c.category === this.selectedCategory);
    if (this.selectedLevel) result = result.filter(c => c.level === this.selectedLevel);
    if (this.userCategoryKeys && this.userCategoryKeys.length > 0)
      result = result.filter(c => !c.category || this.userCategoryKeys!.includes(c.category)); // cours sans catégorie : visibles par tous
    this.filteredCourses = result;
  }

  resetFilters() {
    this.searchTerm = '';
    this.selectedCategory = null;
    this.selectedLevel = null;
    this.applyFilters();
  }

  getCategoryIcon(cat: string): string {
    return COURSE_CATEGORIES.find(c => c.key === cat)?.icon || 'bi-journal-bookmark';
  }

  getCategoryLabel(cat: string): string {
    return COURSE_CATEGORIES.find(c => c.key === cat)?.label || cat;
  }

  getCategoryColor(cat: string): string {
    let color = COURSE_CATEGORIES.find(c => c.key === cat)?.color || '#2b3ea8';
    return `linear-gradient(135deg, ${color}22, ${color}44)`;
  }

  getLevelLabel(level: string): string {
    return courseLevelLabel(level);
  }

  formatDuration(min: number): string {
    if (!min) return '—';
    if (min < 60) return `${min}min`;
    return `${Math.floor(min/60)}h${min%60 > 0 ? (min%60)+'min' : ''}`;
  }
}
