import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IdeService } from '../../core/services/ide.service';
import { CourseService } from '../../core/services/course.service';
import { ProgressService } from '../../core/services/progress.service';
import { Lesson } from '../../core/models/course.model';
import { DialogService } from '../../core/services/dialog.service';

interface EditorTab {
  id: string;
  name: string;
  language: string;
  code: string;
}

@Component({
  selector: 'app-ide',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="fade-in-up">
      <div class="d-flex justify-content-between align-items-center mb-3" *ngIf="!isPdfOnly">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-laptop me-1"></i>IDE en ligne</h1>
          <p class="text-muted small">Écrivez et exécutez votre code directement dans le navigateur</p>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <select class="form-select form-select-sm" [(ngModel)]="selectedLanguage" (change)="onLanguageChange()">
            <option *ngFor="let lang of languages" [value]="lang.key">{{ lang.label }}</option>
          </select>
          <button class="btn btn-success fw-semibold px-4" (click)="executeCode()" [disabled]="loading">
            <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
            <i *ngIf="!loading" class="bi bi-play-fill me-1"></i>
            {{ loading ? 'Exécution...' : 'Exécuter' }}
          </button>
        </div>
      </div>

      <div class="mb-3" *ngIf="isPdfOnly">
        <h1 class="fw-bold mb-1"><i class="bi bi-file-earmark-text me-1"></i>Fiche d'exercice</h1>
        <p class="text-muted small">Lisez l'énoncé ci-dessous, puis marquez-le comme terminé.</p>
      </div>

      <!-- Anti-paste notice -->
      <div class="alert alert-warning d-flex align-items-center gap-2 mb-3 py-2" *ngIf="!isPdfOnly">
        <i class="bi bi-shield-exclamation"></i>
        <small><strong>Mode anti-copie activé :</strong> Le copier-coller est désactivé pour encourager la pratique active.</small>
      </div>

      <div class="d-flex gap-3">
        <!-- Exercise panel -->
        <div *ngIf="exercise" class="exercise-panel" [class.exercise-panel-wide]="exercise.pdfUrl" [class.exercise-panel-full]="isPdfOnly">
          <div class="card border-0 shadow-sm h-100" style="border-radius:12px">
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge bg-primary">
                  <i class="bi" [class.bi-file-pdf]="isPdfOnly" [class.bi-code-slash]="!isPdfOnly"></i> Exercice
                </span>
                <span *ngIf="exercise.completed" class="badge bg-success">
                  <i class="bi bi-check-circle me-1"></i>Terminé
                </span>
              </div>
              <h5 class="fw-bold">{{ exercise.title }}</h5>

              <!-- Énoncé PDF (feuille de TP) -->
              <iframe *ngIf="exercise.pdfUrl" [src]="safeDocUrl(exercise.pdfUrl)"
                      class="exercise-pdf flex-grow-1 border rounded-3 mb-3"></iframe>

              <!-- Énoncé texte (si pas de PDF) -->
              <div *ngIf="!exercise.pdfUrl" class="text-muted small mb-3 flex-grow-1" style="white-space: pre-wrap;">
                {{ exercise.description }}
              </div>

              <div class="d-flex flex-column gap-2">
                <button *ngIf="!exercise.completed" class="btn btn-success btn-sm" (click)="markComplete()" [disabled]="markingComplete">
                  <span *ngIf="markingComplete" class="spinner-border spinner-border-sm me-2"></span>
                  <i *ngIf="!markingComplete" class="bi bi-check-circle me-1"></i>Marquer comme terminé
                </button>
                <a *ngIf="exercise.courseId" [routerLink]="['/courses', exercise.courseId, 'learn']" class="btn btn-outline-secondary btn-sm">
                  <i class="bi bi-arrow-left me-1"></i>Retour au cours
                </a>
                <a *ngIf="!exercise.courseId" routerLink="/exercises" class="btn btn-outline-secondary btn-sm">
                  <i class="bi bi-arrow-left me-1"></i>Retour aux cas pratiques
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- IDE -->
        <div class="ide-wrapper flex-grow-1" *ngIf="!isPdfOnly">
          <div class="ide-container">
            <!-- Toolbar -->
            <div class="ide-toolbar">
              <div class="d-flex align-items-center gap-2">
                <div style="width:12px;height:12px;border-radius:50%;background:#ff5f57"></div>
                <div style="width:12px;height:12px;border-radius:50%;background:#ffbd2e"></div>
                <div style="width:12px;height:12px;border-radius:50%;background:#28ca41"></div>
              </div>
              <div class="text-secondary small ms-3">
                <i class="bi bi-file-code me-1"></i>{{ getFileName() }}
              </div>
              <div class="ms-auto d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary text-white border-secondary" (click)="clearCode()">
                  <i class="bi bi-trash"></i> Effacer
                </button>
                <button class="btn btn-sm btn-outline-secondary text-white border-secondary" (click)="loadTemplate()">
                  <i class="bi bi-lightning"></i> Modèle
                </button>
              </div>
            </div>

            <!-- Editor -->
            <div class="ide-editor">
              <div class="d-flex h-100">
                <!-- Line numbers -->
                <div class="line-numbers py-3 px-2 text-end" style="background:#181825; color:#585b70; font-family:monospace; font-size:0.875rem; min-width:50px; user-select:none;">
                  <div *ngFor="let line of lineNumbers" style="line-height:1.6em">{{ line }}</div>
                </div>
                <!-- Code textarea -->
                <textarea
                  class="flex-1 p-3 text-white"
                  [(ngModel)]="currentCode"
                  (input)="onCodeChange()"
                  (paste)="onPaste($event)"
                  (contextmenu)="onContextMenu($event)"
                  spellcheck="false"
                  autocomplete="off"
                  autocorrect="off"
                  style="background:#1e1e2e; border:none; outline:none; font-family:'Courier New',monospace; font-size:0.875rem; line-height:1.6em; resize:none; width:100%"
                  placeholder="Écrivez votre code ici... (copier-coller désactivé)">
                </textarea>
              </div>
            </div>

            <!-- Output -->
            <div class="ide-output">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="info-text fw-semibold">▶ Sortie</span>
                <span class="text-secondary small" *ngIf="executionTime">⏱ {{ executionTime }}ms</span>
              </div>
              <div *ngIf="!output && !outputError && !loading" class="text-secondary">
                En attente d'exécution...
              </div>
              <div *ngIf="loading" class="info-text">
                <span class="spinner-border spinner-border-sm me-2"></span>Exécution en cours...
              </div>
              <pre *ngIf="output" style="color:#a6e3a1; margin:0; white-space:pre-wrap;">{{ output }}</pre>
              <pre *ngIf="outputError" class="error-text" style="margin:0; white-space:pre-wrap;">{{ outputError }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Tips -->
      <div class="mt-3 row g-3" *ngIf="!exercise && !isPdfOnly">
        <div class="col-md-4">
          <div class="card border-0 bg-dark text-white p-3" style="border-radius:12px">
            <h6 class="fw-bold"><i class="bi bi-lightbulb text-warning me-2"></i>Raccourcis</h6>
            <div class="small text-secondary">
              <div>Cliquer <strong>Exécuter</strong> pour lancer le code</div>
              <div><strong>Modèle</strong> pour charger un exemple</div>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card border-0 bg-dark text-white p-3" style="border-radius:12px">
            <h6 class="fw-bold"><i class="bi bi-translate text-info me-2"></i>Langages</h6>
            <div class="d-flex flex-wrap gap-1 mt-1">
              <span *ngFor="let l of languages" class="badge bg-secondary">{{ l.label }}</span>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card border-0 bg-dark text-white p-3" style="border-radius:12px">
            <h6 class="fw-bold"><i class="bi bi-info-circle text-primary me-2"></i>Limites</h6>
            <div class="small text-secondary">
              <div>⏱ Timeout: 10 secondes</div>
              <div><i class="bi bi-lock me-1"></i>Accès système désactivé</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ide-container { height: calc(100vh - 300px); min-height: 450px; }
    .ide-wrapper { min-width: 0; }
    .exercise-panel { width: 340px; flex-shrink: 0; }
    .exercise-panel.exercise-panel-wide { width: 480px; }
    .exercise-panel.exercise-panel-full { width: 100%; }
    .exercise-panel .card { height: calc(100vh - 220px); min-height: 550px; }
    .exercise-pdf { width: 100%; min-height: 0; }
    textarea:focus { box-shadow: none !important; }
    .line-numbers { overflow: hidden; }
    @media(max-width: 992px) {
      .d-flex.gap-3 { flex-direction: column; }
      .exercise-panel, .exercise-panel.exercise-panel-wide { width: 100%; }
      .exercise-panel .card { height: auto; min-height: 400px; }
      .exercise-pdf { height: 70vh; }
    }
  `]
})
export class IdeComponent implements OnInit {
  selectedLanguage = 'python';
  currentCode = '';
  output = '';
  outputError = '';
  loading = false;
  executionTime = 0;

  exercise: Lesson | null = null;
  markingComplete = false;

  languages = [
    { key: 'python', label: 'Python', ext: '.py' },
    { key: 'javascript', label: 'JavaScript', ext: '.js' },
    { key: 'java', label: 'Java', ext: '.java' },
    { key: 'sql', label: 'SQL (simulation)', ext: '.sql' }
  ];

  templates: Record<string, string> = {
    python: `# Python - Bonjour le monde\nprint("Bonjour, ELearning!")\n\n# Calcul simple\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nfor i in range(10):\n    print(f"fib({i}) = {fibonacci(i)}")`,
    javascript: `// JavaScript - Bonjour le monde\nconsole.log("Bonjour, ELearning!");\n\n// Fonction fléchée\nconst factorielle = (n) => n <= 1 ? 1 : n * factorielle(n - 1);\n\nfor (let i = 0; i <= 10; i++) {\n  console.log(\`\${i}! = \${factorielle(i)}\`);\n}`,
    java: `// Java - Bonjour le monde\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Bonjour, ELearning!");\n        \n        // Boucle\n        for (int i = 1; i <= 5; i++) {\n            System.out.println("Ligne " + i);\n        }\n    }\n}`,
    sql: `-- SQL - Exemples de requêtes\n-- (Simulation - pas d'exécution réelle)\nSELECT * FROM students;\nSELECT name, grade FROM students WHERE grade > 10;\nSELECT COUNT(*) FROM courses;`
  };

  get isPdfOnly(): boolean {
    return !!this.exercise?.pdfUrl && !this.exercise?.starterCode?.trim();
  }

  get lineNumbers(): number[] {
    let count = (this.currentCode.match(/\n/g) || []).length + 1;
    return Array.from({ length: Math.max(count, 20) }, (_, i) => i + 1);
  }

  constructor(private dialogs: DialogService, 
    private ideService: IdeService,
    private courseService: CourseService,
    private progressService: ProgressService,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer
  ) {
    this.loadTemplate();
  }

  /**
   * Adresse sûre du document, gardée tant que le document ne change pas : une nouvelle valeur à chaque
   * rafraîchissement de l'écran rechargerait l'iframe (retour à la 1re page du PDF, clignotements).
   */
  safeDocUrl(url: string): SafeResourceUrl {
    if (url !== this.safeDoc?.url) this.safeDoc = { url, safe: this.sanitizer.bypassSecurityTrustResourceUrl(url) };
    return this.safeDoc.safe;
  }
  private safeDoc: { url: string; safe: SafeResourceUrl } | null = null;

  ngOnInit() {
    const lessonId = this.route.snapshot.queryParamMap.get('lessonId');
    if (lessonId) {
      this.courseService.getLessonById(+lessonId).subscribe(lesson => {
        this.exercise = lesson;
        if (lesson.language && this.languages.some(l => l.key === lesson.language)) {
          this.selectedLanguage = lesson.language;
        }
        this.currentCode = lesson.starterCode?.trim() ? lesson.starterCode : this.templates[this.selectedLanguage] || '';
        this.clearOutput();
      });
    }
  }

  onLanguageChange() { this.loadTemplate(); this.clearOutput(); }

  loadTemplate() {
    this.currentCode = this.templates[this.selectedLanguage] || '';
  }

  clearCode() { this.currentCode = ''; this.clearOutput(); }
  clearOutput() { this.output = ''; this.outputError = ''; this.executionTime = 0; }

  onCodeChange() { /* trigger line numbers update */ }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    // Show brief notification
    this.dialogs.toast('Copier-coller désactivé : écrivez le code vous-même pour mieux apprendre.', 'warning');
  }

  onContextMenu(event: MouseEvent) { event.preventDefault(); }

  getFileName(): string {
    let lang = this.languages.find(l => l.key === this.selectedLanguage);
    return `main${lang?.ext || '.txt'}`;
  }

  markComplete() {
    if (!this.exercise) return;
    this.markingComplete = true;
    this.progressService.completeLesson(this.exercise.id).subscribe({
      next: () => {
        this.exercise!.completed = true;
        this.markingComplete = false;
      },
      error: () => { this.markingComplete = false; }
    });
  }

  executeCode() {
    if (!this.currentCode.trim()) return;
    if (this.selectedLanguage === 'sql') {
      this.output = '-- Simulation SQL --\nQuery executed successfully!\n(Note: SQL nécessite une base de données réelle)';
      return;
    }
    this.loading = true;
    this.clearOutput();
    this.ideService.executeCode(this.currentCode, this.selectedLanguage).subscribe({
      next: (resp) => {
        this.loading = false;
        if (resp.success && resp.data) {
          this.output = resp.data['output'] || '';
          this.outputError = resp.data['error'] || '';
          this.executionTime = resp.data['executionTimeMs'] || 0;
        } else {
          this.outputError = resp.message || 'Erreur inconnue';
        }
      },
      error: (err) => {
        this.loading = false;
        this.outputError = 'Erreur de connexion au serveur';
      }
    });
  }
}
