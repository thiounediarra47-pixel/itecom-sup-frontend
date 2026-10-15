import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../core/services/dialog.service';
import { LEVELS, METHOD_LABELS, PAYMENT_STATUS, Payment, SchoolService, apiError, fcfa } from '../../core/services/school.service';

interface FeeRow { level: string; registrationFee: number | null; monthlyFee: number | null; saved: boolean; dirty: boolean; }

/**
 * Paiements : montant de l'inscription et mensualité par niveau, puis vérification des paiements
 * mobiles déclarés par les étudiants (validation → reçu avec QR code, refus → motif communiqué).
 */
@Component({
  selector: 'app-admin-paiements',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, FormsModule],
  template: `
    <div class="fade-in-up">
      <div class="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <div class="flex-grow-1">
          <h1 class="fw-bold mb-0">Paiements</h1>
          <p class="text-muted mb-0">Montants de l'inscription et des mensualités, paiements à vérifier</p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <label class="small text-muted" for="payYear">Année</label>
          <select id="payYear" class="form-select" style="width:auto" [(ngModel)]="year" (ngModelChange)="loadFees()">
            <option *ngFor="let y of years" [value]="y">{{ y }}</option>
          </select>
        </div>
      </div>

      <!-- ── Montants ── -->
      <div class="card mb-4"><div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h5 class="fw-bold mb-0">Montants {{ year }}</h5>
            <div class="small text-muted">Mensualité payée chaque mois, d'octobre à la fin de l'année ({{ months }} mois). Appliqués aux nouvelles inscriptions.</div>
          </div>
          <button class="btn btn-primary" [disabled]="busy || !hasChanges" (click)="saveFees()"><i class="bi bi-save me-1"></i>Enregistrer les montants</button>
        </div>
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead class="table-light"><tr><th>Niveau</th><th style="width:28%">Inscription (FCFA)</th><th style="width:28%">Mensualité (FCFA)</th><th class="text-end">Total de l'année</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of feeRows">
                <td class="fw-semibold">{{ r.level }}
                  <span *ngIf="!r.saved" class="status-badge warn ms-2">Non défini</span></td>
                <td><input type="number" min="0" step="500" class="form-control" [(ngModel)]="r.registrationFee" (ngModelChange)="r.dirty = true"
                           [attr.aria-label]="'Inscription ' + r.level" placeholder="Ex. 50 000"></td>
                <td><input type="number" min="0" step="500" class="form-control" [(ngModel)]="r.monthlyFee" (ngModelChange)="r.dirty = true"
                           [attr.aria-label]="'Mensualité ' + r.level" placeholder="Ex. 40 000"></td>
                <td class="text-end amount fw-semibold">{{ r.registrationFee !== null && r.monthlyFee !== null ? fcfa(r.registrationFee + r.monthlyFee * months) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div></div>

      <!-- ── Paiements reçus ── -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 class="fw-bold mb-0">Paiements des étudiants</h5>
        <div class="d-flex flex-wrap gap-2" role="group" aria-label="Filtrer les paiements">
          <button *ngFor="let s of filters" type="button" class="btn btn-sm" [class.btn-primary]="status === s[0]" [class.btn-light]="status !== s[0]"
                  (click)="status = s[0]; loadPayments()">{{ s[1] }}<span *ngIf="s[0] === 'PENDING' && pendingCount > 0" class="tab-count">{{ pendingCount }}</span></button>
        </div>
      </div>
      <div class="card"><div class="table-responsive">
        <table class="table align-middle mb-0 table-stack">
          <thead class="table-light"><tr><th>Date</th><th>Étudiant</th><th>Mode</th><th>Téléphone / Réf.</th><th class="text-end">Montant</th><th>État</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let p of payments | paginate: paymentsPg.page : paymentsPg.size">
              <td class="small" data-label="Date">{{ p.submittedAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td class="fw-semibold">{{ p.studentName }}<div class="small text-muted">{{ p.matricule }} · {{ p.level }} · {{ p.purpose === 'INSCRIPTION' ? 'Inscription' : 'Mensualité' }}</div></td>
              <td data-label="Mode">{{ methodLabel(p.method) }}</td>
              <td class="small" data-label="Téléphone / Réf.">{{ p.phone || '—' }}<div class="fw-semibold">{{ p.transactionRef || '—' }}</div></td>
              <td class="text-end amount fw-semibold" data-label="Montant">{{ fcfa(p.amount) }}</td>
              <td data-label="État">
                <span class="status-badge" [ngClass]="statusMap[p.status].tone">{{ statusMap[p.status].label }}</span>
                <div *ngIf="p.rejectionReason" class="small text-muted">{{ p.rejectionReason }}</div>
              </td>
              <td class="text-end text-nowrap">
                <ng-container *ngIf="p.status === 'PENDING'">
                  <button class="btn btn-sm btn-success me-1" [disabled]="busy" (click)="validate(p)"><i class="bi bi-check-lg me-1"></i>Valider</button>
                  <button class="btn btn-sm btn-outline-danger" [disabled]="busy" (click)="reject(p)">Refuser</button>
                </ng-container>
                <button *ngIf="p.status === 'VALIDATED'" class="btn btn-sm btn-light" (click)="school.openPdf('/api/admin/scolarite/payments/' + p.id + '/receipt', p.receiptNumber!)">
                  <i class="bi bi-receipt me-1"></i>Reçu</button>
              </td>
            </tr>
            <tr *ngIf="payments.length === 0"><td colspan="7" class="text-center text-muted py-4">
              {{ status === 'PENDING' ? 'Aucun paiement en attente de vérification.' : 'Aucun paiement.' }}</td></tr>
          </tbody>
        </table>
      </div>
      <app-pagination [pager]="paymentsPg" [total]="payments.length"></app-pagination></div>
      <p class="small text-muted mt-2"><i class="bi bi-info-circle me-1"></i>Comparez le numéro, le montant et la référence avec le relevé de votre compte Wave / Orange Money / Free Money avant de valider. Le reçu avec QR code est généré à la validation et l'étudiant est prévenu.</p>
    </div>
  `
})
export class AdminPaiementsComponent implements OnInit {
  /** Pagination des listes. */
  paymentsPg = new Pager(20);
  year = '';
  years: string[] = [];
  months = 9;
  feeRows: FeeRow[] = [];
  payments: Payment[] = [];
  pendingCount = 0;
  status = 'PENDING';
  busy = false;
  readonly filters = [['PENDING', 'À vérifier'], ['VALIDATED', 'Validés'], ['REJECTED', 'Refusés'], ['', 'Tous']];
  readonly statusMap = PAYMENT_STATUS;
  readonly fcfa = fcfa;

  constructor(public school: SchoolService, private dialogs: DialogService) {}

  ngOnInit() {
    this.school.options().subscribe(o => {
      const start = parseInt(o.currentYear.substring(0, 4), 10);
      this.years = [start + 1, start, start - 1].map(y => `${y}-${y + 1}`);
      this.year = o.currentYear;
      this.loadFees();
    });
    this.loadPayments();
  }

  get hasChanges(): boolean { return this.feeRows.some(r => r.dirty); }

  loadFees() {
    this.school.fees(this.year).subscribe(r => {
      this.months = r.months;
      this.feeRows = LEVELS.map(level => {
        const f = r.fees.find(x => x.level === level);
        return { level, registrationFee: f?.registrationFee ?? null, monthlyFee: f?.monthlyFee ?? null, saved: !!f, dirty: false };
      });
    });
  }

  saveFees() {
    const changed = this.feeRows.filter(r => r.dirty);
    const incomplete = changed.find(r => r.registrationFee === null || r.monthlyFee === null || r.registrationFee < 0 || r.monthlyFee < 0);
    if (incomplete) {
      this.dialogs.toast(`${incomplete.level} : saisissez l'inscription et la mensualité (montants positifs).`, 'danger');
      return;
    }
    this.busy = true;
    let remaining = changed.length;
    let failed = false;
    const done = () => {
      if (--remaining > 0) return;
      this.busy = false;
      if (!failed) this.dialogs.toast('Montants enregistrés.');
    };
    for (const r of changed) {
      this.school.saveFee({ academicYear: this.year, level: r.level, registrationFee: r.registrationFee!, monthlyFee: r.monthlyFee! }).subscribe({
        next: () => { r.dirty = false; r.saved = true; done(); },
        error: err => { failed = true; this.dialogs.toast(`${r.level} : ${apiError(err)}`, 'danger', 6000); done(); }
      });
    }
  }

  loadPayments() {
    this.school.payments(this.status).subscribe(p => {
      this.payments = p;
      if (this.status === 'PENDING') this.pendingCount = p.length;
    });
    if (this.status !== 'PENDING') this.school.payments('PENDING').subscribe(p => this.pendingCount = p.length);
  }

  validate(p: Payment) {
    this.busy = true;
    this.school.validatePayment(p.id).subscribe({
      next: v => { this.busy = false; this.dialogs.toast(`Paiement validé — reçu ${v.receiptNumber}`); this.loadPayments(); },
      error: err => { this.busy = false; this.dialogs.toast(apiError(err), 'danger', 6000); }
    });
  }

  async reject(p: Payment) {
    const reason = await this.dialogs.prompt({ title: 'Refuser ce paiement ?', message: `${p.studentName} — ${fcfa(p.amount)} (réf. ${p.transactionRef})`,
      placeholder: 'Motif communiqué à l\'étudiant (ex. référence introuvable)', multiline: true, tone: 'danger', confirmText: 'Refuser', icon: 'bi-x-circle' });
    if (reason === null) return;
    this.busy = true;
    this.school.rejectPayment(p.id, reason).subscribe({
      next: () => { this.busy = false; this.dialogs.toast('Paiement refusé, étudiant notifié.', 'info'); this.loadPayments(); },
      error: err => { this.busy = false; this.dialogs.toast(apiError(err), 'danger', 6000); }
    });
  }

  methodLabel(m: string) { return METHOD_LABELS[m] ?? m; }
}
