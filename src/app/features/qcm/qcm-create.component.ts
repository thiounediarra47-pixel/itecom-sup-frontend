import { Component, OnInit, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DialogService, DialogRef, DIALOG_DATA } from '../../core/services/dialog.service';
import { StudentPickerComponent, PickedStudent, toPickedStudent } from '../../shared/components/student-picker.component';

interface Choice   { choiceText: string; isCorrect: boolean; }
interface Question {
  questionText: string;
  points: number;
  questionType: 'QCM' | 'PRACTICAL' | 'CASE' | 'LONG_TEXT';
  correctionData: string;
  caseScenario: string;
  expectedAnswer: string;
  choices: Choice[];
}


@Component({
  selector: 'app-qcm-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StudentPickerComponent],
  template: `
    <div class="fade-in-up" style="max-width:860px;margin:0 auto">

      <!-- En-tête (le titre est celui de la popup quand l'écran y est ouvert) -->
      <div *ngIf="!inDialog" class="d-flex align-items-center gap-3 mb-4">
        <a routerLink="/teacher/exams" class="btn btn-outline-secondary btn-sm"><i class="bi bi-arrow-left"></i></a>
        <div>
          <h1 class="fw-bold mb-0">{{ isEdit ? 'Modifier le devoir' : 'Créer un devoir' }}</h1>
          <p class="text-muted mb-0 small">Questions à choix multiples — correction automatique</p>
        </div>
      </div>

      <!-- ═══ Import depuis Word ════════════════════════════════════════════ -->
      <div *ngIf="!isEdit" class="card border-0 shadow-sm mb-4" style="border-radius:16px;border:2px dashed #d5d9ef!important">
        <div class="card-body p-4">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="rounded-circle d-flex align-items-center justify-content-center"
                 style="width:44px;height:44px;background:#eef0fb;color:#2b3ea8;font-size:1.3rem;flex-shrink:0">
              <i class="bi bi-file-earmark-text"></i>
            </div>
            <div>
              <h6 class="fw-bold mb-0">Importer depuis un fichier Word</h6>
              <p class="text-muted mb-0 small">Importez un fichier .docx structuré et les questions seront extraites automatiquement</p>
            </div>
            <div class="d-flex gap-2 ms-auto flex-shrink-0">
                <button type="button" (click)="downloadTemplate()"
                  class="btn btn-outline-secondary fw-semibold" style="border-radius:10px;white-space:nowrap">
                <i class="bi bi-download me-2"></i>Télécharger le modèle
                </button>
              <button class="btn btn-outline-primary fw-semibold" style="border-radius:10px;white-space:nowrap"
                      (click)="wordFileInput.click()" [disabled]="wordLoading">
                <span *ngIf="wordLoading" class="spinner-border spinner-border-sm me-2"></span>
                <i *ngIf="!wordLoading" class="bi bi-upload me-2"></i>
                {{ wordLoading ? 'Lecture...' : 'Importer un .docx' }}
              </button>
            </div>
            <input #wordFileInput type="file" accept=".docx" style="display:none" (change)="onWordFile($event)">
          </div>

          <!-- Format attendu -->
          <div *ngIf="!wordError && !wordPreview" class="p-3 rounded-3" style="background:var(--surface-muted);font-size:.82rem">
            <p class="fw-semibold mb-2 text-muted">Format attendu dans le fichier Word :</p>
            <code style="display:block;white-space:pre;color:#1f2d7a;font-size:.78rem">Titre: Examen Java Chapitre 3
Description: Durée 30 minutes
Question 1: Qu'est-ce qu'un objet en Java ?
A) Un type primitif
B) Une instance de classe
C) Un tableau
Bonne réponse: B

Question 2: Quelle est la taille d'un int ?
A) 8 bits   B) 16 bits   C) 32 bits   D) 64 bits
Bonne réponse: C</code>
          </div>

          <!-- Erreur import -->
          <div *ngIf="wordError" class="alert alert-danger mt-2 mb-0 py-2">
            <i class="bi bi-exclamation-triangle me-2"></i>{{ wordError }}
          </div>

          <!-- Aperçu importé -->
          <div *ngIf="wordPreview" class="mt-3">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Importé</span>
                <span class="text-muted small">{{ wordPreview.questions.length }} question(s) détectée(s)</span>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary" (click)="wordPreview = null; wordError = ''">
                  <i class="bi bi-x me-1"></i>Annuler
                </button>
                <button class="btn btn-sm fw-semibold" (click)="applyWordPreview()"
                        style="background:#2b3ea8;color:white;border-radius:8px">
                  <i class="bi bi-check2 me-1"></i>Utiliser ces questions
                </button>
              </div>
            </div>

            <!-- Questions preview -->
            <div *ngFor="let q of wordPreview.questions; let qi = index"
                 class="p-3 rounded-3 mb-2" style="background:var(--surface-muted);border:1px solid #eef0fb">
              <div class="d-flex gap-2 mb-2">
                <span class="fw-bold" style="color:#2b3ea8;min-width:24px">Q{{ qi + 1 }}</span>
                <span class="fw-semibold">{{ q.questionText || '(sans texte)' }}</span>
                <span class="badge rounded-pill ms-auto" style="background:#eef0fb;color:#1f2d7a">{{ q.points }} pt</span>
              </div>
              <div *ngFor="let c of q.choices; let ci = index"
                   class="d-flex align-items-center gap-2 mb-1" style="padding-left:24px;font-size:.88rem">
                <span class="fw-semibold" [style.color]="c.isCorrect ? '#10b981' : '#6b7280'"
                      style="min-width:18px">{{ labels[ci] }}</span>
                <span [class.fw-semibold]="c.isCorrect" [style.color]="c.isCorrect ? '#059669' : '#374151'">
                  {{ c.choiceText || '(vide)' }}
                </span>
                <i *ngIf="c.isCorrect" class="bi bi-check-circle-fill text-success ms-1"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ Infos générales ══════════════════════════════════════════════ -->
      <div class="card border-0 shadow-sm mb-4" style="border-radius:16px">
        <div class="card-body p-4">
          <h5 class="fw-bold mb-3"><i class="bi bi-clipboard-check me-1"></i>Informations générales</h5>
          <div class="mb-3">
            <label class="form-label fw-semibold">Titre du QCM *</label>
            <input type="text" class="form-control" [(ngModel)]="title" placeholder="Ex : Examen Java – Chapitre 3">
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
          <div class="form-check form-switch mt-3">
            <input class="form-check-input" type="checkbox" id="paperCorrectionRequired" [(ngModel)]="paperCorrectionRequired">
            <label class="form-check-label fw-semibold" for="paperCorrectionRequired">
              Exiger une copie papier scannée avant la soumission
            </label>
            <div class="form-text">L’étudiant devra photographier ou scanner sa correction manuscrite et la joindre au devoir.</div>
          </div>
        </div>
      </div>

      <div class="card border-0 shadow-sm mb-4" style="border-radius:16px;border:2px dashed #d5d9ef!important">
        <div class="card-body p-4">
          <h5 class="fw-bold mb-1">Sujet et correction de référence</h5>
          <p class="text-muted small mb-3">
            Déposez les deux fichiers. Le sujet est conservé pour l’étudiant et la correction est extraite côté serveur.
            Les points sont attribués uniquement avec les critères structurés des questions pratiques.
          </p>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-semibold">Sujet</label>
              <input type="file" class="form-control" accept=".pdf,.docx,.xlsx,.xls" (change)="onSubjectFile($event)">
              <small class="text-muted" *ngIf="subjectFile">{{ subjectFile.name }}</small>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Correction professeur</label>
              <input type="file" class="form-control" accept=".pdf,.docx,.xlsx,.xls" (change)="onCorrectionFile($event)">
              <small class="text-muted" *ngIf="correctionFile">{{ correctionFile.name }}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ Questions ════════════════════════════════════════════════════ -->
      <div *ngFor="let q of questions; let qi = index"
           class="card border-0 shadow-sm mb-3" style="border-radius:16px;overflow:hidden">
        <div style="height:4px;background:#2b3ea8"></div>
        <div class="card-body p-4">
          <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
            <div class="d-flex align-items-center gap-2 flex-grow-1">
              <span class="fw-bold" style="color:#2b3ea8;font-size:1.1rem;min-width:28px">Q{{ qi + 1 }}</span>
              <input type="text" class="form-control fw-semibold"
                     [(ngModel)]="q.questionText" placeholder="Énoncé de la question...">
            </div>
            <div class="d-flex align-items-center gap-2 flex-shrink-0">
              <div style="width:100px">
                <div class="input-group input-group-sm">
                  <span class="input-group-text bg-white">pts</span>
                  <input type="number" class="form-control text-center" [(ngModel)]="q.points" min="1" max="10">
                </div>
              </div>
              <button class="btn btn-outline-danger btn-sm" (click)="removeQuestion(qi)"
                      [disabled]="questions.length === 1">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label fw-semibold">Type de question</label>
            <select class="form-select" [(ngModel)]="q.questionType">
              <option value="QCM">Question à choix</option>
              <option value="PRACTICAL">Cas pratique / calcul</option>
              <option value="CASE">Étude de cas de commerce</option>
              <option value="LONG_TEXT">Réponse écrite argumentée</option>
            </select>
          </div>

          <div *ngIf="q.questionType === 'PRACTICAL'" class="alert alert-warning small">
            <label class="form-label fw-semibold">Correction de référence par valeur</label>
            <textarea class="form-control font-monospace" [(ngModel)]="q.correctionData" rows="4"
              placeholder='{"cout_achat_mil": 7920000, "production_pas": 137000}'></textarea>
            <div class="mt-2">JSON strict : chaque clé devient un champ étudiant. Les valeurs sont comparées avec une tolérance de 0,1 %.</div>
          </div>

          <div *ngIf="q.questionType === 'CASE' || q.questionType === 'PRACTICAL'" class="alert alert-info small">
            <label class="form-label fw-semibold">Contexte du cas de commerce</label>
            <textarea class="form-control mb-2" [(ngModel)]="q.caseScenario" rows="4"
              placeholder="Ex : La société XYZ veut lancer une gamme premium... (facultatif pour un calcul simple)"></textarea>
            <label class="form-label fw-semibold">Données de correction / réponse attendue</label>
            <textarea class="form-control font-monospace" [(ngModel)]="q.correctionData" rows="4"
              placeholder='{"marge_brute": 180000, "seuil_rentabilite": 7200}'></textarea>
            <div class="mt-2">Le cas peut mêler contexte, calculs et analyse stratégique pour un devoir d’école de commerce.</div>
          </div>

          <div *ngIf="q.questionType === 'LONG_TEXT'" class="alert alert-secondary small">
            <label class="form-label fw-semibold">Réponse attendue (corrigé)</label>
            <textarea class="form-control" [(ngModel)]="q.expectedAnswer" rows="4"
              placeholder="Indiquez les éléments attendus : prix, cible, positionnement, rentabilité..."></textarea>
          </div>

          <!-- Choix -->
          <ng-container *ngIf="q.questionType === 'QCM'">
          <div *ngFor="let c of q.choices; let ci = index" class="d-flex align-items-center gap-2 mb-2">
            <div class="d-flex align-items-center justify-content-center fw-bold rounded"
                 style="width:32px;height:32px;background:#f3f4f6;color:#6b7280;font-size:.85rem;flex-shrink:0">
              {{ labels[ci] }}
            </div>
            <input type="text" class="form-control" [(ngModel)]="c.choiceText"
                   [placeholder]="'Choix ' + labels[ci] + '...'"
                   [style.border-color]="c.isCorrect ? '#10b981' : ''"
                   [style.background]="c.isCorrect ? '#f0fdf4' : ''">
            <div class="form-check mb-0 flex-shrink-0 d-flex align-items-center gap-1">
              <input type="radio" class="form-check-input" style="cursor:pointer"
                     [name]="'correct_' + qi" [checked]="c.isCorrect"
                     (change)="setCorrect(q, ci)">
              <label class="form-check-label small" style="color:#10b981;font-weight:600;cursor:pointer">
                Bonne réponse
              </label>
            </div>
            <button class="btn btn-sm btn-outline-secondary px-2" (click)="removeChoice(q, ci)"
                    [disabled]="q.choices.length <= 2">
              <i class="bi bi-x"></i>
            </button>
          </div>

          <button class="btn btn-sm btn-outline-secondary mt-1" (click)="addChoice(q)"
                  [disabled]="q.choices.length >= 5">
            <i class="bi bi-plus me-1"></i>Ajouter un choix
          </button>
          </ng-container>
        </div>
      </div>

      <!-- Ajouter question -->
      <button class="btn btn-outline-primary w-100 mb-4 py-2" style="border-radius:12px;border-style:dashed"
              (click)="addQuestion()">
        <i class="bi bi-plus-circle me-2"></i>Ajouter une question
      </button>


      <!-- ═══ Étudiants concernés ══════════════════════════════════════════ -->
      <div class="card border-0 shadow-sm mb-4" style="border-radius:16px;border:2px dashed #d5d9ef!important">
        <div class="card-body p-4">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                 style="width:44px;height:44px;background:#eef0fb;color:#2b3ea8;font-size:1.3rem"><i class="bi bi-people"></i></div>
            <div class="flex-grow-1">
              <h6 class="fw-bold mb-0">Étudiants concernés <span class="badge rounded-pill bg-secondary ms-1" style="font-size:.7rem">Optionnel</span></h6>
              <p class="text-muted mb-0 small">
                Choisissez des niveaux, ajoutez des étudiants un par un ou importez une liste (les trois se combinent).
                Sans aucun choix, le devoir est visible par tous les étudiants approuvés.
              </p>
            </div>
          </div>
          <div *ngIf="studentListError" id="studentListError" class="alert alert-danger py-2 mb-3">
            <i class="bi bi-exclamation-octagon me-2"></i>{{ studentListError }}
          </div>
          <app-student-picker [students]="students" [targetLevels]="targetLevels"
                              [invalidEmails]="invalidEmails" [emptyMeansAll]="true"></app-student-picker>
        </div>
      </div>

      <!-- Résumé + actions -->
      <div class="card border-0 shadow-sm" style="border-radius:16px;background:var(--surface-muted)">
        <div class="card-body p-4 d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div class="text-muted small">
            <strong>{{ questions.length }}</strong> question(s) ·
            <strong>{{ totalPoints }}</strong> point(s) au total
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary" (click)="finish(false)">Annuler</button>
                <button class="btn fw-semibold px-4" (click)="save()"
                  [disabled]="loading || !canSave"
                    style="background:#2b3ea8;color:white;border-radius:10px">
              <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
              {{ loading ? 'Enregistrement...' : (isEdit ? 'Enregistrer' : 'Créer le devoir') }}
            </button>
          </div>
        </div>
      </div>

      <div class="alert alert-danger mt-3" *ngIf="error">{{ error }}</div>
    </div>
  `
})
export class QcmCreateComponent implements OnInit {
  @ViewChild('wordFileInput') wordFileInput!: ElementRef;

  title = '';
  description = '';
  estimatedDurationMinutes = 30;
  paperCorrectionRequired = false;
  questions: Question[] = [];
  labels = ['A', 'B', 'C', 'D', 'E'];
  loading = false;
  error = '';
  isEdit = false;
  editId: number | null = null;

  wordLoading = false;
  wordError = '';
  wordPreview: { title: string; description: string; questions: Question[] } | null = null;

  // ── Étudiants ─────────────────────────────────────────────────────────
  students: PickedStudent[] = [];
  targetLevels = new Set<string>();
  subjectFile: File | null = null;
  correctionFile: File | null = null;


  /** Ouvert dans une popup (depuis une liste) ou comme page. */
  private readonly dialogRef = inject(DialogRef, { optional: true });
  private readonly dialogData = inject<{ id?: number } | null>(DIALOG_DATA, { optional: true });
  get inDialog(): boolean { return !!this.dialogRef; }

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute, private dialogs: DialogService) {}

  /** Fin de l'écran : fermeture de la popup (avec rafraîchissement de la liste) ou retour à la liste. */
  finish(saved: boolean) {
    if (saved) this.dialogs.toast(this.isEdit ? 'Devoir enregistré' : 'Devoir créé');
    if (this.dialogRef) this.dialogRef.close(saved);
    else this.router.navigate(['/teacher/exams']);
  }

  onSubjectFile(event: Event) {
    this.subjectFile = (event.target as HTMLInputElement).files?.[0] || null;
    this.removeEmptyQuestionForDocuments();
  }

  onCorrectionFile(event: Event) {
    this.correctionFile = (event.target as HTMLInputElement).files?.[0] || null;
    this.removeEmptyQuestionForDocuments();
  }

  private removeEmptyQuestionForDocuments() {
    if (this.subjectFile && this.correctionFile && this.questions.length === 1
        && !this.questions[0].questionText.trim()) {
      this.questions = [];
    }
  }

  ngOnInit() {
    const id = this.dialogData?.id != null ? String(this.dialogData.id) : this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true; this.editId = +id;
      this.http.get<any>(`/api/teacher/qcms/${id}`).subscribe(qcm => {
        this.title = qcm.title;
        this.description = qcm.description || '';
        this.estimatedDurationMinutes = qcm.estimatedDurationMinutes || 30;
        this.paperCorrectionRequired = !!qcm.paperCorrectionRequired;
        this.targetLevels = new Set(qcm.targetLevels || []);
        this.questions = (qcm.questions || []).map((q: any) => ({
          questionText: q.questionText,
          points: q.points,
          questionType: q.questionType || 'QCM',
          correctionData: q.correctionData || '',
          caseScenario: q.caseScenario || '',
          expectedAnswer: q.expectedAnswer || '',
          choices: (q.choices || []).map((c: any) => ({ choiceText: c.choiceText, isCorrect: c.isCorrect }))
        }));
        this.students = (qcm.students || []).map((s: any) => toPickedStudent({
          name: s.studentName, email: s.studentEmail, firstName: s.firstName,
          lastName: s.lastName, level: s.level
        }));
        if (!this.questions.length) this.addQuestion();
      });
    } else {
      this.addQuestion();
    }
  }

  // ── Import Word ──────────────────────────────────────────────────────────

  onWordFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';
    this.wordLoading = true;
    this.wordError = '';
    this.wordPreview = null;

    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>('/api/teacher/qcms/parse-word', fd).subscribe({
      next: data => {
        this.wordLoading = false;
        if (!data.questions?.length) {
          this.wordError = 'Aucune question détectée. Vérifiez le format du fichier.';
          return;
        }
        this.wordPreview = {
          title: data.title || '',
          description: data.description || '',
          questions: data.questions
        };
      },
      error: err => {
        this.wordLoading = false;
        this.wordError = err.error?.error || 'Erreur lors de la lecture du fichier.';
      }
    });
  }

  downloadTemplate() {
    this.http.get('/api/teacher/qcms/template', { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'modele_qcm.docx';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.wordError = 'Impossible de télécharger le modèle. Vérifiez votre connexion et votre session enseignant.';
      }
    });
  }

  applyWordPreview() {
    if (!this.wordPreview) return;
    if (!this.title.trim() && this.wordPreview.title) this.title = this.wordPreview.title;
    if (!this.description.trim() && this.wordPreview.description) this.description = this.wordPreview.description;
    this.questions = this.wordPreview.questions.map(q => ({
      questionText: q.questionText,
      points: q.points || 1,
      questionType: 'QCM',
      correctionData: '',
      caseScenario: '',
      expectedAnswer: '',
      choices: (q.choices || []).map(c => ({ choiceText: c.choiceText, isCorrect: !!c.isCorrect }))
    }));
    if (!this.questions.length) this.addQuestion();
    this.wordPreview = null;
    this.wordError = '';
  }

  // ── Gestion questions ────────────────────────────────────────────────────

  addQuestion() {
    this.questions.push({
      questionText: '', points: 1, questionType: 'QCM', correctionData: '', caseScenario: '', expectedAnswer: '',
      choices: [
        { choiceText: '', isCorrect: true },
        { choiceText: '', isCorrect: false },
        { choiceText: '', isCorrect: false },
        { choiceText: '', isCorrect: false },
      ]
    });
  }

  removeQuestion(i: number) { this.questions.splice(i, 1); }

  addChoice(q: Question) { q.choices.push({ choiceText: '', isCorrect: false }); }

  removeChoice(q: Question, i: number) {
    const wasCorrect = q.choices[i].isCorrect;
    q.choices.splice(i, 1);
    if (wasCorrect && q.choices.length) q.choices[0].isCorrect = true;
  }

  setCorrect(q: Question, correctIndex: number) {
    q.choices.forEach((c, i) => c.isCorrect = i === correctIndex);
  }

  get totalPoints() { return this.questions.reduce((s, q) => s + (q.points || 1), 0); }

  get isValid() {
    return this.questions.length > 0 && this.questions.every(q =>
      !!q.questionText.trim() &&
      (q.questionType === 'PRACTICAL'
        ? q.correctionData.trim().startsWith('{')
        : q.questionType === 'CASE'
          ? q.caseScenario.trim() && q.correctionData.trim().startsWith('{')
          : q.questionType === 'LONG_TEXT'
            ? q.expectedAnswer.trim()
            : q.choices.length >= 2 && q.choices.some(c => c.isCorrect) && q.choices.every(c => c.choiceText.trim()))
    );
  }

  get canSave() {
    const documentsReady = !!this.subjectFile && !!this.correctionFile;
    return !!this.title.trim() && (documentsReady || this.isValid);
  }

  invalidEmails = new Set<string>();
  studentListError = '';

  save() {
    this.invalidEmails = new Set();
    this.studentListError = '';
    if (!this.canSave) {
      this.error = 'Saisissez un titre et fournissez soit des questions valides, soit le sujet et la correction.';
      return;
    }
    this.loading = true; this.error = '';
    const body = {
      title: this.title,
      description: this.description,
      estimatedDurationMinutes: this.estimatedDurationMinutes,
      paperCorrectionRequired: this.paperCorrectionRequired,
      targetLevels: [...this.targetLevels],
      questions: this.questions,
      students: this.students.filter(s => s.email.trim()).map(s => ({
        ...s,
        name: `${s.firstName.trim()} ${s.lastName.trim()}`.trim() || s.name
      }))
    };
    const req = this.isEdit
      ? this.http.put(`/api/teacher/qcms/${this.editId}`, body)
      : this.http.post('/api/teacher/qcms', body);
    req.subscribe({
      next: (saved: any) => {
        const id = this.editId || saved.id;
        if (!this.subjectFile && !this.correctionFile) {
          this.finish(true);
          return;
        }
        if (!this.subjectFile || !this.correctionFile) {
          this.error = 'Sélectionnez le sujet et la correction avant de continuer.';
          this.loading = false;
          return;
        }
        const files = new FormData();
        files.append('subjectFile', this.subjectFile);
        files.append('correctionFile', this.correctionFile);
        this.http.post(`/api/teacher/qcms/${id}/documents`, files).subscribe({
          next: () => this.finish(true),
          error: e => { this.error = e.error?.error || 'Erreur lors de l’enregistrement des documents.'; this.loading = false; }
        });
      },
      error: (e) => {
        this.error = e.error?.message || 'Erreur';
        this.loading = false;
        const invalid: string[] = e.error?.invalidEmails || [];
        this.invalidEmails = new Set(invalid.map(email => email.toLowerCase()));
        this.studentListError = invalid.length ? this.error : '';
        if (invalid.length) {
          setTimeout(() => document.getElementById('studentListError')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        }
      }
    });
  }
}
