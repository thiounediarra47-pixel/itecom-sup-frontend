import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DIALOG_DATA, DialogRef, DialogService } from '../../core/services/dialog.service';
import {
  Certificate, ENROLLMENT_STATUS, Enrollment, METHOD_LABELS, PAYMENT_STATUS, Payment, SPECIALIZATIONS, ScheduleItem,
  SchoolService, Transcript, apiError, fcfa
} from '../../core/services/school.service';
import { phoneError, phoneUsageFor } from '../../core/validators/contact';
import { SchoolScheduleComponent, SchoolTranscriptComponent } from './school-shared.component';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';

interface MyEnrollment {
  enrollment: Enrollment; schedule: ScheduleItem[]; payments: Payment[]; transcript: Transcript; certificates: Certificate[];
}

/** Déclaration d'un paiement Wave / Orange Money / Free Money, vérifié ensuite par la scolarité. */
@Component({
  selector: 'app-mobile-payment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="d-flex justify-content-between align-items-center p-3 rounded-3 mb-3" style="background:var(--surface-muted)">
      <span>Reste à payer</span><strong class="amount">{{ fcfa(maxAmount) }}</strong>
    </div>

    <label class="form-label fw-semibold small">1. Choisissez votre service</label>
    <div class="row g-2 mb-3">
      <div class="col-4" *ngFor="let m of methods">
        <button type="button" class="method-card" [class.active]="method === m" (click)="method = m">
          <span class="method-name">{{ label(m) }}</span>
          <span class="small text-muted">{{ data.numbers[m] }}</span>
        </button>
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label fw-semibold small" for="mpAmount">2. Montant</label>
      <div class="input-group">
        <input id="mpAmount" type="number" min="100" step="500" class="form-control" [(ngModel)]="amount" [max]="maxAmount">
        <span class="input-group-text">FCFA</span>
      </div>
      <div class="d-flex flex-wrap gap-2 mt-2">
        <button *ngIf="data.nextDue > 0 && data.nextDue < maxAmount" type="button" class="btn btn-sm btn-light" (click)="amount = data.nextDue">Prochaine échéance · {{ fcfa(data.nextDue) }}</button>
        <button type="button" class="btn btn-sm btn-light" (click)="amount = maxAmount">Tout solder · {{ fcfa(maxAmount) }}</button>
      </div>
    </div>

    <div class="alert alert-light border small mb-3">
      <i class="bi bi-info-circle me-1"></i>
      Envoyez <strong>{{ fcfa(amount || 0) }}</strong> au <strong>{{ data.numbers[method] }}</strong> depuis l'application {{ label(method) }}
      <span *ngIf="method === 'ORANGE_MONEY'">(ou #144#)</span>, puis notez la référence reçue par SMS.
    </div>

    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label fw-semibold small" for="mpPhone">3. Numéro utilisé</label>
        <input id="mpPhone" type="tel" class="form-control" [(ngModel)]="phone" placeholder="77 123 45 67" autocomplete="tel" inputmode="tel"
               [class.is-invalid]="phoneTouched && phoneMsg" (blur)="phoneTouched = true">
        <div *ngIf="phoneTouched && phoneMsg" class="invalid-feedback d-block">{{ phoneMsg }}</div>
      </div>
      <div class="col-md-6">
        <label class="form-label fw-semibold small" for="mpRef">4. Référence de transaction</label>
        <input id="mpRef" class="form-control" [(ngModel)]="reference" placeholder="Ex. TXN123456789">
      </div>
    </div>

    <div *ngIf="error" class="alert alert-danger mt-3 mb-0 py-2">{{ error }}</div>
    <div class="d-flex justify-content-end gap-2 mt-4">
      <button type="button" class="btn btn-light" (click)="ref.close()">Annuler</button>
      <button type="button" class="btn btn-primary" [disabled]="saving || !amount || !phone.trim() || !reference.trim()" (click)="submit()">
        <span *ngIf="saving" class="spinner-border spinner-border-sm me-1"></span>Déclarer le paiement
      </button>
    </div>
    <p class="small text-muted mt-3 mb-0">La scolarité vérifie la transaction sur son compte marchand. Vous recevez une notification et votre reçu avec QR code dès la validation.</p>
  `
})
export class MobilePaymentDialogComponent {
  readonly methods = ['WAVE', 'ORANGE_MONEY', 'FREE_MONEY'];
  readonly fcfa = fcfa;
  method = 'WAVE';
  amount: number | null;
  phone = '';
  reference = '';
  saving = false;
  error = '';
  maxAmount: number;

  constructor(@Inject(DIALOG_DATA) public data: { enrollmentId: number; balance: number; nextDue: number; numbers: Record<string, string> },
              public ref: DialogRef<boolean>, private school: SchoolService) {
    this.maxAmount = data.balance;
    this.amount = data.nextDue > 0 ? Math.min(data.nextDue, data.balance) : data.balance;
  }

  phoneTouched = false;

  label(m: string) { return METHOD_LABELS[m]; }

  /** Le numéro doit correspondre à l'opérateur choisi (Orange Money : 77/78, Free Money : 76). */
  get phoneMsg(): string | null { return phoneError(this.phone, phoneUsageFor(this.method)); }

  submit() {
    this.phoneTouched = true;
    if (this.phoneMsg) { this.error = this.phoneMsg; return; }
    this.saving = true;
    this.error = '';
    this.school.pay({ enrollmentId: this.data.enrollmentId, amount: this.amount, method: this.method,
                      phone: this.phone, transactionRef: this.reference }).subscribe({
      next: () => this.ref.close(true),
      error: err => { this.saving = false; this.error = apiError(err); }
    });
  }
}

@Component({
  selector: 'app-my-scolarite',
  standalone: true,
  imports: [CommonModule, SchoolScheduleComponent, SchoolTranscriptComponent, PaginationComponent, PaginatePipe],
  template: `
    <div class="fade-in-up">
      <div class="mb-3">
        <h1 class="fw-bold mb-0">Ma scolarité</h1>
        <p class="text-muted mb-0">Frais, paiements mobiles, notes et attestations</p>
      </div>

      <div *ngIf="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>

      <div *ngIf="!loading && enrollments.length === 0" class="card"><div class="card-body text-center py-5">
        <i class="bi bi-person-vcard text-muted" style="font-size:3rem"></i>
        <h5 class="fw-bold mt-3">Aucune inscription administrative</h5>
        <p class="text-muted mb-0">La scolarité ne vous a pas encore inscrit(e) pour une année universitaire. Vous serez prévenu(e) par notification et email.</p>
      </div></div>

      <ng-container *ngIf="current as c">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3" *ngIf="enrollments.length > 1">
          <span class="small text-muted">Année :</span>
          <button *ngFor="let e of enrollments; let i = index" type="button" class="btn btn-sm"
                  [class.btn-primary]="i === selected" [class.btn-light]="i !== selected" (click)="selected = i">{{ e.enrollment.academicYear }}</button>
        </div>

        <!-- Résumé -->
        <div class="card mb-3"><div class="card-body">
          <div class="row g-3 align-items-center">
            <div class="col-md-5">
              <div class="small text-muted">Matricule</div>
              <div class="fw-bold fs-5">{{ c.enrollment.matricule }}</div>
              <div class="text-muted">{{ c.enrollment.level }} · {{ spec(c.enrollment.specialization) }} · {{ c.enrollment.academicYear }}</div>
              <span class="status-badge mt-2" [ngClass]="estatus[c.enrollment.status].tone">Inscription {{ estatus[c.enrollment.status].label.toLowerCase() }}</span>
            </div>
            <div class="col-md-4">
              <div class="d-flex justify-content-between small"><span>Payé</span><span class="amount fw-semibold">{{ fcfa(c.enrollment.paid) }} / {{ fcfa(c.enrollment.totalDue) }}</span></div>
              <div class="progress pay-progress my-2"><div class="progress-bar" [style.width.%]="c.enrollment.totalDue ? c.enrollment.paid * 100 / c.enrollment.totalDue : 100"></div></div>
              <div class="d-flex justify-content-between small"><span>Reste à payer</span><span class="amount fw-bold" [class.text-danger]="c.enrollment.overdue > 0">{{ fcfa(c.enrollment.balance) }}</span></div>
              <div *ngIf="c.enrollment.overdue > 0" class="small text-danger mt-1"><i class="bi bi-exclamation-triangle me-1"></i>{{ fcfa(c.enrollment.overdue) }} d'échéances dépassées</div>
              <div *ngIf="c.enrollment.pendingAmount > 0" class="small text-warning mt-1"><i class="bi bi-hourglass-split me-1"></i>{{ fcfa(c.enrollment.pendingAmount) }} en cours de vérification</div>
            </div>
            <div class="col-md-3 text-md-end">
              <button *ngIf="payable(c) > 0 && c.enrollment.status !== 'CANCELLED'" type="button" class="btn btn-primary fw-semibold w-100" (click)="openPay(c)">
                <i class="bi bi-phone me-1"></i>Payer par mobile</button>
              <div *ngIf="c.enrollment.balance === 0" class="text-success fw-semibold"><i class="bi bi-check-circle me-1"></i>Frais soldés</div>
            </div>
          </div>
        </div></div>

        <ul class="nav nav-underline school-tabs">
          <li class="nav-item" *ngFor="let t of tabs"><button type="button" class="nav-link" [class.active]="tab === t[0]" (click)="setTab(t[0])">{{ t[1] }}</button></li>
        </ul>

        <div *ngIf="tab === 'frais'" class="card"><div class="card-body">
          <app-school-schedule [items]="c.schedule"></app-school-schedule>
        </div></div>

        <div *ngIf="tab === 'paiements'" class="card"><div class="table-responsive">
          <table class="table align-middle mb-0 table-stack">
            <thead class="table-light"><tr><th>Date</th><th>Mode</th><th>Référence</th><th class="text-end">Montant</th><th>État</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let p of c.payments | paginate: paymentsPg.page : paymentsPg.size">
                <td class="small" data-label="Date">{{ p.submittedAt | date:'dd/MM/yyyy HH:mm' }}</td>
                <td data-label="Mode">{{ methodLabel(p.method) }}</td>
                <td class="small" data-label="Référence">{{ p.transactionRef || '—' }}</td>
                <td class="text-end amount fw-semibold" data-label="Montant">{{ fcfa(p.amount) }}</td>
                <td data-label="État"><span class="status-badge" [ngClass]="pstatus[p.status].tone">{{ pstatus[p.status].label === 'À vérifier' ? 'En vérification' : pstatus[p.status].label }}</span>
                  <div *ngIf="p.rejectionReason" class="small text-muted">{{ p.rejectionReason }}</div></td>
                <td class="text-end">
                  <button *ngIf="p.status === 'VALIDATED'" type="button" class="btn btn-sm btn-light" (click)="school.openPdf('/api/scolarite/payments/' + p.id + '/receipt', p.receiptNumber!)">
                    <i class="bi bi-receipt me-1"></i>Reçu</button>
                </td>
              </tr>
              <tr *ngIf="c.payments.length === 0"><td colspan="6" class="text-center text-muted py-4">Aucun paiement pour cette année.</td></tr>
            </tbody>
          </table>
        </div>
        <app-pagination [pager]="paymentsPg" [total]="c.payments.length"></app-pagination></div>

        <div *ngIf="tab === 'notes'" class="card"><div class="card-body">
          <app-school-transcript [transcript]="c.transcript" emptyText="Aucune note publiée pour le moment."></app-school-transcript>
        </div></div>

        <div *ngIf="tab === 'attestations'" class="card"><div class="card-body">
          <div class="list-group">
            <div *ngFor="let cert of c.certificates" class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <div class="fw-semibold"><i class="bi bi-patch-check me-1 text-success"></i>{{ cert.typeLabel }}</div>
                <div class="small text-muted">{{ cert.reference }} · délivrée le {{ cert.issuedAt | date:'dd/MM/yyyy' }}</div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" (click)="school.openPdf('/api/scolarite/certificates/' + cert.id + '/pdf', cert.reference)">
                <i class="bi bi-file-earmark-pdf me-1"></i>Voir et télécharger</button>
            </div>
            <div *ngIf="c.certificates.length === 0" class="text-muted text-center py-4">
              Aucune attestation. Les attestations (inscription, scolarité, réussite, relevé de notes) sont délivrées par la scolarité.
            </div>
          </div>
          <p class="small text-muted mt-3 mb-0"><i class="bi bi-qr-code me-1"></i>Chaque document porte un QR code : toute personne peut vérifier son authenticité en le scannant.</p>
        </div></div>
      </ng-container>
    </div>
  `
})
export class MyScolariteComponent implements OnInit {
  /** Pagination des listes. */
  paymentsPg = new Pager(10);
  enrollments: MyEnrollment[] = [];
  paymentNumbers: Record<string, string> = {};
  selected = 0;
  loading = true;
  tab = 'frais';
  readonly tabs = [['frais', 'Échéancier'], ['paiements', 'Paiements'], ['notes', 'Notes'], ['attestations', 'Attestations']];
  readonly estatus = ENROLLMENT_STATUS;
  readonly pstatus = PAYMENT_STATUS;
  readonly fcfa = fcfa;

  constructor(public school: SchoolService, private dialogs: DialogService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe(q => {
      const tab = q.get('tab');
      if (tab && this.tabs.some(t => t[0] === tab)) this.tab = tab;
    });
    this.load();
  }

  get current(): MyEnrollment | null { return this.enrollments[this.selected] ?? null; }

  load() {
    this.school.mySchooling().subscribe({
      next: r => { this.enrollments = r.enrollments; this.paymentNumbers = r.paymentNumbers; this.loading = false; },
      error: () => this.loading = false
    });
  }

  setTab(tab: string) {
    this.tab = tab;
    this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }

  /** Reste à payer, déduction faite des paiements déjà déclarés en attente de vérification. */
  payable(c: MyEnrollment) { return Math.max(0, c.enrollment.balance - c.enrollment.pendingAmount); }

  openPay(c: MyEnrollment) {
    // Montant restant sur la première échéance non soldée, après les paiements en vérification
    let pending = c.enrollment.pendingAmount;
    let nextDue = 0;
    for (const i of c.schedule) {
      const left = i.amount - i.paid;
      if (left <= 0) continue;
      if (pending >= left) { pending -= left; continue; }
      nextDue = left - pending;
      break;
    }
    this.dialogs.open<boolean>(MobilePaymentDialogComponent, {
      title: 'Paiement mobile', icon: 'bi-phone', size: 'md',
      data: { enrollmentId: c.enrollment.id, balance: this.payable(c), nextDue, numbers: this.paymentNumbers }
    }).afterClosed.then(ok => {
      if (!ok) return;
      this.dialogs.toast('Paiement déclaré : la scolarité va le vérifier. Vous serez notifié(e).');
      this.setTab('paiements');
      this.load();
    });
  }

  spec(s: string | null) { return s ? SPECIALIZATIONS[s] ?? s : 'Sans filière'; }
  methodLabel(m: string) { return METHOD_LABELS[m] ?? m; }
}
