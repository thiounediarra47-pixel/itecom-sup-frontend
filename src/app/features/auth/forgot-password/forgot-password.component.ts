import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center p-4"
         style="background: linear-gradient(135deg, #0f172a, #1e293b);">
      <div class="card border-0 shadow-lg p-4 w-100" style="max-width:420px; border-radius:20px;">
        <div class="text-center mb-4">
          <div style="font-size:2.5rem"><i class="bi bi-key"></i></div>
          <h2 class="fw-bold mt-2">Mot de passe oublié</h2>
          <p class="text-muted small">Entrez votre email pour recevoir un lien de réinitialisation</p>
        </div>
        <ng-container *ngIf="!sent">
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="mb-4">
              <label class="form-label fw-semibold">Email</label>
              <input type="email" class="form-control" formControlName="email" placeholder="votre@email.com">
            </div>
            <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
            <button type="submit" class="btn w-100 py-2" [disabled]="loading || form.invalid"
              style="background: #2b3ea8; color:white; border-radius:10px;">
              <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
              Envoyer le lien
            </button>
          </form>
        </ng-container>
        <ng-container *ngIf="sent">
          <div class="text-center py-3">
            <div style="font-size:3rem"><i class="bi bi-envelope-paper"></i></div>
            <p class="mt-3 text-muted">Si cet email existe, vous recevrez un lien de réinitialisation.</p>
          </div>
        </ng-container>
        <p class="text-center mt-3 small"><a routerLink="/auth/login" class="text-primary">← Retour</a></p>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  form: FormGroup;
  loading = false;
  sent = false;
  error = '';

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.authService.forgotPassword(this.form.value.email).subscribe({
      next: () => { this.sent = true; this.loading = false; },
      error: () => { this.error = 'Erreur. Réessayez plus tard.'; this.loading = false; }
    });
  }
}
