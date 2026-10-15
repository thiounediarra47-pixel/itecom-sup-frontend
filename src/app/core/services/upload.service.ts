import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';

export interface UploadedFile {
  url: string;
  originalName: string;
  type: 'VIDEO' | 'PDF';
  size: number;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(private http: HttpClient) {}

  uploadOne(file: File): Observable<ApiResponse<UploadedFile>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<UploadedFile>>('/api/teacher/courses/upload', fd);
  }

  uploadBatch(files: File[]): Observable<ApiResponse<UploadedFile[]>> {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return this.http.post<ApiResponse<UploadedFile[]>>('/api/teacher/courses/upload-batch', fd);
  }
}
