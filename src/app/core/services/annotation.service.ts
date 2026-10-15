import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Annotation } from '../models/annotation.model';

@Injectable({ providedIn: 'root' })
export class AnnotationService {
  constructor(private http: HttpClient) {}

  getAnnotations(bookId: number): Observable<Annotation[]> {
    return this.http.get<Annotation[]>(`/api/books/${bookId}/annotations`);
  }

  addAnnotation(bookId: number, ann: Partial<Annotation>): Observable<Annotation> {
    return this.http.post<Annotation>(`/api/books/${bookId}/annotations`, ann);
  }

  updateAnnotation(bookId: number, id: number, data: Partial<Annotation>): Observable<Annotation> {
    return this.http.put<Annotation>(`/api/books/${bookId}/annotations/${id}`, data);
  }

  deleteAnnotation(bookId: number, id: number): Observable<any> {
    return this.http.delete(`/api/books/${bookId}/annotations/${id}`);
  }
}
