import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SILENT_ERRORS } from '../interceptors/error.interceptor';
import { Observable } from 'rxjs';
import { Progress } from '../models/course.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  // Hors connexion, offlineInterceptor garde ces envois sur l'appareil et les rejoue au retour du réseau
  constructor(private http: HttpClient) {}

  completeLesson(lessonId: number): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`/api/progress/lesson/${lessonId}/complete`, {});
  }

  updateScrollProgress(lessonId: number, percentage: number): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`/api/progress/lesson/${lessonId}/scroll`, { percentage });
  }

  /** Ajoute du temps passé (en secondes) sur une leçon. */
  addTimeSpent(lessonId: number, seconds: number): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`/api/progress/lesson/${lessonId}/time`, { seconds },
      { context: new HttpContext().set(SILENT_ERRORS, true) });
  }

  /** Plages de vidéo réellement regardées, position de reprise et durée (fusionnées par le serveur). */
  saveVideoProgress(lessonId: number, body: { duration: number; position: number; ranges: [number, number][] }):
      Observable<ApiResponse<{ percentage: number; completed: boolean; position: number } | null>> {
    return this.http.post<ApiResponse<{ percentage: number; completed: boolean; position: number } | null>>(
      `/api/progress/lesson/${lessonId}/video`, body, { context: new HttpContext().set(SILENT_ERRORS, true) });
  }

  saveCode(lessonId: number, code: string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`/api/progress/lesson/${lessonId}/save-code`, { code });
  }

  getSavedCode(lessonId: number): Observable<ApiResponse<{ code: string | null }>> {
    return this.http.get<ApiResponse<{ code: string | null }>>(`/api/progress/lesson/${lessonId}/saved-code`);
  }

  getCourseProgress(courseId: number): Observable<Progress> {
    return this.http.get<Progress>(`/api/progress/course/${courseId}`);
  }

  getMyProgress(): Observable<Progress[]> {
    return this.http.get<Progress[]>('/api/progress/my-progress');
  }
}
