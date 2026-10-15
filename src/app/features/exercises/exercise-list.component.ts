import { Component, OnInit, OnDestroy } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { UploadService } from '../../core/services/upload.service';
import { ProgressService } from '../../core/services/progress.service';
import { IdeService } from '../../core/services/ide.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Lesson } from '../../core/models/course.model';
import { DialogService } from '../../core/services/dialog.service';

const CODE_FILE_EXTENSIONS: Record<string, string> = {
  py: 'python', js: 'javascript', java: 'java', sql: 'sql', txt: 'python'
};

interface EditorTab {
  id: string;
  name: string;
  language: string;
  code: string;
}

interface ProjectFile {
  id: string;
  packageName: string; // '' = package par défaut
  className: string;
  kind: 'CLASS' | 'INTERFACE';
  content: string;
}

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="fade-in-up" style="height:100vh;display:flex;flex-direction:column">
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-center mb-3 px-4 pt-4" *ngIf="isTeacher">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-clipboard-data me-1"></i>Cas pratiques</h1>
          <p class="text-muted small">Gestion des exercices de code et Excel</p>
        </div>
        <button class="btn btn-primary-custom" (click)="startCreate()">
          <i class="bi bi-plus-circle me-2"></i>Nouvel exercice
        </button>
      </div>

      <!-- Main container: List + IDE side by side -->
      <div class="d-flex gap-3 flex-grow-1 overflow-hidden px-4" style="min-height:0">
        <!-- Left: Exercise List -->
        <div class="exercise-list-panel" [ngStyle]="{ width: leftCollapsed ? '4%' : '16%' }" style="min-width:140px;overflow-y:auto;overscroll-behavior:contain;flex-shrink:0">
          <div class="d-flex justify-content-end mb-2">
            <button class="btn btn-sm btn-outline-secondary" (click)="toggleLeft()" title="Réduire/agrandir la liste">
              <i class="bi" [class.bi-chevron-double-left]="!leftCollapsed" [class.bi-chevron-double-right]="leftCollapsed"></i>
            </button>
          </div>
          <!-- Create/Edit Form -->
          <div *ngIf="form" class="card border-0 shadow-sm p-3 mb-4" style="border-radius:12px">
            <h5 class="fw-bold mb-3">{{ editingId ? 'Modifier' : 'Nouvel' }} exercice</h5>
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <div class="mb-2">
                <label class="form-label fw-semibold small">Titre *</label>
                <input type="text" class="form-control form-control-sm" formControlName="title">
              </div>
              <div class="mb-2">
                <label class="form-label fw-semibold small">Type *</label>
                <select class="form-select form-select-sm" formControlName="type">
                  <option value="CODE_EXERCISE">Code / PDF</option>
                  <option value="EXCEL_EXERCISE">Tableur</option>
                </select>
              </div>
              <div class="mb-2" *ngIf="form.get('type')?.value === 'CODE_EXERCISE'">
                <label class="form-label fw-semibold small">Langage</label>
                <select class="form-select form-select-sm" formControlName="language">
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java (packages/classes)</option>
                  <option value="sql">SQL</option>
                </select>
              </div>
              <div class="mb-2">
                <label class="form-label fw-semibold small">Description</label>
                <textarea class="form-control form-control-sm" rows="2" formControlName="description"></textarea>
              </div>
              <div *ngIf="formError" class="alert alert-danger py-2 small">{{ formError }}</div>
              <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving">
                  {{ editingId ? 'Enregistrer' : 'Créer' }}
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cancelForm()">Annuler</button>
              </div>
            </form>
          </div>

          <!-- Exercises List -->
          <div *ngIf="loading" class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary"></div>
          </div>

          <div *ngIf="!loading && exercises.length === 0" class="text-center py-3 text-muted small">
            <p>Aucun exercice</p>
          </div>

          <div class="d-flex flex-column gap-2" *ngIf="!loading">
            <div *ngFor="let ex of exercises | paginate: exercisesPg.page : exercisesPg.size"
                 id="exercise-{{ex.id}}"
                 class="card border-0 p-3 cursor-pointer exercise-card"
                 [class.bg-primary]="selectedExercise?.id === ex.id"
                 [class.text-white]="selectedExercise?.id === ex.id"
                 [class.bg-light]="selectedExercise?.id !== ex.id"
                 (click)="selectExercise(ex)"
                 style="border-radius:10px;cursor:pointer;transition:all 0.2s;border-left:3px solid #2b3ea8">
              <h6 class="fw-bold mb-1 small" style="word-break:break-word">{{ ex.title }}</h6>
              <p class="text-muted small mb-1" [class.text-white-50]="selectedExercise?.id === ex.id" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                {{ ex.description || '—' }}
              </p>
              <div class="d-flex gap-1 small">
                <span class="badge" [class.badge-success]="ex.completed" [class.badge-light]="!ex.completed">
                  {{ ex.completed ? 'Fait' : 'À faire' }}
                </span>
                <span class="badge" [ngClass]="ex.type === 'EXCEL_EXERCISE' ? 'badge-info' : 'badge-primary'">
                  <i class="bi" [ngClass]="ex.type === 'EXCEL_EXERCISE' ? 'bi-bar-chart' : 'bi-laptop'"></i>
                </span>
              </div>
              <ng-container *ngIf="isTeacher && selectedExercise?.id === ex.id">
                <div class="d-flex gap-1 mt-2">
                  <button class="btn btn-sm btn-outline-light" (click)="startEdit(ex); $event.stopPropagation()">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" (click)="deleteExercise(ex); $event.stopPropagation()">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </ng-container>
            </div>
          </div>
          <app-pagination [pager]="exercisesPg" [total]="exercises.length"></app-pagination>
        </div>

        <!-- Right: IDE / Exercise Panel -->
        <div class="ide-panel" style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden">
          <div *ngIf="!selectedExercise" class="d-flex align-items-center justify-content-center h-100 text-muted">
            <div class="text-center">
              <div style="font-size:3rem"><i class="bi bi-arrow-left-circle"></i></div>
              <p class="mt-2">Sélectionnez un exercice pour commencer</p>
            </div>
          </div>

          <div *ngIf="selectedExercise && selectedExercise.type === 'EXCEL_EXERCISE'" class="d-flex align-items-center justify-content-center h-100 text-muted">
            <div class="text-center">
              <p>Cet exercice Excel doit être ouvert dans l'éditeur de tableur.</p>
              <a routerLink="/spreadsheet" [queryParams]="{ lessonId: selectedExercise.id }" class="btn btn-sm btn-primary mt-2">
                <i class="bi bi-table me-1"></i>Ouvrir le tableur
              </a>
            </div>
          </div>

          <!-- Exercise display when selected -->
          <div *ngIf="selectedExercise && selectedExercise.type === 'CODE_EXERCISE'" class="h-100 d-flex flex-column" style="min-height:0">
            <!-- IDE Toolbar - Minimal -->
            <div class="bg-dark px-2 py-1 border-bottom d-flex align-items-center justify-content-between" style="background:#1a1a2e!important;gap:8px">
              <button class="btn btn-success btn-sm" (click)="executeCode()" [disabled]="codeLoading">
                <i class="bi bi-play-fill me-1"></i>{{ codeLoading ? 'Exécution...' : 'Exécuter' }}
              </button>
              <span *ngIf="isJava" class="text-white-50 small"><i class="bi bi-cup-hot me-1"></i>Projet multi-fichiers</span>
            </div>

            <!-- Package / class explorer (Java uniquement) -->
            <div *ngIf="isJava" class="bg-light border-bottom p-2" style="font-size:0.75rem">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-semibold text-muted"><i class="bi bi-folder2-open me-1"></i>Packages &amp; classes</span>
                <div class="d-flex gap-1">
                  <button class="btn btn-sm btn-outline-primary py-0 px-2" (click)="openNewFileForm('CLASS')" title="Nouvelle classe">
                    <i class="bi bi-file-earmark-plus"></i> Classe
                  </button>
                  <button class="btn btn-sm btn-outline-info py-0 px-2" (click)="openNewFileForm('INTERFACE')" title="Nouvelle interface">
                    <i class="bi bi-file-earmark-code"></i> Interface
                  </button>
                  <button *ngIf="activeFile?.kind === 'CLASS'" class="btn btn-sm btn-outline-warning py-0 px-2"
                          (click)="generateAccessors()" title="Génère le constructeur, les getters et les setters à partir des champs déclarés">
                    <i class="bi bi-magic"></i> Générer
                  </button>
                </div>
              </div>

              <!-- Mini formulaire de création (package réutilisable d'une classe à l'autre) -->
              <div *ngIf="showNewFileForm" class="d-flex flex-wrap align-items-end gap-2 mb-2 p-2 bg-white border rounded">
                <div>
                  <label class="form-label mb-0" style="font-size:0.68rem">Package</label>
                  <select class="form-select form-select-sm" style="font-size:0.75rem" [(ngModel)]="newFilePackage" [ngModelOptions]="{standalone:true}">
                    <option value="">(défaut)</option>
                    <option *ngFor="let p of packages" [value]="p" [hidden]="!p">{{ p }}</option>
                    <option value="__new__">+ Nouveau package…</option>
                  </select>
                </div>
                <div *ngIf="newFilePackage === '__new__'">
                  <label class="form-label mb-0" style="font-size:0.68rem">Nom du nouveau package</label>
                  <input type="text" class="form-control form-control-sm" style="font-size:0.75rem" [(ngModel)]="newPackageName" [ngModelOptions]="{standalone:true}" placeholder="com.example.util">
                </div>
                <div>
                  <label class="form-label mb-0" style="font-size:0.68rem">Nom {{ newFileKind === 'INTERFACE' ? "de l'interface" : 'de la classe' }}</label>
                  <input type="text" class="form-control form-control-sm" style="font-size:0.75rem" [(ngModel)]="newFileName" [ngModelOptions]="{standalone:true}" placeholder="Ex: Shape" (keyup.enter)="confirmNewFile()">
                </div>
                <button class="btn btn-sm btn-success py-0 px-2" (click)="confirmNewFile()"><i class="bi bi-check-lg"></i> Créer</button>
                <button class="btn btn-sm btn-outline-secondary py-0 px-2" (click)="cancelNewFile()">Annuler</button>
              </div>

              <div class="d-flex flex-column gap-1" style="max-height:90px;overflow-y:auto;overscroll-behavior:contain">
                <div *ngFor="let pkg of packages" class="d-flex align-items-center gap-1 flex-wrap">
                  <span class="badge bg-secondary"><i class="bi bi-box-seam me-1"></i>{{ pkg || 'défaut' }}</span>
                  <button *ngFor="let f of filesInPackage(pkg)"
                          class="btn btn-sm py-0 px-2"
                          [class.btn-dark]="activeFileId === f.id"
                          [class.btn-outline-dark]="activeFileId !== f.id"
                          (click)="selectFile(f)">
                    <i class="bi" [class.bi-file-earmark-code]="f.kind === 'INTERFACE'" [class.bi-filetype-java]="f.kind === 'CLASS'"></i>
                    {{ f.className }}
                  </button>
                  <span *ngIf="filesInPackage(pkg).length === 0" class="text-muted">— vide —</span>
                </div>
              </div>
            </div>

            <div class="d-flex flex-grow-1 overflow-hidden" style="min-height:0">
              <!-- Left side: Exercise statement (PDF or text) - 50% -->
              <div class="d-flex flex-column p-3" style="width:50%;border-right:1px solid #dee2e6;overflow-y:auto;overscroll-behavior:contain">
                <h6 class="fw-bold mb-2">{{ selectedExercise.title }}</h6>
                <iframe *ngIf="selectedExercise.pdfUrl" [src]="selectedExercisePdfUrl"
                        class="flex-grow-1 border rounded-3" style="width:100%;min-height:0"></iframe>
                <div *ngIf="!selectedExercise.pdfUrl" class="text-muted small" style="white-space:pre-wrap">
                  {{ selectedExercise.description || 'Aucun énoncé fourni pour cet exercice.' }}
                </div>
              </div>

              <!-- Code Editor Section - 50% -->
              <div class="d-flex flex-column" style="width:50%;min-width:0;overflow:hidden">
                <!-- Code Editor -->
                <div class="d-flex overflow-hidden" style="background:#1e1e2e;flex:1 1 50%;min-height:0">
                  <div class="line-numbers py-2 px-2 text-end" style="background:#181825; color:#585b70; font-family:monospace; font-size:0.75rem; min-width:50px; user-select:none;overflow-y:auto">
                    <div *ngFor="let line of lineNumbers" style="line-height:1.6em">{{ line }}</div>
                  </div>
                  <textarea
                    class="flex-grow-1 p-2 text-white border-0"
                    [(ngModel)]="currentCode"
                    (ngModelChange)="updateLineNumbers(); scheduleSave()"
                    (paste)="onPaste($event)"
                    (contextmenu)="onContextMenu($event)"
                    spellcheck="false"
                    style="background:#1e1e2e; font-family:monospace; font-size:0.85rem; line-height:1.6em; resize:none; outline:none"
                    placeholder="Écrivez votre code ici...">
                  </textarea>
                </div>

                <!-- Output -->
                <div class="bg-dark p-2 border-top" style="background:#0f0f1e!important;flex:1 1 38%;min-height:0;overflow-y:auto;overscroll-behavior:contain">
                  <div class="text-white small">
                    <div *ngIf="!codeOutput && !codeError && !codeLoading" class="text-muted">▶ Prêt à exécuter</div>
                    <div *ngIf="codeLoading" class="text-info">⟳ Exécution en cours...</div>
                    <pre *ngIf="codeOutput" style="color:#a6e3a1;margin:0;white-space:pre-wrap;font-size:0.75rem">{{ codeOutput }}</pre>
                    <pre *ngIf="codeError" style="color:#f38ba8;margin:0;white-space:pre-wrap;font-size:0.75rem">{{ codeError }}</pre>
                  </div>
                </div>

                <!-- Bottom actions -->
                <div class="bg-light p-2 d-flex gap-2 border-top" style="background:var(--surface-muted)!important">
                  <button class="btn btn-sm btn-outline-secondary" (click)="markComplete()" [disabled]="markingComplete">
                    <i class="bi bi-check-circle me-1"></i>{{ selectedExercise.completed ? 'Complété' : 'Marquer terminé' }}
                  </button>
                  <button class="btn btn-sm btn-outline-danger" (click)="clearCode()">
                    <i class="bi bi-trash me-1"></i>Effacer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .exercise-list-panel { 
      border-radius: 12px;
      background: var(--surface-muted);
      padding: 8px;
      font-size: 0.86rem;
    }
    .exercise-list-panel .card {
      padding: 0.6rem !important;
      margin-bottom: 0.4rem;
    }
    .exercise-list-panel .card h6 {
      font-size: 0.85rem;
      margin-bottom: 0.25rem;
    }
    .exercise-list-panel .card p {
      font-size: 0.74rem;
      margin-bottom: 0.25rem;
    }
    .exercise-list-panel::-webkit-scrollbar {
      width: 6px;
    }
    .exercise-list-panel::-webkit-scrollbar-track {
      background: transparent;
    }
    .exercise-list-panel::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 3px;
    }
    .ide-panel::-webkit-scrollbar {
      width: 6px;
    }
    .ide-panel::-webkit-scrollbar-track {
      background: transparent;
    }
    .ide-panel::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 3px;
    }
    .line-numbers::-webkit-scrollbar {
      width: 0;
    }
  `]
})
export class ExerciseListComponent implements OnInit, OnDestroy {
  /** Pagination des listes. */
  exercisesPg = new Pager(10);
  exercises: Lesson[] = [];
  selectedExercise: Lesson | null = null;
  selectedExercisePdfUrl: SafeResourceUrl | null = null;
  loading = true;
  leftCollapsed = false;

  form: FormGroup | null = null;
  editingId: number | null = null;
  saving = false;
  formError = '';
  deletingId: number | null = null;

  // IDE state
  currentCode = '';
  codeOutput = '';
  codeError = '';
  codeLoading = false;
  markingComplete = false;
  lineNumbers: number[] = [];

  // Projet Java multi-fichiers (packages / classes / interfaces)
  projectFiles: ProjectFile[] = [];
  packages: string[] = [''];
  activeFileId: string | null = null;
  private fileIdSeq = 0;
  private lastUsedPackage = '';

  // Mini formulaire de création de classe/interface
  showNewFileForm = false;
  newFileKind: 'CLASS' | 'INTERFACE' = 'CLASS';
  newFilePackage = '';
  newPackageName = '';
  newFileName = '';

  get isTeacher(): boolean {
    return this.authService.isTeacher || this.authService.isAdmin;
  }

  get isJava(): boolean {
    return (this.selectedExercise?.language || '') === 'java';
  }

  get activeFile(): ProjectFile | null {
    return this.projectFiles.find(f => f.id === this.activeFileId) || null;
  }

  filesInPackage(pkg: string): ProjectFile[] {
    return this.projectFiles.filter(f => f.packageName === pkg);
  }

  constructor(private dialogs: DialogService, 
    private fb: FormBuilder,
    private authService: AuthService,
    private exerciseService: ExerciseService,
    private uploadService: UploadService,
    private progressService: ProgressService,
    private ideService: IdeService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.load();
    this.route.queryParams.subscribe(params => {
      if (params['lessonId']) {
        const id = parseInt(params['lessonId'], 10);
        setTimeout(() => {
          const ex = this.exercises.find(e => e.id === id);
          if (ex) this.selectExercise(ex);
        }, 100);
      }
    });
  }

  ngOnDestroy() {
    this.persistCode();
  }

  load() {
    this.loading = true;
    const source$ = this.isTeacher ? this.exerciseService.getMyExercises() : this.exerciseService.getAllExercises();
    source$.subscribe({
      next: (exercises) => { this.exercises = exercises; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  selectExercise(ex: Lesson) {
    if (this.selectedExercise && this.selectedExercise.id !== ex.id) {
      this.persistCode();
    }

    this.selectedExercise = ex;
    this.selectedExercisePdfUrl = ex.pdfUrl ? this.safeDocUrl(ex.pdfUrl) : null;
    this.codeOutput = '';
    this.codeError = '';
    this.showNewFileForm = false;
    this.lastUsedPackage = '';

    this.initDefaultProject(ex);
    this.updateLineNumbers();

    // Restaure le travail précédemment sauvegardé (classes créées, code en cours), s'il existe
    this.progressService.getSavedCode(ex.id).subscribe({
      next: (resp) => this.applySavedCode(resp.data?.code || null),
      error: () => { /* pas de sauvegarde existante, on garde le squelette par défaut */ }
    });

    // ensure the selected card is visible in the scrollable list
    setTimeout(() => {
      try {
        const el = document.getElementById(`exercise-${ex.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {
        // ignore
      }
    }, 50);
  }

  toggleLeft() {
    this.leftCollapsed = !this.leftCollapsed;
  }

  updateLineNumbers() {
    const lines = (this.currentCode || '').split('\n').length;
    this.lineNumbers = Array.from({ length: lines }, (_, i) => i + 1);
  }

  // ─── Packages / classes / interfaces (Java) ────────────────────────────

  private genId(): string {
    return `f${++this.fileIdSeq}`;
  }

  private classBoilerplate(className: string, packageName: string, withMain: boolean): string {
    const pkgLine = packageName ? `package ${packageName};\n\n` : '';
    const imports = 'import java.util.*;\nimport java.io.*;\nimport java.util.stream.*;\n\n';
    const body = withMain
      ? `public class ${className} {\n\n    public static void main(String[] args) {\n        \n    }\n}`
      : `public class ${className} {\n\n}`;
    return pkgLine + imports + body;
  }

  private interfaceBoilerplate(className: string, packageName: string): string {
    const pkgLine = packageName ? `package ${packageName};\n\n` : '';
    const imports = 'import java.util.*;\n\n';
    return `${pkgLine}${imports}public interface ${className} {\n\n}`;
  }

  /** Sauvegarde le code en cours d'édition dans le fichier actif avant de changer de contexte. */
  private saveActiveFileContent() {
    if (!this.activeFileId) return;
    const f = this.projectFiles.find(f => f.id === this.activeFileId);
    if (f) f.content = this.currentCode;
  }

  selectFile(file: ProjectFile) {
    this.saveActiveFileContent();
    this.persistCode();
    this.activeFileId = file.id;
    this.currentCode = file.content;
    this.updateLineNumbers();
  }

  private initDefaultProject(ex: Lesson) {
    if ((ex.language || '') === 'java') {
      const starter = ex.starterCode?.trim() || this.classBoilerplate('Main', '', true);
      const mainFile: ProjectFile = { id: this.genId(), packageName: '', className: 'Main', kind: 'CLASS', content: starter };
      this.projectFiles = [mainFile];
      this.packages = [''];
      this.activeFileId = mainFile.id;
      this.currentCode = mainFile.content;
    } else {
      this.projectFiles = [];
      this.packages = [''];
      this.activeFileId = null;
      this.currentCode = ex.starterCode || '';
    }
  }

  /** Remplace le squelette par défaut par le travail précédemment sauvegardé, s'il y en a un. */
  private applySavedCode(raw: string | null) {
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (this.isJava && Array.isArray(saved?.files) && saved.files.length) {
        this.projectFiles = saved.files.map((f: any) => ({
          id: this.genId(),
          packageName: f.packageName || '',
          className: f.className,
          kind: f.kind === 'INTERFACE' ? 'INTERFACE' : 'CLASS',
          content: f.content || ''
        }));
        this.packages = [...new Set(this.projectFiles.map(f => f.packageName))];
        if (!this.packages.includes('')) this.packages.unshift('');
        this.activeFileId = this.projectFiles[0].id;
        this.currentCode = this.projectFiles[0].content;
      } else if (!this.isJava && typeof saved?.code === 'string') {
        this.currentCode = saved.code;
      }
      this.updateLineNumbers();
    } catch {
      // sauvegarde corrompue ou format inattendu : on garde le squelette par défaut
    }
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Sauvegarde différée pendant la frappe, pour éviter de spammer le serveur à chaque caractère. */
  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persistCode(), 1200);
  }

  /** Sauvegarde immédiate (changement de fichier, création de classe, génération...). */
  persistCode() {
    if (!this.selectedExercise || this.selectedExercise.type !== 'CODE_EXERCISE') return;
    this.saveActiveFileContent();
    const payload = this.isJava
      ? JSON.stringify({ files: this.projectFiles.map(f => ({ packageName: f.packageName, className: f.className, kind: f.kind, content: f.content })) })
      : JSON.stringify({ code: this.currentCode });
    this.progressService.saveCode(this.selectedExercise.id, payload).subscribe();
  }

  private readonly packageNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
  private readonly classNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

  /** Ouvre le mini-formulaire, en proposant par défaut le dernier package utilisé pour enchaîner facilement plusieurs classes dedans. */
  openNewFileForm(kind: 'CLASS' | 'INTERFACE') {
    this.newFileKind = kind;
    this.newFilePackage = this.lastUsedPackage;
    this.newPackageName = '';
    this.newFileName = '';
    this.showNewFileForm = true;
  }

  cancelNewFile() {
    this.showNewFileForm = false;
  }

  confirmNewFile() {
    let pkg = this.newFilePackage === '__new__' ? this.newPackageName.trim() : this.newFilePackage.trim();

    if (pkg && !this.packageNamePattern.test(pkg)) {
      this.dialogs.alert({ title: 'Nom de package invalide', message: 'Utilisez des points pour séparer les segments, ex : com.example.util', tone: 'warning' });
      return;
    }
    const className = this.newFileName.trim();
    if (!className) return;
    if (!this.classNamePattern.test(className)) {
      this.dialogs.alert({ title: 'Nom de classe invalide', message: 'Utilisez des lettres, chiffres et underscores, sans espace.', tone: 'warning' });
      return;
    }
    if (this.projectFiles.some(f => f.packageName === pkg && f.className === className)) {
      this.dialogs.alert({ title: 'Ce nom existe déjà dans ce package.', tone: 'warning' });
      return;
    }
    if (pkg && !this.packages.includes(pkg)) this.packages.push(pkg);
    this.lastUsedPackage = pkg;

    const content = this.newFileKind === 'INTERFACE'
      ? this.interfaceBoilerplate(className, pkg)
      : this.classBoilerplate(className, pkg, false);
    const file: ProjectFile = { id: this.genId(), packageName: pkg, className, kind: this.newFileKind, content };
    this.projectFiles.push(file);
    this.selectFile(file);
    this.showNewFileForm = false;
  }

  /**
   * Détecte les champs déclarés (ex: "private String nom;") dans la classe active et génère
   * le constructeur, les getters et les setters correspondants, en évitant les doublons.
   */
  generateAccessors() {
    const file = this.activeFile;
    if (!file || file.kind !== 'CLASS') return;
    this.saveActiveFileContent();
    const code = file.content;

    const fieldRegex = /^[ \t]*(?:private|protected|public)\s+(?!static\b|class\b|interface\b|void\b)([\w<>\[\],\s]+?)\s+(\w+)\s*;/gm;
    const fields: { type: string; name: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = fieldRegex.exec(code)) !== null) {
      fields.push({ type: match[1].trim(), name: match[2] });
    }

    if (fields.length === 0) {
      this.dialogs.alert({ title: 'Aucun champ détecté', message: 'Déclarez vos champs avant de générer, ex : private String nom;', tone: 'warning' });
      return;
    }

    const className = file.className;
    const generated: string[] = [];

    const hasConstructor = new RegExp(`\\bpublic\\s+${className}\\s*\\(`).test(code);
    if (!hasConstructor) {
      const params = fields.map(f => `${f.type} ${f.name}`).join(', ');
      generated.push('');
      generated.push(`    public ${className}(${params}) {`);
      fields.forEach(f => generated.push(`        this.${f.name} = ${f.name};`));
      generated.push('    }');
    }

    fields.forEach(f => {
      const capitalized = f.name.charAt(0).toUpperCase() + f.name.slice(1);
      const getterName = f.type === 'boolean' ? `is${capitalized}` : `get${capitalized}`;
      if (!new RegExp(`\\b${getterName}\\s*\\(`).test(code)) {
        generated.push('');
        generated.push(`    public ${f.type} ${getterName}() {`);
        generated.push(`        return ${f.name};`);
        generated.push('    }');
      }
      const setterName = `set${capitalized}`;
      if (!new RegExp(`\\b${setterName}\\s*\\(`).test(code)) {
        generated.push('');
        generated.push(`    public void ${setterName}(${f.type} ${f.name}) {`);
        generated.push(`        this.${f.name} = ${f.name};`);
        generated.push('    }');
      }
    });

    if (generated.length === 0) {
      this.dialogs.toast('Le constructeur, les getters et les setters existent déjà pour ces champs.', 'info');
      return;
    }

    const lastBrace = code.lastIndexOf('}');
    if (lastBrace === -1) return;
    const newCode = code.slice(0, lastBrace) + generated.join('\n') + '\n' + code.slice(lastBrace);
    file.content = newCode;
    this.currentCode = newCode;
    this.updateLineNumbers();
    this.persistCode();
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
  }

  onContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  clearCode() {
    if (this.isJava && this.activeFileId) {
      const f = this.projectFiles.find(f => f.id === this.activeFileId);
      if (f) {
        f.content = f.id === this.projectFiles[0].id
          ? this.classBoilerplate(f.className, f.packageName, true)
          : (f.kind === 'INTERFACE' ? this.interfaceBoilerplate(f.className, f.packageName) : this.classBoilerplate(f.className, f.packageName, false));
        this.currentCode = f.content;
      }
    } else {
      this.currentCode = this.selectedExercise?.starterCode || '';
    }
    this.updateLineNumbers();
    this.persistCode();
  }

  private formatHttpError(err: any): string {
    if (err?.status === 0) return 'Impossible de contacter le serveur (backend hors-ligne ?).';
    if (err?.error?.message) return err.error.message;
    if (err?.error?.errors) return Object.values(err.error.errors).join(', ');
    if (typeof err?.error === 'string') return err.error;
    return `Erreur serveur (${err?.status ?? '?'})`;
  }

  /** Évite que l'élève doive écrire les imports usuels lui-même (Scanner, List, ArrayList...). */
  private withAutoImports(code: string, language: string): string {
    if (language !== 'java') return code;
    const autoImports = ['import java.util.*;', 'import java.io.*;', 'import java.util.stream.*;'];
    const missing = autoImports.filter(imp => !code.includes(imp));
    if (missing.length === 0) return code;
    return missing.join('\n') + '\n' + code;
  }

  executeCode() {
    const language = this.selectedExercise?.language || 'python';

    if (language === 'java' && this.projectFiles.length) {
      this.saveActiveFileContent();
      const nonEmpty = this.projectFiles.filter(f => f.content.trim());
      if (!nonEmpty.length) return;

      const mainFile = nonEmpty.find(f => /public\s+static\s+void\s+main\s*\(/.test(f.content));
      if (!mainFile) {
        this.codeOutput = '';
        this.codeError = 'Aucune méthode main() trouvée. Ajoutez-en une dans une de vos classes pour lancer le programme.';
        return;
      }
      const mainClass = mainFile.packageName ? `${mainFile.packageName}.${mainFile.className}` : mainFile.className;

      this.codeLoading = true;
      this.codeOutput = '';
      this.codeError = '';
      const files = nonEmpty.map(f => ({
        packageName: f.packageName,
        className: f.className,
        content: this.withAutoImports(f.content, 'java')
      }));

      this.ideService.executeJavaProject(files, mainClass).subscribe({
        next: (resp) => {
          this.codeLoading = false;
          if (resp.success && resp.data) {
            this.codeOutput = resp.data['output'] || '';
            this.codeError = resp.data['error'] || '';
          } else {
            this.codeError = resp.message || 'Erreur inconnue';
          }
        },
        error: (err) => {
          this.codeLoading = false;
          this.codeError = this.formatHttpError(err);
        }
      });
      return;
    }

    if (!this.currentCode.trim()) return;
    this.codeLoading = true;
    this.codeOutput = '';
    this.codeError = '';
    const codeToRun = this.withAutoImports(this.currentCode, language);
    this.ideService.executeCode(codeToRun, language).subscribe({
      next: (resp) => {
        this.codeLoading = false;
        if (resp.success && resp.data) {
          this.codeOutput = resp.data['output'] || '';
          this.codeError = resp.data['error'] || '';
        } else {
          this.codeError = resp.message || 'Erreur inconnue';
        }
      },
      error: () => {
        this.codeLoading = false;
        this.codeError = 'Erreur de connexion au serveur';
      }
    });
  }

  markComplete() {
    if (!this.selectedExercise) return;
    this.markingComplete = true;
    this.progressService.completeLesson(this.selectedExercise.id).subscribe({
      next: () => {
        this.selectedExercise!.completed = true;
        this.markingComplete = false;
      },
      error: () => { this.markingComplete = false; }
    });
  }

  startCreate() {
    this.editingId = null;
    this.form = this.fb.group({
      title: ['', Validators.required],
      type: ['CODE_EXERCISE', Validators.required],
      description: [''],
      language: ['python'],
      starterCode: [''],
      pdfUrl: ['']
    });
  }

  startEdit(ex: Lesson) {
    this.editingId = ex.id;
    this.form = this.fb.group({
      title: [ex.title, Validators.required],
      type: [ex.type, Validators.required],
      description: [ex.description || ''],
      language: [ex.language || 'python'],
      starterCode: [ex.starterCode || ''],
      pdfUrl: [ex.pdfUrl || '']
    });
  }

  cancelForm() {
    this.form = null;
    this.editingId = null;
    this.formError = '';
  }

  onSubmit() {
    if (!this.form) return;
    this.formError = '';
    if (this.form.invalid) { this.formError = 'Le titre est obligatoire.'; return; }
    this.saving = true;
    const value = this.form.value;
    const request$ = this.editingId
      ? this.exerciseService.updateExercise(this.editingId, value)
      : this.exerciseService.createExercise(value);
    request$.subscribe({
      next: (saved) => {
        if (this.editingId) {
          const idx = this.exercises.findIndex(e => e.id === this.editingId);
          if (idx >= 0) this.exercises[idx] = saved;
        } else {
          this.exercises.unshift(saved);
        }
        this.saving = false;
        this.cancelForm();
      },
      error: (err) => { this.formError = err.error?.message || 'Impossible d\'enregistrer l\'exercice.'; this.saving = false; }
    });
  }

  async deleteExercise(ex: Lesson) {
    if (!(await this.dialogs.confirmDelete(`« ${ex.title} »`))) return;
    this.deletingId = ex.id;
    this.exerciseService.deleteExercise(ex.id).subscribe({
      next: () => {
        this.exercises = this.exercises.filter(e => e.id !== ex.id);
        if (this.selectedExercise?.id === ex.id) this.selectedExercise = null;
        this.deletingId = null;
      },
      error: () => { this.deletingId = null; }
    });
  }

  safeDocUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
