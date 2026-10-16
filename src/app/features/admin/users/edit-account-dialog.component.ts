import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DIALOG_DATA, DialogRef } from '../../../core/services/dialog.service';
import { emailError } from '../../../core/validators/contact';

export interface EditableAccount {
  id: number; role: string; firstName: string; lastName: string; email: string;
  phone?: string | null; level?: string | null; specialization?: string | null;
  birthDate?: string | null; birthPlace?: string | null; subjects?: string | null;
}

/** Modification d'un compte étudiant ou professeur par l'administrateur. */
@Component({
  selector: 'app-edit-account-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form (ngSubmit)="save()" #f="ngForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="edLastName">Nom</label>
          <input id="edLastName" class="form-control" name="lastName" [(ngModel)]="form.lastName" required>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="edFirstName">Prénom</label>
          <input id="edFirstName" class="form-control" name="firstName" [(ngModel)]="form.firstName" required>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="edEmail">Email</label>
          <input id="edEmail" type="email" class="form-control" name="email" [(ngModel)]="form.email" required email>
          <div *ngIf="emailChanged" class="form-text text-warning">
            L'email sert d'identifiant : la personne devra se reconnecter avec la nouvelle adresse.
          </div>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="edPhone">Téléphone <span class="text-muted fw-normal">(facultatif)</span></label>
          <input id="edPhone" class="form-control" name="phone" [(ngModel)]="form.phone" placeholder="77 123 45 67">
        </div>

        <ng-container *ngIf="student">
          <div class="col-md-6">
            <label class="form-label fw-semibold small" for="edLevel">Niveau</label>
            <select id="edLevel" class="form-select" name="level" [(ngModel)]="form.level" required>
              <option *ngFor="let l of levels" [value]="l">{{ l }}</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label fw-semibold small" for="edSpecialization">Filière <span class="text-muted fw-normal">(facultatif)</span></label>
            <select id="edSpecialization" class="form-select" name="specialization" [(ngModel)]="form.specialization">
              <option value="">— Aucune —</option>
              <option *ngFor="let s of specializations" [value]="s.value">{{ s.label }}</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label fw-semibold small" for="edBirthDate">Date de naissance</label>
            <input id="edBirthDate" type="date" class="form-control" name="birthDate" [(ngModel)]="form.birthDate" [max]="today" required>
          </div>
          <div class="col-md-6">
            <label class="form-label fw-semibold small" for="edBirthPlace">Lieu de naissance</label>
            <input id="edBirthPlace" class="form-control" name="birthPlace" [(ngModel)]="form.birthPlace" required>
          </div>
        </ng-container>

        <div *ngIf="!student" class="col-12">
          <label class="form-label fw-semibold small" for="edSubjects">Matières enseignées</label>
          <input id="edSubjects" class="form-control" name="subjects" [(ngModel)]="form.subjects" required
                 placeholder="Ex. Comptabilité générale, Fiscalité">
          <div class="form-text">Séparez les matières par des virgules.</div>
        </div>
      </div>

      <div *ngIf="error" class="alert alert-danger py-2 small mt-3 mb-0"><i class="bi bi-exclamation-triangle me-1"></i>{{ error }}</div>

      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" (click)="ref.close()">Annuler</button>
        <button type="submit" class="btn btn-primary fw-semibold" [disabled]="saving || f.invalid">
          <span *ngIf="saving" class="spinner-border spinner-border-sm me-2"></span>
          <i *ngIf="!saving" class="bi bi-check2 me-2"></i>Enregistrer
        </button>
      </div>
    </form>
  `
})
export class EditAccountDialogComponent {
  readonly levels = ['L1', 'L2', 'L3', 'M1', 'M2'];
  readonly specializations = [
    { value: 'genie-logiciel', label: 'Génie Logiciel' }, { value: 'reseau', label: 'Réseaux' },
    { value: 'comptabilite', label: 'Comptabilité' }, { value: 'sante', label: 'Santé' },
    { value: 'marketing-digital', label: 'Marketing Digital' },
    { value: 'developpement-personnel', label: 'Développement Personnel' }
  ];
  readonly today = new Date().toISOString().substring(0, 10);
  readonly student: boolean;
  form: Required<Omit<EditableAccount, 'id' | 'role'>>;
  saving = false;
  error = '';

  constructor(private http: HttpClient, public ref: DialogRef<EditableAccount>,
              @Inject(DIALOG_DATA) private account: EditableAccount) {
    this.student = account.role === 'ROLE_STUDENT';
    this.form = {
      firstName: account.firstName, lastName: account.lastName, email: account.email,
      phone: account.phone || '', level: account.level || 'L1', specialization: account.specialization || '',
      birthDate: account.birthDate || '', birthPlace: account.birthPlace || '', subjects: account.subjects || ''
    };
  }

  get emailChanged(): boolean {
    return this.form.email.trim().toLowerCase() !== this.account.email.toLowerCase();
  }

  save() {
    if (this.saving) return;
    const invalidEmail = emailError(this.form.email);
    if (invalidEmail) { this.error = invalidEmail; return; }
    this.saving = true;
    this.error = '';
    this.http.put<EditableAccount>(`/api/admin/users/${this.account.id}`, this.form).subscribe({
      next: updated => { this.saving = false; this.ref.close(updated); },
      error: err => { this.saving = false; this.error = err.error?.message || 'Impossible d\'enregistrer les modifications.'; }
    });
  }
}
