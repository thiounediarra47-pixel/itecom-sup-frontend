import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center"
         style="background: linear-gradient(135deg, #0f172a, #1e293b);">
      <div class="card border-0 shadow-lg p-5 text-center" style="max-width:440px; border-radius:20px;">
        <ng-container *ngIf="loading">
          <div class="spinner-border text-primary mb-3" style="width:3rem;height:3rem;"></div>
          <h4>Vérification en cours...</h4>
        </ng-container>
        <ng-container *ngIf="!loading && success">
          <div style="font-size:4rem"><i class="bi bi-check-circle"></i></div>
          <h3 class="mt-3 fw-bold text-success">Email vérifié !</h3>
          <p class="text-muted">Veuillez maintenant procéder au paiement de l'inscription pour activer votre compte.</p>
          <div class="alert mt-3" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:12px">
            <strong style="color:#92400e">Redirection dans {{ countdown }}s...</strong>
          </div>
          <button class="btn btn-warning fw-bold mt-2 w-100" (click)="goToPayment()" style="border-radius:10px">
            <i class="bi bi-credit-card me-1"></i>Payer maintenant
          </button>
        </ng-container>
        <ng-container *ngIf="!loading && !success">
          <div style="font-size:4rem"><i class="bi bi-x-circle"></i></div>
          <h3 class="mt-3 fw-bold text-danger">Lien invalide</h3>
          <p class="text-muted">{{ error }}</p>
          <a routerLink="/auth/login" class="btn btn-outline-primary mt-3">Retour à la connexion</a>
        </ng-container>
      </div>
    </div>
  `
})
export class VerifyEmailComponent implements OnInit {
  loading = true;
  success = false;
  error = '';
  countdown = 4;
  private userEmail = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParams['token'];
    if (!token) { this.loading = false; this.error = 'Token manquant'; return; }
    this.authService.verifyEmail(token).subscribe({
      next: (resp) => {
        this.loading = false;
        this.success = resp.success;
        if (!resp.success) {
          this.error = resp.message;
        } else {
          // Récupérer l'email depuis le token (via un appel ou stocké en session)
          this.userEmail = this.route.snapshot.queryParams['email'] || '';
          this.startCountdown();
        }
      },
      error: () => { this.loading = false; this.error = 'Lien expiré ou invalide'; }
    });
  }

  private startCountdown() {
    const interval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(interval);
        this.goToPayment();
      }
    }, 1000);
  }

  goToPayment() {
    this.router.navigate(['/auth/payment'], { queryParams: { email: this.userEmail } });
  }
}
