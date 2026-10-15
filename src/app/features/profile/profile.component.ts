import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProgressService } from '../../core/services/progress.service';
import { HttpClient } from '@angular/common/http';
import { phoneValidator } from '../../core/validators/contact';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="fade-in-up">
      <h1 class="fw-bold mb-4"><i class="bi bi-person me-1"></i>Mon Profil</h1>

      <div class="row g-4">
        <!-- Profile Card -->
        <div class="col-lg-4">
          <div class="card border-0 shadow-sm text-center p-4" style="border-radius:20px">
            <div class="position-relative d-inline-block mx-auto mb-3">
              <div class="rounded-circle d-flex align-items-center justify-content-center mx-auto"
                   style="width:100px;height:100px;font-size:2.5rem;font-weight:800;background:#2b3ea8;color:white">
                {{ user?.firstName?.charAt(0) }}{{ user?.lastName?.charAt(0) }}
              </div>
            </div>
            <h4 class="fw-bold">{{ user?.firstName }} {{ user?.lastName }}</h4>
            <p class="text-muted small">{{ user?.email }}</p>
            <span class="badge rounded-pill px-3 py-2 mb-2"
                  [class.bg-primary]="user?.role === 'ROLE_STUDENT'"
                  [class.bg-success]="user?.role === 'ROLE_TEACHER'"
                  [class.bg-danger]="user?.role === 'ROLE_ADMIN'">
              {{ getRoleLabel(user?.role) }}
            </span>
            <div *ngIf="user?.specialization" class="mb-3">
              <span class="badge rounded-pill px-3 py-2 bg-secondary text-white">
                {{ getSpecializationLabel(user?.specialization) }}
              </span>
            </div>

            <div class="border-top pt-3 mt-2">
              <p class="text-muted small mb-0" *ngIf="user?.bio">{{ user?.bio }}</p>
              <p class="text-muted small mb-0" *ngIf="!user?.bio">Aucune bio renseignée</p>
            </div>

            <div class="border-top pt-3 mt-3 row g-2 text-center">
              <div class="col-6">
                <div class="fw-bold fs-4 text-primary">{{ totalCourses }}</div>
                <div class="text-muted" style="font-size:.75rem">Cours inscrits</div>
              </div>
              <div class="col-6">
                <div class="fw-bold fs-4 text-success">{{ totalCompleted }}</div>
                <div class="text-muted" style="font-size:.75rem">Leçons complètes</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Form -->
        <div class="col-lg-8">
          <div class="card border-0 shadow-sm p-4 mb-4" style="border-radius:20px">
            <h5 class="fw-bold mb-4"><i class="bi bi-pencil-square me-1"></i>Modifier mes informations</h5>
            <form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
              <div class="row g-3 mb-3">
                <div class="col-6">
                  <label class="form-label fw-semibold">Prénom</label>
                  <input type="text" class="form-control" formControlName="firstName">
                </div>
                <div class="col-6">
                  <label class="form-label fw-semibold">Nom</label>
                  <input type="text" class="form-control" formControlName="lastName">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Email</label>
                <input type="email" class="form-control bg-light" formControlName="email" readonly>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Téléphone</label>
                <input type="tel" class="form-control" formControlName="phone" placeholder="77 123 45 67" inputmode="tel"
                       [class.is-invalid]="profileForm.get('phone')?.invalid && profileForm.get('phone')?.touched">
                <div *ngIf="profileForm.get('phone')?.touched && profileForm.get('phone')?.errors?.['contact']" class="invalid-feedback d-block">
                  {{ profileForm.get('phone')?.errors?.['contact'] }}</div>
              </div>
              <div class="mb-4">
                <label class="form-label fw-semibold">Bio</label>
                <textarea class="form-control" rows="3" formControlName="bio"
                  placeholder="Parlez-nous de vous..."></textarea>
              </div>
              <div *ngIf="saveSuccess" class="alert alert-success py-2"><i class="bi bi-check-circle me-1"></i>Profil mis à jour !</div>
              <div *ngIf="saveError" class="alert alert-danger py-2">{{ saveError }}</div>
              <button type="submit" class="btn btn-primary-custom" [disabled]="savingProfile">
                <span *ngIf="savingProfile" class="spinner-border spinner-border-sm me-2"></span>
                Sauvegarder
              </button>
            </form>
          </div>

          <!-- Change Password -->
          <div class="card border-0 shadow-sm p-4" style="border-radius:20px">
            <h5 class="fw-bold mb-4"><i class="bi bi-shield-lock me-1"></i>Changer le mot de passe</h5>
            <form [formGroup]="passwordForm" (ngSubmit)="changePassword()">
              <div class="mb-3">
                <label class="form-label fw-semibold">Mot de passe actuel</label>
                <input type="password" class="form-control" formControlName="currentPassword">
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Nouveau mot de passe</label>
                <input type="password" class="form-control" formControlName="newPassword" autocomplete="new-password">
                <small class="text-muted">8 caractères minimum.</small>
              </div>
              <div class="mb-4">
                <label class="form-label fw-semibold">Confirmer le nouveau mot de passe</label>
                <input type="password" class="form-control" formControlName="confirmPassword">
              </div>
              <div *ngIf="pwdSuccess" class="alert alert-success py-2"><i class="bi bi-check-circle me-1"></i>Mot de passe mis à jour !</div>
              <div *ngIf="pwdError" class="alert alert-danger py-2">{{ pwdError }}</div>
              <button type="submit" class="btn btn-outline-danger" [disabled]="changingPwd">
                <span *ngIf="changingPwd" class="spinner-border spinner-border-sm me-1"></span>
                Changer le mot de passe
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  passwordForm: FormGroup;
  savingProfile = false;
  saveSuccess = false;
  saveError = '';
  changingPwd = false;
  pwdSuccess = false;
  pwdError = '';
  totalCourses = 0;
  totalCompleted = 0;

  get user() { return this.authService.currentUser; }

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private progressService: ProgressService,
    private http: HttpClient
  ) {
    this.profileForm = this.fb.group({
      firstName: [this.authService.currentUser?.firstName || '', Validators.required],
      lastName: [this.authService.currentUser?.lastName || '', Validators.required],
      email: [{ value: this.authService.currentUser?.email || '', disabled: true }],
      phone: ['', phoneValidator()],
      bio: ['']
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.progressService.getMyProgress().subscribe(progress => {
      this.totalCourses = progress.length;
      this.totalCompleted = progress.reduce((s, p) => s + p.completedLessons, 0);
    });
  }

  saveProfile() {
    this.saveError = '';
    this.saveSuccess = false;
    // Le formulaire invalide n'envoyait rien et n'affichait aucun message
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.saveError = this.profileForm.get('phone')?.errors?.['contact'] ?? 'Le prénom et le nom sont obligatoires.';
      return;
    }
    this.savingProfile = true;
    this.http.put('/api/users/profile', this.profileForm.value).subscribe({
      next: () => {
        const { firstName, lastName, bio } = this.profileForm.value;
        this.authService.updateCurrentUser({ firstName, lastName, bio });
        this.savingProfile = false;
        this.saveSuccess = true;
        setTimeout(() => this.saveSuccess = false, 3000);
      },
      error: (err) => {
        // Auparavant l'erreur était masquée et affichée comme un succès
        this.saveError = err.error?.message || 'Impossible d\'enregistrer le profil. Veuillez réessayer.';
        this.savingProfile = false;
      }
    });
  }

  changePassword() {
    this.pwdError = '';
    this.pwdSuccess = false;
    let { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;
    // Le formulaire invalide n'envoyait rien et n'affichait aucun message
    if (!currentPassword || !newPassword || !confirmPassword) { this.pwdError = 'Veuillez remplir les trois champs.'; return; }
    if (newPassword.length < 8) { this.pwdError = 'Le nouveau mot de passe doit contenir au moins 8 caractères.'; return; }
    if (newPassword !== confirmPassword) { this.pwdError = 'Les mots de passe ne correspondent pas.'; return; }
    if (newPassword === currentPassword) { this.pwdError = 'Le nouveau mot de passe doit être différent de l\'actuel.'; return; }
    this.changingPwd = true;
    this.http.put('/api/users/change-password', { currentPassword, newPassword }).subscribe({
      next: () => { this.pwdSuccess = true; this.changingPwd = false; this.passwordForm.reset(); setTimeout(() => this.pwdSuccess = false, 4000); },
      error: (err) => { this.pwdError = err.error?.message || 'Erreur lors du changement du mot de passe.'; this.changingPwd = false; }
    });
  }

  getRoleLabel(role: string | undefined) {
    return { ROLE_STUDENT: 'Étudiant', ROLE_TEACHER: 'Professeur', ROLE_ADMIN: 'Admin' }[role || ''] || role;
  }

  getSpecializationLabel(key: string | undefined) {
    return {
      'genie-logiciel': 'Génie Logiciel',
      'reseau': 'Réseau',
      'comptabilite': 'Comptabilité',
      'sante': 'Santé',
      'marketing-digital': 'Marketing Digital',
      'developpement-personnel': 'Développement Personnel'
    }[key || ''] || '';
  }
}
