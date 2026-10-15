import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Lesson } from '../models/course.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  constructor(private http: HttpClient) {}

  getAllExercises(): Observable<Lesson[]> {
    return this.http.get<Lesson[]>('/api/exercises');
  }

  getMyExercises(): Observable<Lesson[]> {
    return this.http.get<Lesson[]>('/api/teacher/exercises');
  }

  createExercise(exercise: Partial<Lesson>): Observable<Lesson> {
    return this.http.post<Lesson>('/api/teacher/exercises', exercise);
  }

  updateExercise(id: number, exercise: Partial<Lesson>): Observable<Lesson> {
    return this.http.put<Lesson>(`/api/teacher/exercises/${id}`, exercise);
  }

  deleteExercise(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`/api/teacher/exercises/${id}`);
  }
}
