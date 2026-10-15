import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DialogRef } from '../../../core/services/dialog.service';

/** « Mot de passe oublié » dans une popup, sans quitter la page de connexion. */
@Component({
  selector: 'app-forgot-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="!sent">
      <p class="text-muted">Saisissez l'adresse email de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label class="form-label fw-semibold" for="forgotEmail">Adresse email</label>
        <div class="input-group mb-3">
          <span class="input-group-text"><i class="bi bi-envelope"></i></span>
          <input id="forgotEmail" type="email" class="form-control" name="email" [(ngModel)]="email" required email
                 placeholder="votre@email.com" autocomplete="username">
        </div>
        <div *ngIf="error" class="alert alert-danger py-2 small"><i class="bi bi-exclamation-triangle me-1"></i>{{ error }}</div>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-light" (click)="ref.close()">Annuler</button>
          <button type="submit" class="btn btn-primary fw-semibold" [disabled]="loading || f.invalid">
            <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
            <i *ngIf="!loading" class="bi bi-send me-2"></i>Envoyer le lien
          </button>
        </div>
      </form>
    </div>
    <div *ngIf="sent" class="text-center py-2">
      <div class="mx-auto mb-3 d-flex align-items-center justify-content-center"
           style="width:60px;height:60px;border-radius:18px;background:#dcfce7;color:#16a34a;font-size:1.7rem">
        <i class="bi bi-envelope-check"></i>
      </div>
      <h6 class="fw-bold">Email envoyé</h6>
      <p class="text-muted">Si un compte existe pour <strong>{{ email }}</strong>, vous recevrez un lien de réinitialisation dans quelques minutes.</p>
      <button type="button" class="btn btn-primary" (click)="ref.close()">Fermer</button>
    </div>
  `
})
export class ForgotPasswordDialogComponent {
  email = '';
  loading = false;
  sent = false;
  error = '';

  constructor(private authService: AuthService, public ref: DialogRef) {}

  submit() {
    this.loading = true;
    this.error = '';
    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: () => { this.loading = false; this.sent = true; },
      error: err => {
        this.loading = false;
        this.error = err.error?.message || 'Envoi impossible pour le moment. Réessayez plus tard.';
      }
    });
  }
}
