import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Exam, ExamCreateRequest, ExamSubmissionDetail, ExamSubmitRequest, ExamTakeResponse, StudentExam } from '../models/exam.model';
import { ApiResponse } from '../models/api-response.model';
import { FullscreenViolationRequest } from '../models/fullscreen-violation.model';

@Injectable({ providedIn: 'root' })
export class ExamService {

  constructor(private http: HttpClient) {}

  createExam(request: ExamCreateRequest, studentListFile: File | null, examFile?: File, correctionFile?: File): Observable<ApiResponse<Exam>> {
    const formData = new FormData();
    formData.append('exam', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    if (studentListFile) formData.append('studentList', studentListFile);
    if (examFile) {
      formData.append('examFile', examFile);
    }
    if (correctionFile) {
      formData.append('correctionFile', correctionFile);
    }
    return this.http.post<ApiResponse<Exam>>('/api/teacher/exams', formData);
  }

  getMyExams(): Observable<ApiResponse<Exam[]>> {
    return this.http.get<ApiResponse<Exam[]>>('/api/teacher/exams');
  }

  getExamById(id: number): Observable<ApiResponse<Exam>> {
    return this.http.get<ApiResponse<Exam>>(`/api/teacher/exams/${id}`);
  }

  publishExam(id: number): Observable<ApiResponse<Exam>> {
    return this.http.post<ApiResponse<Exam>>(`/api/teacher/exams/${id}/publish`, {});
  }

  closeExam(id: number): Observable<ApiResponse<Exam>> {
    return this.http.post<ApiResponse<Exam>>(`/api/teacher/exams/${id}/close`, {});
  }

  deleteExam(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`/api/teacher/exams/${id}`);
  }

  downloadReport(id: number): Observable<Blob> {
    return this.http.get(`/api/teacher/exams/${id}/report`, { responseType: 'blob' });
  }

  uploadScannedCopy(examId: number, studentId: number, files: File[]): Observable<ApiResponse<ExamSubmissionDetail>> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return this.http.post<ApiResponse<ExamSubmissionDetail>>(
      `/api/teacher/exams/${examId}/students/${studentId}/scan`, formData);
  }

  getSubmissionDetail(examId: number, studentId: number): Observable<ApiResponse<ExamSubmissionDetail>> {
    return this.http.get<ApiResponse<ExamSubmissionDetail>>(
      `/api/teacher/exams/${examId}/students/${studentId}/submission`);
  }

  // Admin
  getAllExams(): Observable<ApiResponse<Exam[]>> {
    return this.http.get<ApiResponse<Exam[]>>('/api/admin/exams');
  }

  downloadAdminReport(id: number): Observable<Blob> {
    return this.http.get(`/api/admin/exams/${id}/report`, { responseType: 'blob' });
  }

  // Student
  getMyStudentExams(): Observable<ApiResponse<StudentExam[]>> {
    return this.http.get<ApiResponse<StudentExam[]>>('/api/student/exams');
  }

  // Public (student)
  getExamByToken(token: string): Observable<ApiResponse<ExamTakeResponse>> {
    return this.http.get<ApiResponse<ExamTakeResponse>>(`/api/exam/access/${token}`);
  }

  startExam(token: string): Observable<ApiResponse<ExamTakeResponse>> {
    return this.http.post<ApiResponse<ExamTakeResponse>>(`/api/exam/access/${token}/start`, {});
  }

  submitExam(token: string, request: ExamSubmitRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`/api/exam/access/${token}/submit`, request);
  }

  recordFullscreenViolation(token: string, violation: FullscreenViolationRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`/api/exam/access/${token}/fullscreen-violation`, violation);
  }
}
