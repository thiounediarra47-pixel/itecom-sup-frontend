import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface PickedStudent {
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  level: string;
}

interface StudentAccount { id: number; firstName: string; lastName: string; email: string; level: string | null; }

export const STUDENT_LEVELS = ['L1', 'L2', 'L3', 'M1', 'M2'];

/**
 * Choix des étudiants d'un devoir, d'un examen ou d'une classe virtuelle : par niveau, par recherche
 * d'un compte existant (même tout juste créé) ou par import d'une liste. Les trois se combinent.
 * `students` et `targetLevels` sont modifiés en place.
 */
@Component({
  selector: 'app-student-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Par niveau -->
    <div>
      <div class="small fw-semibold mb-2"><i class="bi bi-mortarboard me-1"></i>Par niveau</div>
      <div class="d-flex flex-wrap gap-2">
        <button *ngFor="let l of levels" type="button" class="btn btn-sm"
                [class.btn-primary]="isLevelOn(l)" [class.btn-outline-secondary]="!isLevelOn(l)"
                [disabled]="lockedLevels.includes(l)"
                style="border-radius:999px;min-width:84px" (click)="toggleLevel(l)">
          <i class="bi me-1" [class.bi-check-lg]="isLevelOn(l)" [class.bi-plus]="!isLevelOn(l)"></i>{{ l }}
          <span class="ms-1 opacity-75">· {{ levelCount(l) }}</span>
        </button>
      </div>
      <div *ngIf="chosenLevels.length" class="small text-muted mt-2">
        Tous les étudiants de {{ chosenLevels.join(', ') }} sont concernés, y compris ceux dont le compte sera créé plus tard.
      </div>
    </div>

    <!-- Ajout d'un compte existant -->
    <div class="mt-3 position-relative">
      <div class="small fw-semibold mb-2"><i class="bi bi-person-plus me-1"></i>Ajouter un étudiant</div>
      <div class="d-flex gap-2 flex-wrap">
        <div class="input-group input-group-sm flex-grow-1" style="min-width:220px;width:auto">
          <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
          <input class="form-control" [(ngModel)]="search" placeholder="Rechercher par nom, prénom ou email"
                 (focus)="searchOpen = true" (blur)="closeSearch()">
        </div>
        <a href="/api/teacher/exams/student-template" download="modele_etudiants.xlsx"
           class="btn btn-outline-secondary btn-sm fw-semibold" style="white-space:nowrap">
          <i class="bi bi-download me-1"></i>Modèle Excel
        </a>
        <button type="button" class="btn btn-outline-primary btn-sm fw-semibold" style="white-space:nowrap"
                (click)="fileInput.click()" [disabled]="parsing">
          <span *ngIf="parsing" class="spinner-border spinner-border-sm me-1"></span>
          <i *ngIf="!parsing" class="bi bi-upload me-1"></i>{{ parsing ? 'Lecture...' : 'Importer une liste' }}
        </button>
        <input #fileInput type="file" accept=".xlsx,.xls,.csv,.pdf,.docx,.doc" style="display:none" (change)="onFile($event)">
      </div>
      <div *ngIf="searchOpen && search.trim()" class="list-group shadow-sm position-absolute w-100"
           style="z-index:20;max-height:240px;overflow:auto">
        <button *ngFor="let a of matches" type="button" class="list-group-item list-group-item-action py-2"
                (mousedown)="$event.preventDefault()" (click)="addAccount(a)">
          <div class="d-flex justify-content-between align-items-center gap-2">
            <span class="small"><strong>{{ a.lastName }}</strong> {{ a.firstName }}
              <span class="text-muted">· {{ a.email }}</span></span>
            <span *ngIf="a.level" class="badge bg-light text-dark border">{{ a.level }}</span>
          </div>
        </button>
        <div *ngIf="!matches.length" class="list-group-item small text-muted py-2">
          Aucun compte étudiant trouvé. Le compte doit d'abord être créé par l'administrateur.
        </div>
      </div>
      <div class="small text-muted mt-1">
        Liste importée : colonnes Nom · Prénom · Niveau · Email (Excel, CSV, Word ou PDF).
        Chaque étudiant se connecte avec l'email et le mot de passe de son compte.
      </div>
    </div>

    <div *ngIf="error" class="alert alert-danger py-2 mt-3 mb-0 small">
      <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
    </div>

    <!-- Étudiants ajoutés un par un ou importés -->
    <div *ngIf="students.length" class="mt-3">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <span class="small fw-semibold"><i class="bi bi-list-ul me-1"></i>Liste : {{ students.length }} étudiant(s)</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="students.splice(0)">
          <i class="bi bi-x me-1"></i>Vider la liste
        </button>
      </div>
      <div *ngIf="unknownStudents.length" class="alert alert-warning py-2 small mb-2">
        <i class="bi bi-exclamation-triangle me-1"></i>
        {{ unknownStudents.length }} étudiant(s) de la liste n'ont pas de compte : créez d'abord leur compte ou retirez-les.
      </div>
      <div style="max-height:280px;overflow:auto;border:1px solid var(--border, #e5e7eb);border-radius:10px">
        <table class="table table-sm table-hover mb-0 align-middle">
          <thead class="table-light sticky-top">
            <tr><th style="width:32px">#</th><th>Nom</th><th>Prénom</th><th style="width:70px">Niveau</th><th>Email</th><th style="width:36px"></th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of students; let i = index"
                [class.table-danger]="invalidEmails.has(s.email.trim().toLowerCase())"
                [class.table-warning]="loaded && !hasAccount(s)">
              <td class="text-muted small">{{ i + 1 }}</td>
              <td class="small">{{ s.lastName || s.name }}</td>
              <td class="small">{{ s.firstName }}</td>
              <td class="small">{{ s.level }}</td>
              <td class="small text-muted">{{ s.email }}
                <span *ngIf="loaded && !hasAccount(s)" class="badge bg-warning text-dark ms-1">sans compte</span>
              </td>
              <td>
                <button type="button" class="btn btn-link btn-sm text-danger p-0" (click)="students.splice(i, 1)" title="Retirer">
                  <i class="bi bi-x-circle"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="small mt-3 pt-3 border-top">
      <ng-container *ngIf="!students.length && !chosenLevels.length">
        <i class="bi me-1" [class.bi-globe]="emptyMeansAll" [class.bi-info-circle]="!emptyMeansAll"></i>
        <span *ngIf="emptyMeansAll">Ouvert à <strong>tous</strong> les étudiants approuvés.</span>
        <span *ngIf="!emptyMeansAll" class="text-muted">Choisissez au moins un niveau ou un étudiant.</span>
      </ng-container>
      <ng-container *ngIf="students.length || chosenLevels.length">
        <i class="bi bi-people me-1"></i><strong>{{ audienceCount }}</strong> étudiant(s) concerné(s)
        <span class="text-muted">(niveaux et liste réunis, sans doublon)</span>.
      </ng-container>
    </div>
  `
})
export class StudentPickerComponent implements OnInit {
  @Input() students: PickedStudent[] = [];
  @Input() targetLevels = new Set<string>();
  /** Niveaux déjà appliqués (ajout à un examen existant) : affichés cochés, non modifiables. */
  @Input() lockedLevels: string[] = [];
  /** Lignes signalées par le serveur. */
  @Input() invalidEmails = new Set<string>();
  /** Sans niveau ni étudiant : ouvert à tous (devoir) ou choix obligatoire (examen, classe virtuelle). */
  @Input() emptyMeansAll = false;

  readonly levels = STUDENT_LEVELS;
  accounts: StudentAccount[] = [];
  loaded = false;
  search = '';
  searchOpen = false;
  parsing = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<StudentAccount[]>('/api/teacher/qcms/student-accounts').subscribe(list => {
      this.accounts = list;
      this.loaded = true;
    });
  }

  isLevelOn(level: string): boolean {
    return this.targetLevels.has(level) || this.lockedLevels.includes(level);
  }

  toggleLevel(level: string) {
    if (this.targetLevels.has(level)) this.targetLevels.delete(level);
    else this.targetLevels.add(level);
  }

  get chosenLevels(): string[] {
    return this.levels.filter(l => this.isLevelOn(l));
  }

  levelCount(level: string): number {
    return this.accounts.filter(a => a.level === level).length;
  }

  get audienceCount(): number {
    const levels = new Set(this.chosenLevels);
    const emails = new Set(this.accounts.filter(a => a.level && levels.has(a.level)).map(a => a.email.toLowerCase()));
    this.students.forEach(s => { if (s.email.trim()) emails.add(s.email.trim().toLowerCase()); });
    return emails.size;
  }

  get matches(): StudentAccount[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return [];
    const listed = new Set(this.students.map(s => s.email.trim().toLowerCase()));
    return this.accounts
      .filter(a => !listed.has(a.email.toLowerCase()))
      .filter(a => `${a.lastName} ${a.firstName} ${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(q))
      .slice(0, 20);
  }

  addAccount(a: StudentAccount) {
    this.students.push({
      name: `${a.firstName} ${a.lastName}`.trim(), email: a.email,
      firstName: a.firstName || '', lastName: a.lastName || '', level: a.level || ''
    });
    this.search = '';
    this.searchOpen = false;
  }

  closeSearch() {
    setTimeout(() => this.searchOpen = false, 150);
  }

  hasAccount(s: PickedStudent): boolean {
    const email = s.email.trim().toLowerCase();
    return this.accounts.some(a => a.email.toLowerCase() === email);
  }

  get unknownStudents(): PickedStudent[] {
    return this.loaded ? this.students.filter(s => s.email.trim() && !this.hasAccount(s)) : [];
  }

  /** La liste importée s'ajoute aux étudiants déjà choisis, sans doublon. */
  onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.parsing = true;
    this.error = '';
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>('/api/teacher/qcms/parse-students', fd).subscribe({
      next: res => {
        this.parsing = false;
        const imported: PickedStudent[] = (res.students || []).map((s: any) => toPickedStudent(s));
        if (!imported.length) { this.error = 'Aucun étudiant détecté dans ce fichier.'; return; }
        const known = new Set(this.students.map(s => s.email.trim().toLowerCase()));
        this.students.push(...imported.filter(s => !known.has(s.email.trim().toLowerCase())));
      },
      error: err => {
        this.parsing = false;
        this.error = err.error?.error || err.error?.message || 'Erreur lors de la lecture du fichier.';
      }
    });
  }
}

/** Ligne de liste à partir d'une réponse serveur ; « Prénom(s) Nom » est découpé si besoin. */
export function toPickedStudent(s: any): PickedStudent {
  let firstName = (s.firstName || '').trim();
  let lastName = (s.lastName || '').trim();
  const name = (s.name || s.studentName || '').trim();
  if (!firstName && !lastName && name) {
    const lastSpace = name.lastIndexOf(' ');
    firstName = lastSpace > 0 ? name.substring(0, lastSpace) : '';
    lastName = lastSpace > 0 ? name.substring(lastSpace + 1) : name;
  }
  return { name, email: s.email || s.studentEmail || '', firstName, lastName, level: s.level || '' };
}

/** Liste au format CSV attendu par l'import côté serveur (Nom, Email). */
export function studentsCsv(students: PickedStudent[]): File {
  const rows = students.filter(s => s.email.trim())
    .map(s => `${(`${s.firstName} ${s.lastName}`.trim() || s.name).replace(/,/g, ' ')},${s.email.trim()}`);
  return new File(['Nom,Email\n' + rows.join('\n')], 'etudiants.csv', { type: 'text/csv' });
}
