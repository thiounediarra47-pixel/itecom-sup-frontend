import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Course, Lesson } from '../models/course.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class CourseService {
  constructor(private http: HttpClient) {}

  getPublicCourses(category?: string, search?: string): Observable<Course[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    if (search) params = params.set('search', search);
    return this.http.get<Course[]>('/api/courses/public', { params });
  }

  getCourseById(id: number): Observable<Course> {
    return this.http.get<Course>(`/api/courses/public/${id}`);
  }

  getEnrolledCourses(): Observable<Course[]> {
    return this.http.get<Course[]>('/api/courses/enrolled');
  }

  enrollCourse(id: number): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`/api/courses/${id}/enroll`, {});
  }

  getTeacherCourses(): Observable<Course[]> {
    return this.http.get<Course[]>('/api/teacher/courses');
  }

  createCourse(course: Partial<Course>): Observable<Course> {
    return this.http.post<Course>('/api/teacher/courses', course);
  }

  updateCourse(id: number, course: Partial<Course>): Observable<Course> {
    return this.http.put<Course>(`/api/teacher/courses/${id}`, course);
  }

  deleteCourse(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`/api/teacher/courses/${id}`);
  }

  getLessonById(id: number): Observable<Lesson> {
    return this.http.get<Lesson>(`/api/lessons/${id}`);
  }

  createLesson(courseId: number, lesson: Partial<Lesson>): Observable<Lesson> {
    return this.http.post<Lesson>(`/api/teacher/courses/${courseId}/lessons`, lesson);
  }

  updateLesson(id: number, lesson: Partial<Lesson>): Observable<Lesson> {
    return this.http.put<Lesson>(`/api/teacher/lessons/${id}`, lesson);
  }

  deleteLesson(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`/api/teacher/lessons/${id}`);
  }
}
