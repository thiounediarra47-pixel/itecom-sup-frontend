import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Book } from '../models/book.model';

@Injectable({ providedIn: 'root' })
export class BookService {
  private base = '/api/books';

  constructor(private http: HttpClient) {}

  getBooks(filters?: { category?: string; language?: string; search?: string }): Observable<Book[]> {
    let params = new HttpParams();
    if (filters?.category) params = params.set('category', filters.category);
    if (filters?.language) params = params.set('language', filters.language);
    if (filters?.search)   params = params.set('search', filters.search);
    return this.http.get<Book[]>(this.base, { params });
  }

  getBook(id: number): Observable<Book> {
    return this.http.get<Book>(`${this.base}/${id}`);
  }

  createBook(book: Partial<Book>): Observable<Book> {
    return this.http.post<Book>('/api/teacher/books', book);
  }

  updateBook(id: number, book: Partial<Book>): Observable<Book> {
    return this.http.put<Book>(`/api/teacher/books/${id}`, book);
  }

  uploadPdf(id: number, file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post(`/api/teacher/books/${id}/upload-pdf`, fd);
  }

  uploadCover(id: number, file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post(`/api/teacher/books/${id}/upload-cover`, fd);
  }

  deleteBook(id: number): Observable<any> {
    return this.http.delete(`/api/teacher/books/${id}`);
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/categories`);
  }
}
