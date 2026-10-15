import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';

export interface JavaFile {
  packageName: string;
  className: string;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class IdeService {
  constructor(private http: HttpClient) {}

  executeCode(code: string, language: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/api/ide/execute', { code, language });
  }

  executeJavaProject(files: JavaFile[], mainClass: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/api/ide/execute', { language: 'java', files, mainClass });
  }
}
