import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';

export interface Project {
  id: number;
  title: string;
  description: string;
  groupId: string;
  artifactId: string;
  packageName: string;
  specialization?: string;
  createdByName?: string;
  completed: boolean;
  createdAt: string;
}

export type ProjectRequest = Pick<Project, 'title' | 'description' | 'groupId' | 'artifactId' | 'packageName' | 'specialization'>;

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private http: HttpClient) {}

  getAllProjects(): Observable<Project[]> {
    return this.http.get<Project[]>('/api/projects');
  }

  getMyProjects(): Observable<Project[]> {
    return this.http.get<Project[]>('/api/teacher/projects');
  }

  createProject(project: ProjectRequest): Observable<Project> {
    return this.http.post<Project>('/api/teacher/projects', project);
  }

  updateProject(id: number, project: ProjectRequest): Observable<Project> {
    return this.http.put<Project>(`/api/teacher/projects/${id}`, project);
  }

  deleteProject(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`/api/teacher/projects/${id}`);
  }

  markComplete(id: number): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`/api/projects/${id}/complete`, {});
  }

  download(id: number): Observable<Blob> {
    return this.http.get(`/api/projects/${id}/download`, { responseType: 'blob' });
  }
}
