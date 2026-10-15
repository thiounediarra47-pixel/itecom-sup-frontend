import { Routes } from '@angular/router';

export const teacherRoutes: Routes = [
  {
    path: 'courses',
    loadComponent: () => import('./teacher-courses/teacher-courses.component').then(m => m.TeacherCoursesComponent)
  },
  {
    path: 'create-course',
    loadComponent: () => import('./create-course/create-course.component').then(m => m.CreateCourseComponent)
  },
  {
    path: 'courses/:id/progress',
    loadComponent: () => import('./course-progress/course-progress.component').then(m => m.CourseProgressComponent)
  },
  {
    path: 'courses/:id/edit',
    loadComponent: () => import('./edit-course/edit-course.component').then(m => m.EditCourseComponent)
  },
  {
    path: 'exams',
    loadComponent: () => import('./exam-list/exam-list.component').then(m => m.ExamListComponent)
  },
  {
    path: 'exams/create',
    loadComponent: () => import('./exam-create/exam-create.component').then(m => m.ExamCreateComponent)
  },
  {
    path: 'exams/:id',
    loadComponent: () => import('./exam-detail/exam-detail.component').then(m => m.ExamDetailComponent)
  },
  {
    path: 'qcms',
    loadComponent: () => import('../qcm/qcm-list.component').then(m => m.QcmListComponent)
  },
  {
    path: 'students',
    loadComponent: () => import('../qcm/qcm-students-overview.component').then(m => m.QcmStudentsOverviewComponent)
  },
  {
    path: 'qcms/create',
    loadComponent: () => import('../qcm/qcm-create.component').then(m => m.QcmCreateComponent)
  },
  {
    path: 'qcms/:id/edit',
    loadComponent: () => import('../qcm/qcm-create.component').then(m => m.QcmCreateComponent)
  },
  {
    path: 'qcms/:id/resultats',
    loadComponent: () => import('../qcm/qcm-resultats.component').then(m => m.QcmResultatsComponent)
  }
];
