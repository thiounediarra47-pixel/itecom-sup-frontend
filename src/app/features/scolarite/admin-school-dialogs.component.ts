import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef, DialogService } from '../../core/services/dialog.service';
import {
  CERTIFICATE_TYPES, ENROLLMENT_STATUS, EnrollmentFile, Fee, LEVELS, METHOD_LABELS, PAYMENT_STATUS, SPECIALIZATIONS,
  SchoolService, apiError, fcfa
} from '../../core/services/school.service';
import { emailError, phoneError } from '../../core/validators/contact';
import { SchoolScheduleComponent, SchoolTranscriptComponent } from './school-shared.component';

/**
 * Inscription administrative : un nouvel étudiant (identité et pièces scannées en PDF selon son profil),
 * ou réinscription de tous les étudiants existants d'un niveau.
 */
@Component({
  selector: 'app-enrollment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <ul class="nav nav-underline school-tabs">
      <li class="nav-item"><button type="button" class="nav-link" [class.active]="mode === 'new'" (click)="mode = 'new'; error = ''">Nouvel étudiant</button></li>
      <li class="nav-item"><button type="button" class="nav-link" [class.active]="mode === 'level'" (click)="mode = 'level'; error = ''">Réinscrire un niveau</button></li>
    </ul>

    <!-- ── Nouvel étudiant ── -->
    <form *ngIf="mode === 'new'" (ngSubmit)="submit()" novalidate>
      <h6 class="fw-bold mb-2">Identité</h6>
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsLast">Nom</label>
          <input id="nsLast" class="form-control" name="lastName" [(ngModel)]="form.lastName" required autocomplete="off">
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsFirst">Prénom(s)</label>
          <input id="nsFirst" class="form-control" name="firstName" [(ngModel)]="form.firstName" required autocomplete="off">
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsBirth">Date de naissance</label>
          <input id="nsBirth" type="date" class="form-control" name="birthDate" [(ngModel)]="form.birthDate" [max]="today" required>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsPlace">Lieu de naissance</label>
          <input id="nsPlace" class="form-control" name="birthPlace" [(ngModel)]="form.birthPlace" required>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsEmail">Email</label>
          <input id="nsEmail" type="email" class="form-control" name="email" [(ngModel)]="form.email" required
                 [class.is-invalid]="touched.email && emailMsg" (blur)="touched.email = true" placeholder="prenom.nom@gmail.com">
          <div *ngIf="touched.email && emailMsg" class="invalid-feedback d-block">{{ emailMsg }}</div>
          <div *ngIf="!(touched.email && emailMsg)" class="form-text">Identifiant de connexion : les accès lui sont envoyés à cette adresse.</div>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsPhone">Téléphone <span class="text-muted fw-normal">(facultatif)</span></label>
          <input id="nsPhone" type="tel" class="form-control" name="phone" [(ngModel)]="form.phone" inputmode="tel"
                 [class.is-invalid]="touched.phone && phoneMsg" (blur)="touched.phone = true" placeholder="77 123 45 67">
          <div *ngIf="touched.phone && phoneMsg" class="invalid-feedback d-block">{{ phoneMsg }}</div>
        </div>
      </div>

      <h6 class="fw-bold mt-4 mb-2">Inscription</h6>
      <div class="row g-3">
        <div class="col-md-3">
          <label class="form-label fw-semibold small" for="nsYear">Année</label>
          <input id="nsYear" class="form-control" name="year" [(ngModel)]="year" placeholder="2026-2027">
        </div>
        <div class="col-md-2">
          <label class="form-label fw-semibold small" for="nsLevel">Niveau</label>
          <select id="nsLevel" class="form-select" name="level" [(ngModel)]="level">
            <option *ngFor="let l of levels" [value]="l">{{ l }}</option>
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label fw-semibold small" for="nsSpec">Filière</label>
          <select id="nsSpec" class="form-select" name="spec" [(ngModel)]="form.specialization">
            <option [ngValue]="null">Sans filière</option>
            <option *ngFor="let s of specs" [value]="s[0]">{{ s[1] }}</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label fw-semibold small" for="nsDiscount">Réduction (FCFA)</label>
          <input id="nsDiscount" type="number" min="0" step="500" class="form-control" name="discount" [(ngModel)]="form.discount">
        </div>
      </div>

      <ng-container *ngTemplateOutlet="feeBox"></ng-container>

      <h6 class="fw-bold mt-4 mb-2">Profil</h6>
      <div class="row g-2">
        <div class="col-md-6">
          <button type="button" class="method-card text-start" [class.active]="form.profile === 'NEW_BACHELOR'" (click)="form.profile = 'NEW_BACHELOR'">
            <span class="method-name"><i class="bi bi-mortarboard me-1"></i>Nouveau bachelier</span>
            <span class="small text-muted">Vient d'obtenir le bac</span>
          </button>
        </div>
        <div class="col-md-6">
          <button type="button" class="method-card text-start" [class.active]="form.profile === 'TRANSFER'" (click)="form.profile = 'TRANSFER'">
            <span class="method-name"><i class="bi bi-building me-1"></i>Étudiant d'un autre établissement</span>
            <span class="small text-muted">Vient d'une autre école ou université</span>
          </button>
        </div>
      </div>

      <h6 class="fw-bold mt-4 mb-2">Pièces scannées (PDF, 10 Mo maximum chacune)</h6>
      <!-- Nouveau bachelier : pièces du bac -->
      <div class="row g-3" *ngIf="form.profile === 'NEW_BACHELOR'">
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsBac">Attestation du bac</label>
          <input id="nsBac" type="file" class="form-control" accept="application/pdf,.pdf" (change)="pick($event, 'bacAttestation')">
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsBacNotes">Relevé de notes du bac</label>
          <input id="nsBacNotes" type="file" class="form-control" accept="application/pdf,.pdf" (change)="pick($event, 'bacTranscript')">
        </div>
      </div>
      <!-- Autre établissement : relevés de l'année passée et attestation de réussite -->
      <div class="row g-3" *ngIf="form.profile === 'TRANSFER'">
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsPrev">Relevés de notes de l'année passée</label>
          <input id="nsPrev" type="file" class="form-control" accept="application/pdf,.pdf" multiple (change)="pickMany($event)">
          <div class="form-text">Un ou plusieurs PDF (par semestre, par exemple).
            <span *ngIf="previous.length">{{ previous.length }} fichier(s) : {{ previousNames }}</span></div>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="nsSuccess">Attestation de réussite</label>
          <input id="nsSuccess" type="file" class="form-control" accept="application/pdf,.pdf" (change)="pick($event, 'successAttestation')">
          <div class="form-text">Délivrée par l'établissement d'origine.</div>
        </div>
      </div>

      <div *ngIf="error" class="alert alert-danger mt-3 mb-0 py-2">{{ error }}</div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" (click)="ref.close(created > 0)">Annuler</button>
        <button type="submit" class="btn btn-primary" [disabled]="saving">
          <span *ngIf="saving" class="spinner-border spinner-border-sm me-1"></span>Inscrire l'étudiant
        </button>
      </div>
    </form>

    <!-- ── Réinscription d'un niveau ── -->
    <ng-container *ngIf="mode === 'level'">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="enrYear">Année universitaire</label>
          <input id="enrYear" class="form-control" [(ngModel)]="year" placeholder="2026-2027">
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small" for="enrLevel">Niveau</label>
          <select id="enrLevel" class="form-select" [(ngModel)]="level">
            <option *ngFor="let l of levels" [value]="l">{{ l }}</option>
          </select>
        </div>
      </div>
      <ng-container *ngTemplateOutlet="feeBox"></ng-container>
      <p class="text-muted mt-3 mb-0">
        Les étudiants qui ont déjà un compte en {{ level }} et ne sont pas encore inscrits pour {{ year }} seront inscrits
        avec le barème de leur filière, et prévenus par notification et email.
      </p>
      <div *ngIf="error" class="alert alert-danger mt-3 mb-0 py-2">{{ error }}</div>
      <div *ngIf="levelErrors.length" class="alert alert-warning mt-3 mb-0 py-2 small">
        <div *ngFor="let e of levelErrors">{{ e }}</div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" (click)="ref.close(created > 0)">Fermer</button>
        <button type="button" class="btn btn-primary" [disabled]="saving" (click)="submit()">
          <span *ngIf="saving" class="spinner-border spinner-border-sm me-1"></span>Réinscrire le niveau {{ level }}
        </button>
      </div>
    </ng-container>

    <!-- Montants du niveau : affichés, ou à saisir ici s'ils n'existent pas encore -->
    <ng-template #feeBox>
      <div class="p-3 rounded-3 mt-3" style="background:var(--surface-muted)">
        <ng-container *ngIf="currentFee as fee; else noFee">
          <div class="d-flex flex-wrap gap-3 align-items-center small">
            <span><i class="bi bi-tag me-1"></i>Inscription <strong class="amount">{{ fcfa(fee.registrationFee) }}</strong></span>
            <span>Mensualité <strong class="amount">{{ fcfa(fee.monthlyFee) }}</strong> × {{ fee.months }} mois</span>
            <span class="text-muted">Total de l'année {{ fcfa(fee.annualTotal) }}</span>
          </div>
        </ng-container>
        <ng-template #noFee>
          <div class="small fw-semibold mb-2"><i class="bi bi-exclamation-triangle text-warning me-1"></i>Aucun montant défini pour {{ level }} {{ year }} : renseignez-les.</div>
          <div class="row g-2 align-items-end">
            <div class="col-sm-4">
              <label class="form-label small mb-1" for="qfReg">Inscription (FCFA)</label>
              <input id="qfReg" type="number" min="0" step="500" class="form-control form-control-sm" name="qfReg" [(ngModel)]="quickFee.registrationFee">
            </div>
            <div class="col-sm-4">
              <label class="form-label small mb-1" for="qfMonth">Mensualité (FCFA)</label>
              <input id="qfMonth" type="number" min="0" step="500" class="form-control form-control-sm" name="qfMonth" [(ngModel)]="quickFee.monthlyFee">
            </div>
            <div class="col-sm-4">
              <button type="button" class="btn btn-sm btn-outline-primary w-100" [disabled]="savingFee" (click)="saveQuickFee()">Enregistrer ces montants</button>
            </div>
          </div>
        </ng-template>
      </div>
    </ng-template>
  `
})
export class EnrollmentDialogComponent implements OnInit {
  mode: 'new' | 'level' = 'new';
  year: string;
  level = 'L1';
  form = { lastName: '', firstName: '', birthDate: '', birthPlace: '', email: '', phone: '',
           specialization: null as string | null, discount: 0, profile: 'NEW_BACHELOR' as 'NEW_BACHELOR' | 'TRANSFER' };
  files: { bacAttestation?: File; bacTranscript?: File; successAttestation?: File } = {};
  touched = { email: false, phone: false };
  fees: Fee[] = [];
  private feesYear = '';
  quickFee = { registrationFee: null as number | null, monthlyFee: null as number | null };
  savingFee = false;
  readonly fcfa = fcfa;
  previous: File[] = [];
  saving = false;
  error = '';
  levelErrors: string[] = [];
  created = 0;
  readonly today = new Date().toISOString().substring(0, 10);
  readonly levels = LEVELS;
  readonly specs = Object.entries(SPECIALIZATIONS);

  constructor(@Inject(DIALOG_DATA) data: { year: string }, public ref: DialogRef<boolean>, private school: SchoolService,
              private dialogs: DialogService) {
    this.year = data.year;
  }

  ngOnInit() { this.loadFees(); }

  /** Montants du niveau choisi pour l'année (rechargés si l'année change). */
  get currentFee(): Fee | null {
    if (this.year !== this.feesYear) this.loadFees();
    return this.fees.find(f => f.academicYear === this.year && f.level === this.level) ?? null;
  }

  private loadFees() {
    if (!/^\d{4}-\d{4}$/.test(this.year)) return;
    this.feesYear = this.year;
    this.school.fees(this.year).subscribe(r => this.fees = r.fees);
  }

  saveQuickFee() {
    const { registrationFee, monthlyFee } = this.quickFee;
    if (registrationFee === null || monthlyFee === null || registrationFee < 0 || monthlyFee < 0) {
      this.error = 'Saisissez le montant de l\'inscription et celui de la mensualité.';
      return;
    }
    this.savingFee = true;
    this.error = '';
    this.school.saveFee({ academicYear: this.year, level: this.level, registrationFee, monthlyFee }).subscribe({
      next: f => { this.savingFee = false; this.fees = [...this.fees.filter(x => x.id !== f.id), f]; this.dialogs.toast(`Montants ${f.level} enregistrés.`); },
      error: err => { this.savingFee = false; this.error = apiError(err); }
    });
  }

  get previousNames(): string { return this.previous.map(f => f.name).join(', '); }
  get emailMsg(): string | null { return emailError(this.form.email); }
  get phoneMsg(): string | null { return this.form.phone.trim() ? phoneError(this.form.phone) : null; }

  pick(event: Event, key: 'bacAttestation' | 'bacTranscript' | 'successAttestation') {
    this.files[key] = (event.target as HTMLInputElement).files?.[0];
  }

  pickMany(event: Event) {
    this.previous = Array.from((event.target as HTMLInputElement).files ?? []);
  }

  /** Contrôles avant envoi ; le serveur refait les mêmes vérifications. */
  private validateNew(): string | null {
    const f = this.form;
    if (!this.currentFee) return `Renseignez d'abord le montant de l'inscription et la mensualité de ${this.level}.`;
    if (!f.lastName.trim() || !f.firstName.trim()) return 'Indiquez le nom et le prénom.';
    if (!f.birthDate) return 'Indiquez la date de naissance.';
    if (f.birthDate > this.today) return 'La date de naissance ne peut pas être dans le futur.';
    if (!f.birthPlace.trim()) return 'Indiquez le lieu de naissance.';
    this.touched = { email: true, phone: true };
    if (this.emailMsg) return this.emailMsg;
    if (this.phoneMsg) return this.phoneMsg;
    let all: File[];
    if (f.profile === 'NEW_BACHELOR') {
      if (!this.files.bacAttestation) return 'Joignez l\'attestation du bac scannée en PDF.';
      if (!this.files.bacTranscript) return 'Joignez le relevé de notes du bac scanné en PDF.';
      all = [this.files.bacAttestation, this.files.bacTranscript];
    } else {
      if (this.previous.length === 0) return 'Joignez les relevés de notes de l\'année passée (PDF).';
      if (!this.files.successAttestation) return 'Joignez l\'attestation de réussite de l\'établissement d\'origine (PDF).';
      all = [...this.previous, this.files.successAttestation];
    }
    const notPdf = all.find(x => !x.name.toLowerCase().endsWith('.pdf'));
    if (notPdf) return `« ${notPdf.name} » n'est pas un PDF.`;
    const tooBig = all.find(x => x.size > 10 * 1024 * 1024);
    if (tooBig) return `« ${tooBig.name} » dépasse 10 Mo.`;
    return null;
  }

  submit() {
    this.error = '';
    this.levelErrors = [];
    if (this.mode === 'level') { this.submitLevel(); return; }
    const invalid = this.validateNew();
    if (invalid) { this.error = invalid; return; }

    const f = this.form;
    const body = new FormData();
    body.append('lastName', f.lastName.trim());
    body.append('firstName', f.firstName.trim());
    body.append('birthDate', f.birthDate);
    body.append('birthPlace', f.birthPlace.trim());
    body.append('email', f.email.trim());
    if (f.phone.trim()) body.append('phone', f.phone.trim());
    body.append('academicYear', this.year);
    body.append('level', this.level);
    if (f.specialization) body.append('specialization', f.specialization);
    body.append('discount', String(f.discount || 0));
    body.append('profile', f.profile);
    if (f.profile === 'NEW_BACHELOR') {
      body.append('bacAttestation', this.files.bacAttestation!);
      body.append('bacTranscript', this.files.bacTranscript!);
    } else {
      this.previous.forEach(p => body.append('previousTranscripts', p));
      body.append('successAttestation', this.files.successAttestation!);
    }

    this.saving = true;
    this.school.admit(body).subscribe({
      next: r => {
        this.ref.close(true);
        if (r.emailSent) {
          this.dialogs.toast(r.message);
        } else {
          this.dialogs.alert({ title: 'Étudiant inscrit', icon: 'bi-exclamation-triangle', tone: 'warning',
            message: `${r.message}\nIdentifiant : ${f.email.trim().toLowerCase()} — mot de passe : ${r.password}` });
        }
      },
      error: err => { this.saving = false; this.error = apiError(err); }
    });
  }

  private submitLevel() {
    this.saving = true;
    this.school.enrollLevel(this.year, this.level).subscribe({
      next: r => {
        this.saving = false;
        this.created += r.created;
        this.levelErrors = r.errors;
        this.dialogs.toast(`${r.created} étudiant(s) réinscrit(s) en ${this.level}`, r.created ? 'success' : 'info');
        if (!r.errors.length) this.ref.close(true);
      },
      error: err => { this.saving = false; this.error = apiError(err); }
    });
  }
}

/** Dossier de scolarité d'un étudiant : échéancier, paiements, notes, attestations et actions. */
@Component({
  selector: 'app-enrollment-file-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, SchoolScheduleComponent, SchoolTranscriptComponent],
  template: `
    <div *ngIf="!file" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
    <ng-container *ngIf="file as f">
      <div class="d-flex flex-wrap justify-content-between gap-3 mb-3">
        <div>
          <h5 class="fw-bold mb-1">{{ f.enrollment.studentName }}</h5>
          <div class="text-muted small">{{ f.enrollment.matricule }} · {{ f.enrollment.level }} · {{ spec(f.enrollment.specialization) }} · {{ f.enrollment.academicYear }}</div>
          <div class="text-muted small">{{ f.enrollment.email }}</div>
        </div>
        <div class="text-end">
          <span class="status-badge" [ngClass]="estatus[f.enrollment.status].tone">{{ estatus[f.enrollment.status].label }}</span>
          <div class="mt-2 small">Payé <strong class="amount">{{ fcfa(f.enrollment.paid) }}</strong> sur <span class="amount">{{ fcfa(f.enrollment.totalDue) }}</span></div>
          <div class="small" [class.text-danger]="f.enrollment.balance > 0">Reste <strong class="amount">{{ fcfa(f.enrollment.balance) }}</strong></div>
        </div>
      </div>

      <ul class="nav nav-underline school-tabs">
        <li class="nav-item" *ngFor="let t of tabs"><button type="button" class="nav-link" [class.active]="tab === t[0]" (click)="tab = t[0]">{{ t[1] }}</button></li>
      </ul>

      <!-- Finances -->
      <div *ngIf="tab === 'finances'">
        <app-school-schedule [items]="f.schedule"></app-school-schedule>

        <h6 class="fw-bold mt-4">Encaisser un paiement</h6>
        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <label class="form-label small" for="payAmount">Montant (FCFA)</label>
            <input id="payAmount" type="number" min="0" step="500" class="form-control" [(ngModel)]="pay.amount">
          </div>
          <div class="col-md-3">
            <label class="form-label small" for="payMethod">Mode</label>
            <select id="payMethod" class="form-select" [(ngModel)]="pay.method">
              <option *ngFor="let m of methods" [value]="m[0]">{{ m[1] }}</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label small" for="payRef">Référence (facultatif)</label>
            <input id="payRef" class="form-control" [(ngModel)]="pay.transactionRef" placeholder="N° de transaction, de chèque…">
          </div>
          <div class="col-md-2">
            <button type="button" class="btn btn-primary w-100" [disabled]="busy || !pay.amount" (click)="recordPayment()">Encaisser</button>
          </div>
        </div>

        <h6 class="fw-bold mt-4">Historique des paiements</h6>
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead class="table-light"><tr><th>Date</th><th>Mode</th><th>Référence</th><th class="text-end">Montant</th><th>État</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let p of f.payments">
                <td>{{ p.submittedAt | date:'dd/MM/yyyy' }}</td>
                <td>{{ methodLabel(p.method) }}</td>
                <td class="small">{{ p.transactionRef || '—' }}</td>
                <td class="text-end amount">{{ fcfa(p.amount) }}</td>
                <td><span class="status-badge" [ngClass]="pstatus[p.status].tone">{{ pstatus[p.status].label }}</span></td>
                <td class="text-end">
                  <button *ngIf="p.status === 'VALIDATED'" type="button" class="btn btn-sm btn-light" (click)="school.openPdf('/api/admin/scolarite/payments/' + p.id + '/receipt', p.receiptNumber!)">
                    <i class="bi bi-receipt me-1"></i>Reçu</button>
                </td>
              </tr>
              <tr *ngIf="f.payments.length === 0"><td colspan="6" class="text-muted text-center py-3">Aucun paiement.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Notes -->
      <div *ngIf="tab === 'notes'">
        <app-school-transcript [transcript]="f.transcript" [showPublished]="true"
          emptyText="Aucune note saisie. Saisissez les notes par matière dans l'onglet « Notes »."></app-school-transcript>
      </div>

      <!-- Attestations -->
      <div *ngIf="tab === 'attestations'">
        <div class="d-flex flex-wrap gap-2 align-items-end mb-3">
          <div class="flex-grow-1">
            <label class="form-label small" for="certType">Délivrer un document</label>
            <select id="certType" class="form-select" [(ngModel)]="certType">
              <option *ngFor="let c of certTypes" [value]="c[0]">{{ c[1] }}</option>
            </select>
          </div>
          <button type="button" class="btn btn-primary" [disabled]="busy" (click)="issue()"><i class="bi bi-qr-code me-1"></i>Délivrer</button>
        </div>
        <div class="list-group">
          <div *ngFor="let c of f.certificates" class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <div class="fw-semibold">{{ c.typeLabel }} <span *ngIf="c.revoked" class="status-badge danger ms-1">Annulée</span></div>
              <div class="small text-muted">{{ c.reference }} · délivrée le {{ c.issuedAt | date:'dd/MM/yyyy' }}{{ c.mention ? ' · mention ' + c.mention : '' }}</div>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-light" (click)="school.openPdf('/api/admin/scolarite/certificates/' + c.id + '/pdf', c.reference)"><i class="bi bi-file-earmark-pdf me-1"></i>Voir</button>
              <button *ngIf="!c.revoked" type="button" class="btn btn-sm btn-outline-danger" (click)="revoke(c.id)">Annuler</button>
            </div>
          </div>
          <div *ngIf="f.certificates.length === 0" class="text-muted small p-2">Aucun document délivré.</div>
        </div>
      </div>

      <!-- Pièces du dossier -->
      <div *ngIf="tab === 'pieces'">
        <div class="list-group">
          <div *ngFor="let d of f.documents" class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <div class="fw-semibold"><i class="bi bi-file-earmark-pdf me-1 text-danger"></i>{{ d.typeLabel }}</div>
              <div class="small text-muted">{{ d.originalName }} · {{ (d.size / 1024) | number:'1.0-0' }} Ko · reçu le {{ d.uploadedAt | date:'dd/MM/yyyy' }}</div>
            </div>
            <button type="button" class="btn btn-sm btn-light" (click)="school.openPdf('/api/admin/scolarite/documents/' + d.id, d.typeLabel)">
              <i class="bi bi-eye me-1"></i>Voir</button>
          </div>
          <div *ngIf="f.documents.length === 0" class="text-muted small p-2">Aucune pièce : étudiant réinscrit depuis un compte existant.</div>
        </div>
      </div>

      <!-- Inscription -->
      <div *ngIf="tab === 'inscription'">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label small" for="edStatus">Statut</label>
            <select id="edStatus" class="form-select" [(ngModel)]="edit.status">
              <option *ngFor="let s of statuses" [value]="s[0]">{{ s[1].label }}</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label small" for="edDiscount">Réduction / bourse (FCFA)</label>
            <input id="edDiscount" type="number" min="0" step="500" class="form-control" [(ngModel)]="edit.discount">
          </div>
          <div class="col-md-4">
            <label class="form-label small" for="edInst">Mensualités</label>
            <input id="edInst" type="number" min="1" max="12" class="form-control" [(ngModel)]="edit.installments">
          </div>
        </div>
        <p class="small text-muted mt-2">Frais d'inscription {{ fcfa(f.enrollment.registrationFee) }} · scolarité {{ fcfa(f.enrollment.tuitionFee) }}.
          Un changement de statut est notifié à l'étudiant.</p>
        <div class="d-flex justify-content-between">
          <button type="button" class="btn btn-outline-danger" [disabled]="busy" (click)="remove()"><i class="bi bi-trash3 me-1"></i>Supprimer l'inscription</button>
          <button type="button" class="btn btn-primary" [disabled]="busy" (click)="saveEdit()">Enregistrer</button>
        </div>
      </div>
    </ng-container>
  `
})
export class EnrollmentFileDialogComponent implements OnInit {
  file: EnrollmentFile | null = null;
  tab = 'finances';
  busy = false;
  changed = false;
  pay = { amount: null as number | null, method: 'ESPECES', transactionRef: '' };
  certType = 'INSCRIPTION';
  edit = { status: 'PENDING', discount: 0, installments: 1 };
  readonly tabs = [['finances', 'Finances'], ['notes', 'Notes'], ['attestations', 'Attestations'], ['pieces', 'Pièces du dossier'], ['inscription', 'Inscription']];
  readonly methods = Object.entries(METHOD_LABELS);
  readonly certTypes = Object.entries(CERTIFICATE_TYPES);
  readonly statuses = Object.entries(ENROLLMENT_STATUS);
  readonly estatus = ENROLLMENT_STATUS;
  readonly pstatus = PAYMENT_STATUS;
  readonly fcfa = fcfa;

  constructor(@Inject(DIALOG_DATA) private data: { id: number; tab?: string }, public ref: DialogRef<boolean>,
              public school: SchoolService, private dialogs: DialogService) {
    if (data.tab) this.tab = data.tab;
  }

  ngOnInit() { this.load(); }

  load() {
    this.school.enrollmentFile(this.data.id).subscribe(f => {
      this.file = f;
      this.edit = { status: f.enrollment.status, discount: f.enrollment.discount, installments: f.enrollment.installments };
      if (!this.pay.amount) this.pay.amount = f.enrollment.balance || null;
    });
  }

  spec(s: string | null) { return s ? SPECIALIZATIONS[s] ?? s : 'Sans filière'; }
  methodLabel(m: string) { return METHOD_LABELS[m] ?? m; }

  private run(obs: any, success: string) {
    this.busy = true;
    obs.subscribe({
      next: () => { this.busy = false; this.changed = true; this.dialogs.toast(success); this.load(); },
      error: (err: any) => { this.busy = false; this.dialogs.toast(apiError(err), 'danger', 6000); }
    });
  }

  recordPayment() {
    this.run(this.school.recordPayment({ enrollmentId: this.data.id, ...this.pay }), 'Paiement encaissé, reçu généré et étudiant notifié.');
    this.pay = { amount: null, method: this.pay.method, transactionRef: '' };
  }

  issue() {
    this.run(this.school.issueCertificate(this.data.id, this.certType), `${CERTIFICATE_TYPES[this.certType]} délivré(e), étudiant notifié.`);
  }

  async revoke(id: number) {
    const ok = await this.dialogs.confirm({ title: 'Annuler ce document ?', message: 'Le QR code indiquera qu\'il n\'est plus valide.',
      icon: 'bi-x-octagon', tone: 'danger', confirmText: 'Annuler le document', cancelText: 'Garder' });
    if (ok) this.run(this.school.revokeCertificate(id), 'Document annulé.');
  }

  saveEdit() {
    this.run(this.school.updateEnrollment(this.data.id, this.edit), 'Inscription mise à jour.');
  }

  async remove() {
    if (!await this.dialogs.confirmDelete('cette inscription')) return;
    this.busy = true;
    this.school.deleteEnrollment(this.data.id).subscribe({
      next: () => { this.dialogs.toast('Inscription supprimée.'); this.ref.close(true); },
      error: err => { this.busy = false; this.dialogs.toast(apiError(err), 'danger', 6000); }
    });
  }
}
