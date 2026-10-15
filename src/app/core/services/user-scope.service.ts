import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { CourseService } from './course.service';
import { PROGRAMMING_CATEGORIES, SPECIALIZATION_CATEGORIES } from '../models/course.model';

/**
 * Derives the user's track automatically from the categories of courses they
 * are enrolled in (students) or teach (teachers).
 *
 * Exposes:
 * - userCategoryKeys$: the distinct course categories the user belongs to
 *   (null = admin or not yet loaded → no filtering applied)
 * - hideProgramming$: true when none of the user's categories are programming
 *   → hides the IDE link and programming courses
 */
@Injectable({ providedIn: 'root' })
export class UserScopeService {
  // null = no filtering (admin / not loaded); string[] = restrict to these categories
  private userCategoryKeysSubject = new BehaviorSubject<string[] | null>(null);
  userCategoryKeys$: Observable<string[] | null> = this.userCategoryKeysSubject.asObservable();

  hideProgramming$: Observable<boolean> = this.userCategoryKeys$.pipe(
    map(keys => keys !== null && keys.length > 0 && !keys.some(k => PROGRAMMING_CATEGORIES.includes(k)))
  );

  get userCategoryKeys(): string[] | null {
    return this.userCategoryKeysSubject.value;
  }

  get hideProgramming(): boolean {
    const keys = this.userCategoryKeys;
    return keys !== null && keys.length > 0 && !keys.some(k => PROGRAMMING_CATEGORIES.includes(k));
  }

  constructor(private authService: AuthService, private courseService: CourseService) {
    this.authService.currentUser$.subscribe(user => {
      if (!user || this.authService.isAdmin) {
        this.userCategoryKeysSubject.next(null);
        return;
      }

      if (this.authService.isStudent && user.specialization) {
        const keys = SPECIALIZATION_CATEGORIES[user.specialization] ?? null;
        this.userCategoryKeysSubject.next(keys && keys.length > 0 ? keys : null);
        return;
      }

      const source$ = this.authService.isTeacher
        ? this.courseService.getTeacherCourses()
        : this.courseService.getEnrolledCourses();

      source$.subscribe({
        next: courses => {
          const keys = [...new Set(courses.map(c => c.category).filter(Boolean))];
          this.userCategoryKeysSubject.next(keys.length > 0 ? keys : null);
        },
        error: () => this.userCategoryKeysSubject.next(null)
      });
    });
  }
}
