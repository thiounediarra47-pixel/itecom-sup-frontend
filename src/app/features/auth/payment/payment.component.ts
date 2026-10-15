import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { phoneError, phoneUsageFor } from '../../../core/validators/contact';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center p-4"
         style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);">
      <div class="card border-0 shadow-lg p-4 w-100" style="max-width:520px; border-radius:20px;">

        <ng-container *ngIf="!submitted; else successBlock">
          <div class="text-center mb-4">
            <div style="font-size:2.5rem"><i class="bi bi-credit-card"></i></div>
            <h2 class="fw-bold mt-2">Paiement de l'inscription</h2>
            <p class="text-muted small">Choisissez votre mode de paiement et envoyez le montant</p>
          </div>

          <!-- Frais -->
          <div class="alert mb-4" style="background:#2b3ea8;border:1px solid #f59e0b;border-radius:12px">
            <div class="d-flex align-items-center gap-3">
              <span style="font-size:2rem"><i class="bi bi-tag"></i></span>
              <div>
                <div class="fw-bold" style="color:#d97706">Frais d'inscription</div>
                <div style="font-size:1.4rem;font-weight:800;color:#92400e">5 000 FCFA</div>
              </div>
            </div>
          </div>

          <!-- Choix méthode -->
          <div class="mb-4">
            <label class="form-label fw-semibold">Méthode de paiement</label>
            <div class="row g-3">
              <div class="col-6">
                <div class="p-3 border rounded-3 text-center"
                     [style.border-color]="method === 'WAVE' ? '#2b3ea8' : '#dee2e6'"
                     [style.background]="method === 'WAVE' ? '#eef0fb' : 'white'"
                     style="cursor:pointer; transition:all .2s"
                     (click)="method = 'WAVE'">
                  <div style="font-size:1.8rem"><i class="bi bi-water"></i></div>
                  <div class="fw-bold mt-1" [style.color]="method === 'WAVE' ? '#1f2d7a' : '#333'">Wave</div>
                  <div class="small text-muted">+221 70 000 0000</div>
                </div>
              </div>
              <div class="col-6">
                <div class="p-3 border rounded-3 text-center"
                     [style.border-color]="method === 'ORANGE_MONEY' ? '#f97316' : '#dee2e6'"
                     [style.background]="method === 'ORANGE_MONEY' ? '#fff7ed' : 'white'"
                     style="cursor:pointer; transition:all .2s"
                     (click)="method = 'ORANGE_MONEY'">
                  <div style="font-size:1.8rem"><i class="bi bi-circle-fill"></i></div>
                  <div class="fw-bold mt-1" [style.color]="method === 'ORANGE_MONEY' ? '#c2410c' : '#333'">Orange Money</div>
                  <div class="small text-muted">+221 77 000 0000</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Instructions -->
          <div *ngIf="method" class="alert mb-4" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px">
            <div class="fw-semibold mb-2" style="color:#0369a1">
              <i class="bi bi-info-circle me-1"></i>
              Comment payer via {{ method === 'WAVE' ? 'Wave' : 'Orange Money' }} :
            </div>
            <ol class="mb-0 small" style="color:#0c4a6e">
              <ng-container *ngIf="method === 'WAVE'">
                <li>Ouvrez l'app <strong>Wave</strong></li>
                <li>Faites un transfert de <strong>5 000 FCFA</strong> au numéro <strong>70 000 0000</strong></li>
                <li>Notez la <strong>référence de transaction</strong> reçue par SMS</li>
                <li>Remplissez le formulaire ci-dessous</li>
              </ng-container>
              <ng-container *ngIf="method === 'ORANGE_MONEY'">
                <li>Composez <strong>#144#</strong> ou ouvrez l'app <strong>Orange Money</strong></li>
                <li>Faites un transfert de <strong>5 000 FCFA</strong> au numéro <strong>77 000 0000</strong></li>
                <li>Notez la <strong>référence de transaction</strong> reçue par SMS</li>
                <li>Remplissez le formulaire ci-dessous</li>
              </ng-container>
            </ol>
          </div>

          <!-- Formulaire -->
          <div class="mb-3">
            <label class="form-label fw-semibold">Votre numéro {{ method === 'WAVE' ? 'Wave' : 'Orange Money' }}</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-phone"></i></span>
              <input type="tel" class="form-control" [(ngModel)]="paymentPhone"
                     placeholder="Ex: 77 123 45 67" [disabled]="!method" inputmode="tel"
                     [class.is-invalid]="phoneTouched && phoneMsg" (blur)="phoneTouched = true">
            </div>
            <div *ngIf="phoneTouched && phoneMsg" class="invalid-feedback d-block">{{ phoneMsg }}</div>
          </div>

          <div class="mb-4">
            <label class="form-label fw-semibold">Référence de transaction</label>
            <div class="input-group">
              <span class="input-group-text">#</span>
              <input type="text" class="form-control" [(ngModel)]="paymentReference"
                     placeholder="Ex: TXN123456789" [disabled]="!method">
            </div>
            <div class="form-text">La référence figure dans le SMS de confirmation de paiement.</div>
          </div>

          <div class="alert alert-danger" *ngIf="error">{{ error }}</div>

          <button class="btn w-100 fw-semibold py-2" [disabled]="loading || !canSubmit"
                  style="background:#2b3ea8;color:white;border-radius:10px"
                  (click)="submit()">
            <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
            {{ loading ? 'Envoi...' : 'Confirmer le paiement' }}
          </button>

          <p class="text-center text-muted small mt-3">
            Votre compte sera activé dans les <strong>24h</strong> après vérification par l'administration.
          </p>
        </ng-container>

        <ng-template #successBlock>
          <div class="text-center py-4">
            <div style="font-size:4rem"><i class="bi bi-hourglass-split"></i></div>
            <h4 class="mt-3 fw-bold">Paiement soumis !</h4>
            <p class="text-muted">Votre paiement a bien été enregistré. L'administrateur va vérifier votre transaction et activer votre compte sous <strong>24h</strong>.</p>
            <p class="text-muted small">Vous recevrez un email de confirmation dès que votre compte est activé.</p>
            <div class="alert alert-info mt-3 text-start">
              <strong>Récapitulatif :</strong><br>
              Méthode : {{ method === 'WAVE' ? 'Wave' : 'Orange Money' }}<br>
              Téléphone : {{ paymentPhone }}<br>
              Référence : {{ paymentReference }}
            </div>
          </div>
        </ng-template>

      </div>
    </div>
  `
})
export class PaymentComponent implements OnInit {
  method: 'WAVE' | 'ORANGE_MONEY' | '' = '';
  paymentPhone = '';
  paymentReference = '';
  loading = false;
  error = '';
  submitted = false;
  private email = '';

  phoneTouched = false;

  /** Numéro conforme à l'opérateur choisi (Orange Money : 77/78) ; mêmes règles que le serveur. */
  get phoneMsg(): string | null { return phoneError(this.paymentPhone, phoneUsageFor(this.method)); }

  get canSubmit(): boolean {
    return !!this.method && !this.phoneMsg && this.paymentReference.trim().length >= 4;
  }

  constructor(private http: HttpClient, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.email = this.route.snapshot.queryParamMap.get('email') || '';
    if (!this.email) this.router.navigate(['/auth/login']);
  }

  submit() {
    this.loading = true;
    this.error = '';
    this.http.post<any>('/api/auth/submit-payment', {
      email: this.email,
      paymentMethod: this.method,
      paymentPhone: this.paymentPhone.trim(),
      paymentReference: this.paymentReference.trim()
    }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.status === 'SUCCESS') {
          this.submitted = true;
        } else {
          this.error = res.message || 'Erreur lors de la soumission.';
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Erreur réseau. Réessayez.';
      }
    });
  }
}
