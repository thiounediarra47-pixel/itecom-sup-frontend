import { Routes } from '@angular/router';
import { authGuard, catalogGuard } from '../../core/guards/auth.guard';

export const coursesRoutes: Routes = [
  {
    path: '',
    canActivate: [catalogGuard],
    loadComponent: () => import('./course-list/course-list.component').then(m => m.CourseListComponent)
  },
  {
    path: 'my-learning',
    canActivate: [authGuard],
    loadComponent: () => import('./my-learning/my-learning.component').then(m => m.MyLearningComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./course-detail/course-detail.component').then(m => m.CourseDetailComponent)
  },
  {
    path: ':id/learn',
    canActivate: [authGuard],
    loadComponent: () => import('./course-player/course-player.component').then(m => m.CoursePlayerComponent)
  }
];
