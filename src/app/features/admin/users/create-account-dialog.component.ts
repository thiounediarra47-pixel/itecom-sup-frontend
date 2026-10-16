import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DialogRef } from '../../../core/services/dialog.service';
import { emailError } from '../../../core/validators/contact';

export interface CreatedAccount {
  user: any;
  emailSent: boolean;
  message: string;
}

interface EnrolledStudent {
  id: number; firstName: string; lastName: string; email: string;
  level: string | null; registrationStatus: string; enabled: boolean;
}

/** Matières proposées par défaut, complétées par celles déjà attribuées aux professeurs. */
const DEFAULT_SUBJECTS = [
  'Algorithmique', 'Programmation', 'Bases de données', 'Développement web', 'Génie logiciel', 'Systèmes d\'exploitation',
  'Réseaux informatiques', 'Sécurité informatique', 'Mathématiques', 'Statistiques', 'Comptabilité générale',
  'Comptabilité analytique', 'Fiscalité', 'Gestion financière', 'Économie', 'Droit', 'Marketing digital',
  'Communication', 'Management', 'Anglais', 'Français', 'Santé publique', 'Développement personnel'
];

/** Création d'un compte dans une popup : choix Étudiant / Professeur, puis formulaire adapté. */
@Component({
  selector: 'app-create-account-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Étape 1 : type de compte -->
    <div *ngIf="!role">
      <p class="text-muted mb-3">Quel type de compte voulez-vous créer ?</p>
      <div class="row g-3">
        <div class="col-sm-6">
          <button type="button" class="role-card" (click)="choose('STUDENT')">
            <span class="role-icon"><i class="bi bi-mortarboard"></i></span>
            <span class="role-title">Étudiant</span>
            <span class="role-text">Choix du niveau puis de l'étudiant inscrit : mot de passe généré et envoyé par email.</span>
          </button>
        </div>
        <div class="col-sm-6">
          <button type="button" class="role-card" (click)="choose('TEACHER')">
            <span class="role-icon"><i class="bi bi-person-video3"></i></span>
            <span class="role-title">Professeur</span>
            <span class="role-text">Nom, email et matières enseignées.</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Étape 2 (étudiant) : niveau, puis étudiant inscrit -->
    <div *ngIf="role === 'STUDENT'">
      <button type="button" class="btn btn-link px-0 mb-2 text-decoration-none" (click)="role = null; error = ''">
        <i class="bi bi-arrow-left me-1"></i>Changer de type de compte
      </button>
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="role-icon small-icon"><i class="bi bi-mortarboard"></i></span>
        <h6 class="fw-bold mb-0">Accès d'un étudiant inscrit</h6>
      </div>
      <p class="text-muted small mb-3">Un mot de passe est généré et envoyé à l'email donné lors de l'inscription.</p>

      <div class="small fw-semibold mb-2">Niveau</div>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button *ngFor="let l of levels" type="button" class="btn btn-sm" style="border-radius:999px;min-width:72px"
                [class.btn-primary]="pickLevel === l" [class.btn-outline-secondary]="pickLevel !== l" (click)="selectLevel(l)">
          {{ l }} <span class="ms-1 opacity-75">· {{ levelCount(l) }}</span>
        </button>
      </div>

      <ng-container *ngIf="pickLevel">
        <div class="input-group input-group-sm mb-2">
          <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
          <input class="form-control" [(ngModel)]="pickSearch" placeholder="Rechercher par nom, prénom ou email">
        </div>
        <div *ngIf="loadingStudents" class="text-muted small p-2"><span class="spinner-border spinner-border-sm me-2"></span>Chargement…</div>
        <div *ngIf="!loadingStudents" class="list-group student-list">
          <button *ngFor="let s of levelStudents" type="button" class="list-group-item list-group-item-action py-2"
                  [class.active]="picked?.id === s.id" [disabled]="isDisabled(s)" (click)="picked = s; error = ''">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <span class="small"><strong>{{ s.lastName }}</strong> {{ s.firstName }}
                <span class="d-block opacity-75">{{ s.email }}</span></span>
              <span class="badge" [ngClass]="isPendingStudent(s) ? 'bg-warning text-dark' : isDisabled(s) ? 'bg-secondary' : 'bg-light text-dark border'">
                {{ isPendingStudent(s) ? 'Compte à créer' : isDisabled(s) ? 'Désactivé' : 'A déjà un accès' }}
              </span>
            </div>
          </button>
          <div *ngIf="!levelStudents.length" class="list-group-item small text-muted py-3 text-center">
            Aucun étudiant inscrit en {{ pickLevel }}{{ pickSearch.trim() ? ' pour cette recherche' : '' }}.
          </div>
        </div>
        <div *ngIf="picked && !isPendingStudent(picked)" class="alert alert-info py-2 small mt-2 mb-0">
          <i class="bi bi-info-circle me-1"></i>{{ picked.firstName }} a déjà un accès : un nouveau mot de passe remplacera l'ancien.
        </div>
      </ng-container>

      <div *ngIf="error" class="alert alert-danger py-2 small mt-3 mb-0"><i class="bi bi-exclamation-triangle me-1"></i>{{ error }}</div>

      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" (click)="ref.close()">Annuler</button>
        <button type="button" class="btn btn-primary fw-semibold" [disabled]="saving || !picked" (click)="createStudentAccess()">
          <span *ngIf="saving" class="spinner-border spinner-border-sm me-2"></span>
          <i *ngIf="!saving" class="bi bi-send me-2"></i>Générer et envoyer le mot de passe
        </button>
      </div>
    </div>

    <!-- Étape 2 (professeur) : formulaire -->
    <form *ngIf="role === 'TEACHER'" (ngSubmit)="create()" #f="ngForm">
      <button type="button" class="btn btn-link px-0 mb-2 text-decoration-none" (click)="role = null; error = ''">
        <i class="bi bi-arrow-left me-1"></i>Changer de type de compte
      </button>
      <div class="d-flex align-items-center gap-2 mb-3">
        <span class="role-icon small-icon"><i class="bi bi-person-video3"></i></span>
        <h6 class="fw-bold mb-0">Nouveau compte professeur</h6>
      </div>

      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="accLastName">Nom</label>
          <input id="accLastName" class="form-control" name="lastName" [(ngModel)]="form.lastName" required>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="accFirstName">Prénom</label>
          <input id="accFirstName" class="form-control" name="firstName" [(ngModel)]="form.firstName" required>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="accEmail">Email</label>
          <input id="accEmail" type="email" class="form-control" name="email" [(ngModel)]="form.email" required email>
        </div>

        <div class="col-12">
          <label class="form-label fw-semibold small" for="accSubjects">Matières enseignées</label>
          <div class="input-group">
            <select id="accSubjects" class="form-select" name="subjectChoice" [(ngModel)]="subjectChoice" (ngModelChange)="onSubjectChosen()">
              <option value="">— Choisir une matière —</option>
              <option *ngFor="let s of availableSubjects" [value]="s">{{ s }}</option>
              <option [value]="OTHER">Autre matière…</option>
            </select>
          </div>
          <div *ngIf="subjectChoice === OTHER" class="input-group mt-2">
            <input class="form-control" name="customSubject" [(ngModel)]="customSubject" placeholder="Nom de la matière"
                   (keydown.enter)="$event.preventDefault(); addSubject(customSubject)">
            <button type="button" class="btn btn-outline-primary" (click)="addSubject(customSubject)" [disabled]="!customSubject.trim()">
              <i class="bi bi-plus-lg me-1"></i>Ajouter
            </button>
          </div>
          <div class="d-flex flex-wrap gap-2 mt-2">
            <span *ngFor="let s of selectedSubjects" class="subject-chip">
              {{ s }}
              <button type="button" class="btn-close btn-close-sm" (click)="removeSubject(s)" [attr.aria-label]="'Retirer ' + s"></button>
            </span>
            <span *ngIf="!selectedSubjects.length" class="form-text mt-0">Choisissez une ou plusieurs matières : le professeur apparaîtra dans chacune.</span>
          </div>
        </div>

        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="accPassword">Mot de passe</label>
          <div class="input-group">
            <input id="accPassword" class="form-control font-monospace" name="password" [(ngModel)]="form.password" required minlength="6">
            <button type="button" class="btn btn-outline-secondary" (click)="form.password = generatePassword()" title="Générer un autre mot de passe">
              <i class="bi bi-arrow-repeat"></i>
            </button>
          </div>
          <div class="form-text">Envoyé automatiquement par email.</div>
        </div>
      </div>

      <div *ngIf="error" class="alert alert-danger py-2 small mt-3 mb-0"><i class="bi bi-exclamation-triangle me-1"></i>{{ error }}</div>

      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" (click)="ref.close()">Annuler</button>
        <button type="submit" class="btn btn-primary fw-semibold" [disabled]="saving || f.invalid || !selectedSubjects.length">
          <span *ngIf="saving" class="spinner-border spinner-border-sm me-2"></span>
          <i *ngIf="!saving" class="bi bi-send me-2"></i>Créer et envoyer les identifiants
        </button>
      </div>
    </form>
  `,
  styles: [`
    .role-card {
      width: 100%; height: 100%; text-align: left; display: flex; flex-direction: column; gap: 6px;
      padding: 20px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface);
      transition: border-color .15s, box-shadow .15s, transform .15s;
    }
    .role-card:hover { border-color: var(--primary); box-shadow: 0 8px 22px rgba(28, 29, 31, .08); transform: translateY(-1px); }
    .role-icon {
      width: 46px; height: 46px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--primary-soft); color: var(--primary); font-size: 1.35rem;
    }
    .small-icon { width: 36px; height: 36px; font-size: 1.1rem; }
    .role-title { font-weight: 700; font-size: 1.05rem; color: var(--dark); }
    .role-text { color: var(--muted); font-size: .88rem; }
    .subject-chip {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px; border-radius: 999px;
      background: var(--primary-soft); color: var(--primary); font-size: .85rem; font-weight: 600;
    }
    .btn-close-sm { width: .5em; height: .5em; padding: .25em; }
    .student-list { max-height: 300px; overflow: auto; }
  `]
})
export class CreateAccountDialogComponent implements OnInit {
  readonly OTHER = '__other__';
  subjectOptions: string[] = [...DEFAULT_SUBJECTS].sort((a, b) => a.localeCompare(b, 'fr'));
  selectedSubjects: string[] = [];
  subjectChoice = '';
  customSubject = '';

  role: 'STUDENT' | 'TEACHER' | null = null;
  saving = false;
  error = '';
  form = this.empty();

  readonly levels = ['L1', 'L2', 'L3', 'M1', 'M2'];

  // Accès étudiant : choix d'un étudiant inscrit
  students: EnrolledStudent[] = [];
  loadingStudents = false;
  pickLevel = '';
  pickSearch = '';
  picked: EnrolledStudent | null = null;

  constructor(private http: HttpClient, public ref: DialogRef<CreatedAccount>) {}

  ngOnInit() {
    // Matières déjà enseignées par les professeurs existants
    this.http.get<{ subjects?: string | null }[]>('/api/admin/users/teachers').subscribe({
      next: teachers => {
        const known = new Map(this.subjectOptions.map(s => [s.toLowerCase(), s]));
        teachers.flatMap(t => (t.subjects || '').split(',')).map(s => s.trim()).filter(Boolean)
          .forEach(s => { if (!known.has(s.toLowerCase())) known.set(s.toLowerCase(), s); });
        this.subjectOptions = [...known.values()].sort((a, b) => a.localeCompare(b, 'fr'));
      },
      error: () => {}
    });
  }

  /** Matières pas encore choisies. */
  get availableSubjects(): string[] {
    return this.subjectOptions.filter(s => !this.selectedSubjects.some(x => x.toLowerCase() === s.toLowerCase()));
  }

  onSubjectChosen() {
    if (this.subjectChoice && this.subjectChoice !== this.OTHER) this.addSubject(this.subjectChoice);
  }

  addSubject(subject: string) {
    const s = subject.trim();
    if (s && !this.selectedSubjects.some(x => x.toLowerCase() === s.toLowerCase())) this.selectedSubjects.push(s);
    this.customSubject = '';
    // Remise à zéro après le cycle de détection : la liste reste prête pour la matière suivante
    setTimeout(() => this.subjectChoice = '');
  }

  removeSubject(subject: string) {
    this.selectedSubjects = this.selectedSubjects.filter(s => s !== subject);
  }

  private empty() {
    return { firstName: '', lastName: '', email: '', password: this.generatePassword() };
  }

  choose(role: 'STUDENT' | 'TEACHER') {
    this.role = role;
    this.error = '';
    if (role === 'STUDENT' && !this.students.length) {
      this.loadingStudents = true;
      this.http.get<EnrolledStudent[]>('/api/admin/users/students').subscribe({
        next: list => { this.students = list; this.loadingStudents = false; },
        error: () => { this.loadingStudents = false; this.error = 'Impossible de charger la liste des étudiants.'; }
      });
    }
  }

  selectLevel(level: string) {
    this.pickLevel = level;
    this.picked = null;
    this.error = '';
  }

  levelCount(level: string): number {
    return this.students.filter(s => s.level === level).length;
  }

  isPendingStudent(s: EnrolledStudent): boolean {
    return s.registrationStatus === 'ACCOUNT_PENDING';
  }

  /** Compte désactivé par l'admin : à réactiver avant de lui envoyer un mot de passe. */
  isDisabled(s: EnrolledStudent): boolean {
    return !this.isPendingStudent(s) && !s.enabled;
  }

  /** Étudiants du niveau choisi, ceux dont le compte reste à créer en premier. */
  get levelStudents(): EnrolledStudent[] {
    const q = this.pickSearch.trim().toLowerCase();
    return this.students
      .filter(s => s.level === this.pickLevel)
      .filter(s => !q || `${s.lastName} ${s.firstName} ${s.email}`.toLowerCase().includes(q))
      .sort((a, b) => Number(this.isPendingStudent(b)) - Number(this.isPendingStudent(a))
        || `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'));
  }

  createStudentAccess() {
    if (this.saving || !this.picked) return;
    this.saving = true;
    this.error = '';
    this.http.post<CreatedAccount>(`/api/admin/users/${this.picked.id}/create-account`, {}).subscribe({
      next: res => { this.saving = false; this.ref.close(res); },
      error: err => { this.saving = false; this.error = err.error?.message || 'Impossible de créer le compte.'; }
    });
  }

  generatePassword(): string {
    // Sans caractères ambigus (0/O, 1/l/I) pour faciliter la saisie
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from(crypto.getRandomValues(new Uint32Array(10)), b => alphabet[b % alphabet.length]).join('');
  }

  create() {
    if (this.saving || !this.role) return;
    const invalidEmail = emailError(this.form.email);
    if (invalidEmail) { this.error = invalidEmail; return; }
    this.saving = true;
    this.error = '';
    const body = {
      role: 'TEACHER',
      firstName: this.form.firstName, lastName: this.form.lastName, email: this.form.email, password: this.form.password,
      subjects: this.selectedSubjects.join(', ')
    };
    this.http.post<CreatedAccount>('/api/admin/users', body).subscribe({
      next: res => { this.saving = false; this.ref.close(res); },
      error: err => { this.saving = false; this.error = err.error?.message || 'Impossible de créer le compte.'; }
    });
  }
}
