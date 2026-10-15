import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ExamService } from '../../../core/services/exam.service';
import { ExamQuestionForm } from '../../../core/models/exam.model';
import { StudentPickerComponent, PickedStudent, studentsCsv } from '../../../shared/components/student-picker.component';


@Component({
  selector: 'app-exam-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StudentPickerComponent],
  template: `
    <div class="container-fluid p-4 fade-in-up" style="max-width:900px">
      <div class="d-flex align-items-center gap-3 mb-4">
        <a routerLink="/teacher/exams" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-arrow-left"></i>
        </a>
        <div>
          <h2 class="fw-bold mb-0">Créer un examen</h2>
          <p class="text-muted mb-0 small">Configurez les questions et importez la liste des étudiants</p>
        </div>
      </div>

      <div *ngIf="success" class="alert alert-success alert-dismissible">
        <i class="bi bi-check-circle me-2"></i>Examen créé avec succès !
        <button class="btn-close" (click)="success=false"></button>
      </div>
      <div *ngIf="error" class="alert alert-danger alert-dismissible">
        <i class="bi bi-exclamation-circle me-2"></i>{{ error }}
        <button class="btn-close" (click)="error=''"></button>
      </div>

      <!-- ── Informations générales ──────────────────────────────────── -->
      <div class="card border-0 shadow-sm mb-4" style="border-radius:16px">
        <div class="card-header bg-white fw-semibold py-3" style="border-radius:16px 16px 0 0">
          <i class="bi bi-info-circle me-2 text-primary"></i>Informations générales
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label fw-semibold">Titre de l'examen *</label>
            <input type="text" class="form-control" [(ngModel)]="title"
                   placeholder="Ex: Examen de mi-semestre - Module Java">
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold">Description</label>
            <textarea class="form-control" [(ngModel)]="description" rows="2"
                      placeholder="Instructions pour les étudiants..."></textarea>
          </div>
          <div>
            <label class="form-label fw-semibold">Durée estimée (minutes) *</label>
            <input type="number" class="form-control" [(ngModel)]="estimatedDurationMinutes" min="1" style="max-width:160px">
            <small class="text-muted">
              Utilisée pour bloquer temporairement un étudiant exclu pour violation des règles anti-triche
              (il ne pourra se reconnecter et voir son résultat qu'une fois ce temps écoulé).
            </small>
          </div>
        </div>
      </div>

      <!-- ── Questions ──────────────────────────────────────────────── -->
      <div class="card border-0 shadow-sm mb-4" style="border-radius:16px">
        <div class="card-header bg-white py-3" style="border-radius:16px 16px 0 0">
          <span class="fw-semibold"><i class="bi bi-question-circle me-2 text-primary"></i>Questions</span>
          <div class="btn-group btn-group-sm ms-3" role="group">
            <button type="button" class="btn"
                    [class.btn-primary]="mode === 'manual'" [class.btn-outline-primary]="mode !== 'manual'"
                    (click)="mode = 'manual'">Saisie manuelle</button>
            <button type="button" class="btn"
                    [class.btn-primary]="mode === 'upload'" [class.btn-outline-primary]="mode !== 'upload'"
                    (click)="mode = 'upload'">Importer document + correction</button>
          </div>
        </div>

        <div class="card-body" *ngIf="mode === 'manual'">
          <div class="d-flex justify-content-end mb-2">
            <button class="btn btn-sm btn-outline-primary" (click)="addQuestion()">
              <i class="bi bi-plus me-1"></i>Ajouter une question
            </button>
          </div>
          <div *ngIf="questions.length === 0" class="text-center py-4 text-muted">
            <i class="bi bi-question-square" style="font-size:2rem"></i>
            <p class="mt-2">Aucune question. Cliquez sur "Ajouter une question".</p>
          </div>
          <div *ngFor="let q of questions; let i = index" class="border rounded p-3 mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="fw-semibold text-primary">Question {{ i + 1 }}</span>
              <button class="btn btn-sm btn-outline-danger" (click)="removeQuestion(i)">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <div class="mb-2">
              <label class="form-label small fw-semibold">Énoncé *</label>
              <textarea class="form-control form-control-sm" [(ngModel)]="q.questionText" rows="2"
                        placeholder="Ex: Expliquez le principe d'encapsulation en POO"></textarea>
            </div>
            <div class="mb-2">
              <label class="form-label small fw-semibold">Réponse de référence *</label>
              <textarea class="form-control form-control-sm" [(ngModel)]="q.referenceAnswer" rows="3"
                        placeholder="Réponse modèle attendue..."></textarea>
            </div>
            <div>
              <label class="form-label small fw-semibold">Note maximale *</label>
              <input type="number" class="form-control form-control-sm" [(ngModel)]="q.maxScore"
                     min="1" style="max-width:120px">
            </div>
          </div>
        </div>
        <div *ngIf="mode === 'manual' && questions.length > 0" class="card-footer bg-light text-end small text-muted">
          Note totale : {{ totalScore }} pts
        </div>

        <div class="card-body" *ngIf="mode === 'upload'">
          <div class="alert alert-info small mb-3">
            <i class="bi bi-info-circle me-1"></i>
            Importez d'abord le document .docx de l'examen. Si le corrigé du cas pratique est dans un fichier séparé, importez-le ensuite.
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold">Document .docx de l'examen *</label>
            <input type="file" class="form-control" (change)="onExamFileSelected($event)" accept=".pdf,.docx,.doc">
            <div *ngIf="examFile" class="text-success small mt-1">
              <i class="bi bi-check-circle me-1"></i>{{ examFile.name }}
            </div>
          </div>
          <div *ngIf="examFile">
            <label class="form-label fw-semibold">Correction du cas pratique (optionnel)</label>
            <input type="file" class="form-control" (change)="onCorrectionFileSelected($event)" accept=".pdf,.docx,.doc">
            <div *ngIf="correctionFile" class="text-success small mt-1">
              <i class="bi bi-check-circle me-1"></i>{{ correctionFile.name }}
            </div>
            <small class="text-muted d-block mt-1">Si aucun fichier de correction n'est fourni, le système réutilise le document importé comme source de référence.</small>
          </div>
        </div>
      </div>

      <!-- ── Étudiants ─────────────────────────────────────────────── -->
      <div class="card border-0 shadow-sm mb-4" style="border-radius:16px;border:2px dashed #d5d9ef!important">
        <div class="card-body p-4">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                 style="width:44px;height:44px;background:#eef0fb;color:#2b3ea8;font-size:1.3rem">
              <i class="bi bi-people"></i>
            </div>
            <div class="flex-grow-1">
              <h6 class="fw-bold mb-0">Étudiants *</h6>
              <p class="text-muted mb-0 small">
                Choisissez des niveaux, ajoutez des étudiants un par un ou importez une liste (les trois se combinent).
              </p>
            </div>
          </div>
          <app-student-picker [students]="students" [targetLevels]="targetLevels"></app-student-picker>
        </div>
      </div>

      <!-- ── Actions ────────────────────────────────────────────────── -->
      <div class="d-flex gap-3 justify-content-end">
        <a routerLink="/teacher/exams" class="btn btn-outline-secondary">Annuler</a>
        <button class="btn btn-primary px-4" (click)="submit()" [disabled]="loading || !isValid()">
          <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
          <i *ngIf="!loading" class="bi bi-floppy me-2"></i>
          {{ loading ? 'Création...' : 'Créer l\'examen' }}
        </button>
      </div>
    </div>
  `
})
export class ExamCreateComponent {
  title = '';
  description = '';
  estimatedDurationMinutes = 60;
  questions: ExamQuestionForm[] = [];
  mode: 'manual' | 'upload' = 'manual';
  examFile: File | null = null;
  correctionFile: File | null = null;
  loading = false;
  success = false;
  error = '';

  // Étudiants : niveaux et/ou liste
  students: PickedStudent[] = [];
  targetLevels = new Set<string>();

  constructor(private examService: ExamService, private router: Router) {}

  get totalScore(): number { return this.questions.reduce((s, q) => s + (q.maxScore || 0), 0); }

  addQuestion() { this.questions.push({ questionText: '', referenceAnswer: '', maxScore: 10 }); }
  removeQuestion(i: number) { this.questions.splice(i, 1); }
  onExamFileSelected(e: Event) { this.examFile = (e.target as HTMLInputElement).files?.[0] || null; }
  onCorrectionFileSelected(e: Event) { this.correctionFile = (e.target as HTMLInputElement).files?.[0] || null; }

  isValid(): boolean {
    if (!this.title.trim() || (this.students.length === 0 && this.targetLevels.size === 0)) return false;
    if (!this.estimatedDurationMinutes || this.estimatedDurationMinutes <= 0) return false;
    if (this.mode === 'manual') {
      return this.questions.length > 0
        && this.questions.every(q => q.questionText.trim() && q.referenceAnswer.trim() && q.maxScore > 0);
    }
    return !!this.examFile;
  }

  submit() {
    if (!this.isValid()) return;
    this.loading = true;
    this.error = '';

    const file = this.students.length ? studentsCsv(this.students) : null;

    const questions = this.mode === 'manual' ? this.questions : [];
    const examFile = this.mode === 'upload' ? this.examFile! : undefined;
    const correctionFile = this.mode === 'upload' ? this.correctionFile! : undefined;

    this.examService.createExam(
      { title: this.title, description: this.description, estimatedDurationMinutes: this.estimatedDurationMinutes, questions,
        targetLevels: [...this.targetLevels] },
      file,
      examFile,
      correctionFile
    ).subscribe({
      next: () => { this.success = true; setTimeout(() => this.router.navigate(['/teacher/exams']), 1500); },
      error: e => { this.error = e?.error?.message || 'Erreur lors de la création'; this.loading = false; }
    });
  }
}
