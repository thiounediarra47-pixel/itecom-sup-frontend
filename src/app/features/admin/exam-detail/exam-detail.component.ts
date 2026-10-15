import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ExamService } from '../../../core/services/exam.service';
import { AuthService } from '../../../core/services/auth.service';
import { Exam, ExamStudent, ExamSubmissionDetail } from '../../../core/models/exam.model';
import { FileViewerComponent } from '../../../shared/components/file-viewer.component';
import { DialogService } from '../../../core/services/dialog.service';
import { StudentPickerComponent, PickedStudent } from '../../../shared/components/student-picker.component';


@Component({
  selector: 'app-exam-detail',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink, FormsModule, StudentPickerComponent],
  template: `
    <div class="container-fluid p-4">
      <div class="d-flex align-items-center gap-3 mb-4">
        <a routerLink="/teacher/exams" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-arrow-left"></i>
        </a>
        <div class="flex-grow-1">
          <h2 class="fw-bold mb-0">{{ exam?.title || 'Chargement...' }}</h2>
          <p class="text-muted mb-0 small">{{ exam?.professorName }}</p>
        </div>
        <div *ngIf="exam" class="d-flex gap-2">
          <span class="badge fs-6" [ngClass]="getStatusClass(exam.status)">
            {{ getStatusLabel(exam.status) }}
          </span>
          <button (click)="downloadReport()" class="btn btn-success btn-sm" [disabled]="exam.status === 'DRAFT'">
            <i class="bi bi-file-earmark-excel me-1"></i>Télécharger le rapport
          </button>
        </div>
      </div>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && exam">
        <div class="row g-4 mb-4">
          <div class="col-md-3">
            <div class="card border-0 shadow-sm text-center p-3">
              <div class="fs-2 fw-bold text-primary">{{ exam.questionCount }}</div>
              <div class="text-muted small">Questions</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card border-0 shadow-sm text-center p-3">
              <div class="fs-2 fw-bold text-info">{{ exam.studentCount }}</div>
              <div class="text-muted small">Étudiants inscrits</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card border-0 shadow-sm text-center p-3">
              <div class="fs-2 fw-bold text-success">{{ submittedCount }}</div>
              <div class="text-muted small">Soumissions</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card border-0 shadow-sm text-center p-3">
              <div class="fs-2 fw-bold text-warning">{{ gradedCount }}</div>
              <div class="text-muted small">Corrigés</div>
            </div>
          </div>
        </div>

        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white fw-semibold py-3">
            <i class="bi bi-question-circle me-2 text-primary"></i>Questions
          </div>
          <div class="card-body p-0">
            <div class="list-group list-group-flush">
              <div *ngFor="let q of exam.questions" class="list-group-item py-3">
                <div class="d-flex justify-content-between">
                  <span class="fw-semibold">Q{{ q.orderIndex }}. {{ q.questionText }}</span>
                  <span class="badge bg-light text-dark ms-2 flex-shrink-0">{{ q.maxScore }} pts</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white fw-semibold py-3 d-flex align-items-center">
            <i class="bi bi-camera me-2 text-primary"></i>Copies scannées après l'examen
          </div>
          <div class="card-body">
            <p class="text-muted small mb-0">
              Pour chaque étudiant, importez une ou plusieurs photos (ou un PDF) de sa copie papier.
              L'IA lit l'écriture manuscrite, retrouve la réponse de chaque question, la compare au
              corrigé du professeur et attribue automatiquement une note et un commentaire.
              Si l'écriture est floue, l'IA fait de son mieux pour la déchiffrer et le signale si besoin.
            </p>
          </div>
        </div>

        <!-- ── Ajouter des étudiants ──────────────────────────────── -->
        <div class="card border-0 shadow-sm mb-4" style="border-radius:16px;border:2px dashed #d5d9ef!important">
          <div class="card-body p-4">
            <div class="d-flex align-items-center gap-3 mb-3">
              <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                   style="width:44px;height:44px;background:#eef0fb;color:#2b3ea8;font-size:1.3rem"><i class="bi bi-people"></i></div>
              <div class="flex-grow-1">
                <h6 class="fw-bold mb-0">Ajouter des étudiants</h6>
                <p class="text-muted mb-0 small">
                  Un niveau entier, un étudiant (même tout juste créé) ou une liste importée.
                  Si l'examen est publié, les nouveaux inscrits reçoivent leur invitation.
                </p>
              </div>
            </div>

            <div *ngIf="addStudentError" class="alert alert-danger py-2 mb-3">
              <i class="bi bi-exclamation-triangle me-2"></i>{{ addStudentError }}
            </div>
            <div *ngIf="addStudentSuccess" class="alert alert-success py-2 mb-3">
              <i class="bi bi-check-circle me-2"></i>{{ addStudentSuccess }}
            </div>

            <app-student-picker [students]="addStudentPreview" [targetLevels]="addLevels"
                                [lockedLevels]="exam.targetLevels || []"></app-student-picker>

            <div *ngIf="addStudentPreview.length || addLevels.size" class="d-flex justify-content-end gap-2 mt-3">
              <button class="btn btn-sm btn-outline-secondary" (click)="resetAddStudents()">Annuler</button>
              <button class="btn btn-sm btn-primary fw-semibold" (click)="confirmAddStudents()" [disabled]="addStudentSaving">
                <span *ngIf="addStudentSaving" class="spinner-border spinner-border-sm me-1"></span>
                <i *ngIf="!addStudentSaving" class="bi bi-check2 me-1"></i>
                {{ addStudentSaving ? 'Ajout...' : 'Confirmer l\'ajout' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Résultats des étudiants ─────────────────────────────── -->
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white fw-semibold py-3">
            <i class="bi bi-people me-2 text-primary"></i>Résultats des étudiants ({{ exam.studentCount }})
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Statut</th>
                    <th>Copie</th>
                    <th>Note</th>
                    <th>Pourcentage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let s of exam.students | paginate: studentsPg.page : studentsPg.size">
                    <td>{{ s.studentName }}</td>
                    <td class="text-muted small">{{ s.studentEmail }}</td>
                    <td>
                      <span class="badge" [ngClass]="getStudentStatusClass(s.status)">
                        {{ getStudentStatusLabel(s.status) }}
                      </span>
                    </td>
                    <td>
                      <span *ngIf="s.submissionType === 'SCANNED_COPY'" class="badge bg-purple text-white" style="background-color:#6f42c1">
                        <i class="bi bi-camera me-1"></i>Scannée
                      </span>
                      <span *ngIf="s.submissionType === 'ONLINE'" class="badge bg-light text-dark">
                        <i class="bi bi-laptop me-1"></i>En ligne
                      </span>
                      <span *ngIf="!s.submissionType" class="text-muted">-</span>
                    </td>
                    <td>
                      <span *ngIf="s.totalScore !== null">
                        {{ s.totalScore | number:'1.1-1' }} / {{ s.maxScore | number:'1.1-1' }}
                      </span>
                      <span *ngIf="s.totalScore === null" class="text-muted">-</span>
                    </td>
                    <td>
                      <span *ngIf="s.percentage !== null">
                        <span [class]="s.percentage >= 50 ? 'text-success fw-semibold' : 'text-danger fw-semibold'">
                          {{ s.percentage | number:'1.1-1' }}%
                        </span>
                      </span>
                      <span *ngIf="s.percentage === null" class="text-muted">-</span>
                    </td>
                    <td>
                      <div class="d-flex flex-wrap gap-1">
                        <input #fileInput type="file" multiple accept="image/*,.pdf,application/pdf"
                               class="d-none" (change)="onFilesSelected($event, s)">
                        <button class="btn btn-outline-primary btn-sm" [disabled]="uploadingId === s.id"
                                (click)="fileInput.click()" title="Importer la copie scannée (photos ou PDF)">
                          <span *ngIf="uploadingId === s.id" class="spinner-border spinner-border-sm me-1"></span>
                          <i *ngIf="uploadingId !== s.id" class="bi bi-upload me-1"></i>
                          {{ uploadingId === s.id ? 'Analyse...' : (s.submissionType === 'SCANNED_COPY' ? 'Réimporter' : 'Importer copie') }}
                        </button>
                        <button *ngIf="s.status === 'SUBMITTED' || s.status === 'GRADED'"
                                class="btn btn-outline-secondary btn-sm" (click)="openComparison(s)">
                          <i class="bi bi-search me-1"></i>Comparer
                        </button>
                        <button *ngIf="s.aiReport" class="btn btn-outline-info btn-sm" (click)="toggleReport(s)">
                          <i class="bi bi-eye me-1"></i>Rapport
                        </button>
                      </div>
                      <div *ngIf="uploadError === s.id" class="text-danger small mt-1">{{ uploadErrorMessage }}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <app-pagination [pager]="studentsPg" [total]="exam.students.length"></app-pagination>
          </div>
        </div>
      </div>

      <div *ngIf="expandedStudent" class="modal d-block" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Rapport IA - {{ expandedStudent.studentName }}</h5>
              <button class="btn-close" (click)="expandedStudent=null"></button>
            </div>
            <div class="modal-body">
              <pre style="white-space:pre-wrap;font-family:Arial,sans-serif">{{ expandedStudent.aiReport }}</pre>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="comparisonStudent" class="modal d-block" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                Comparaison de la copie - {{ comparisonStudent.studentName }}
                <span *ngIf="comparisonDetail?.totalScore !== null && comparisonDetail" class="badge bg-primary ms-2">
                  {{ comparisonDetail.totalScore | number:'1.1-1' }} / {{ comparisonDetail.maxScore | number:'1.1-1' }}
                </span>
              </h5>
              <button class="btn-close" (click)="closeComparison()"></button>
            </div>
            <div class="modal-body">
              <div *ngIf="comparisonLoading" class="text-center py-5">
                <div class="spinner-border text-primary"></div>
              </div>

              <div *ngIf="!comparisonLoading && comparisonDetail" class="row g-3">
                <div class="col-lg-5" *ngIf="comparisonDetail.scannedFileUrls?.length">
                  <h6 class="fw-semibold mb-2"><i class="bi bi-camera me-1"></i>Copie scannée</h6>
                  <div class="d-flex flex-column gap-2" style="max-height:75vh;overflow-y:auto">
                    <div *ngFor="let url of comparisonDetail.scannedFileUrls; let i = index" class="border rounded p-1">
                      <img *ngIf="!isPdf(url)" [src]="url" class="img-fluid w-100" [alt]="'Page ' + (i+1)">
                      <button *ngIf="isPdf(url)" type="button" (click)="viewFile(url, null, 'Copie scannée — page ' + (i + 1))" class="btn btn-outline-secondary btn-sm w-100">
                        <i class="bi bi-file-earmark-pdf me-1"></i>Voir le PDF (page {{ i+1 }})
                      </button>
                    </div>
                  </div>
                </div>

                <div [class]="comparisonDetail.scannedFileUrls.length ? 'col-lg-7' : 'col-12'">
                  <h6 class="fw-semibold mb-2"><i class="bi bi-list-check me-1"></i>Comparaison réponse / corrigé</h6>
                  <div *ngIf="comparisonDetail.aiReport" class="alert alert-info py-2 small">
                    {{ comparisonDetail.aiReport }}
                  </div>
                  <div class="d-flex flex-column gap-3" style="max-height:70vh;overflow-y:auto">
                    <div *ngFor="let a of comparisonDetail.answers" class="border rounded p-3">
                      <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="fw-semibold">Q{{ a.orderIndex }}. {{ a.questionText }}</span>
                        <span class="badge bg-light text-dark ms-2 flex-shrink-0">
                          {{ a.obtainedScore !== null ? (a.obtainedScore | number:'1.1-1') : '-' }} / {{ a.maxScore }}
                        </span>
                      </div>
                      <div class="row g-2">
                        <div class="col-md-6">
                          <div class="small text-muted mb-1">Réponse écrite par l'élève (lue par l'IA)</div>
                          <div class="p-2 bg-light rounded small" style="white-space:pre-wrap">{{ a.studentAnswer || '(aucune réponse détectée)' }}</div>
                        </div>
                        <div class="col-md-6">
                          <div class="small text-muted mb-1">Réponse de référence du professeur</div>
                          <div class="p-2 bg-light rounded small" style="white-space:pre-wrap">{{ a.referenceAnswer }}</div>
                        </div>
                      </div>
                      <div *ngIf="a.aiComment" class="small mt-2">
                        <span class="fw-semibold">Commentaire IA :</span> {{ a.aiComment }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ExamDetailComponent implements OnInit {
  /** Pagination des listes. */
  studentsPg = new Pager(20);
  exam: Exam | null = null;
  loading = true;
  expandedStudent: ExamStudent | null = null;

  uploadingId: number | null = null;
  uploadError: number | null = null;
  uploadErrorMessage = '';

  comparisonStudent: ExamStudent | null = null;
  comparisonDetail: ExamSubmissionDetail | null = null;
  comparisonLoading = false;

  // ── Ajout d'étudiants ─────────────────────────────────────────────────
  addStudentPreview: PickedStudent[] = [];
  addLevels = new Set<string>();
  addStudentSaving = false;
  addStudentError = '';
  addStudentSuccess = '';

  constructor(private dialogs: DialogService, 
    private route: ActivatedRoute,
    private examService: ExamService,
    public authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadExam();
  }

  private loadExam() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.examService.getExamById(id).subscribe({
      next: r => { this.exam = r.data; this.loading = false; },
      error: () => this.loading = false
    });
  }

  get submittedCount(): number {
    return this.exam?.students.filter(s => s.status === 'SUBMITTED' || s.status === 'GRADED').length || 0;
  }

  get gradedCount(): number {
    return this.exam?.students.filter(s => s.status === 'GRADED').length || 0;
  }

  toggleReport(student: ExamStudent) {
    this.expandedStudent = this.expandedStudent?.id === student.id ? null : student;
  }

  onFilesSelected(event: Event, student: ExamStudent) {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length || !this.exam) {
      return;
    }

    this.uploadingId = student.id;
    this.uploadError = null;

    this.examService.uploadScannedCopy(this.exam.id, student.id, files).subscribe({
      next: r => {
        this.uploadingId = null;
        this.loadExam();
        if (r.data) {
          this.comparisonDetail = r.data;
          this.comparisonStudent = student;
        }
      },
      error: err => {
        this.uploadingId = null;
        this.uploadError = student.id;
        this.uploadErrorMessage = err?.error?.message || "Erreur lors de l'analyse de la copie scannée.";
      }
    });

    input.value = '';
  }

  openComparison(student: ExamStudent) {
    if (!this.exam) return;
    this.comparisonStudent = student;
    this.comparisonDetail = null;
    this.comparisonLoading = true;

    this.examService.getSubmissionDetail(this.exam.id, student.id).subscribe({
      next: r => { this.comparisonDetail = r.data; this.comparisonLoading = false; },
      error: () => { this.comparisonLoading = false; }
    });
  }

  closeComparison() {
    this.comparisonStudent = null;
    this.comparisonDetail = null;
  }

  isPdf(url: string): boolean {
    return url.toLowerCase().endsWith('.pdf');
  }

  downloadReport() {
    if (!this.exam) return;
    const obs = this.authService.isAdmin
      ? this.examService.downloadAdminReport(this.exam.id)
      : this.examService.downloadReport(this.exam.id);
    obs.subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-examen-${this.exam!.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  getStatusClass(status: string): string {
    return { DRAFT: 'bg-secondary', PUBLISHED: 'bg-success', CLOSED: 'bg-dark' }[status] || 'bg-secondary';
  }

  getStatusLabel(status: string): string {
    return { DRAFT: 'Brouillon', PUBLISHED: 'Publié', CLOSED: 'Clôturé' }[status] || status;
  }

  getStudentStatusClass(status: string): string {
    return { INVITED: 'bg-info', STARTED: 'bg-warning', SUBMITTED: 'bg-primary', GRADED: 'bg-success' }[status] || 'bg-secondary';
  }

  getStudentStatusLabel(status: string): string {
    return { INVITED: 'Invité', STARTED: 'En cours', SUBMITTED: 'Soumis', GRADED: 'Corrigé' }[status] || status;
  }

  // ── Ajout d'étudiants (niveaux, comptes, liste) ──────────────────────
  resetAddStudents() {
    this.addStudentPreview = [];
    this.addLevels = new Set();
  }

  confirmAddStudents() {
    if (!this.exam || (!this.addStudentPreview.length && !this.addLevels.size)) return;
    this.addStudentSaving = true;
    this.addStudentError = '';
    const body = {
      emails: this.addStudentPreview.map(s => s.email.trim()).filter(e => e),
      levels: [...this.addLevels]
    };
    this.http.post<any>(`/api/teacher/exams/${this.exam.id}/students`, body).subscribe({
      next: res => {
        this.addStudentSaving = false;
        this.resetAddStudents();
        this.addStudentSuccess = `${res.message || 'Étudiants ajoutés avec succès.'}`;
        this.loadExam();
        setTimeout(() => this.addStudentSuccess = '', 5000);
      },
      error: err => {
        this.addStudentSaving = false;
        this.addStudentError = err.error?.message || 'Erreur lors de l\'ajout des étudiants.';
      }
    });
  }

  /** Affiche un fichier (copie scannée, sujet…) dans une popup, sans quitter la page. */
  viewFile(url: string | null | undefined, name?: string | null, title = 'Aperçu du fichier') {
    if (!url) return;
    this.dialogs.open(FileViewerComponent, { title, icon: 'bi-file-earmark-richtext', size: 'xl', data: { url, name: name || undefined } });
  }
}
