import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/services/dialog.service';
import {
  Certificate, ENROLLMENT_STATUS, Enrollment, LEVELS, METHOD_LABELS, SPECIALIZATIONS,
  SchoolService, SchoolStats, SheetRow, apiError, fcfa
} from '../../core/services/school.service';
import { EnrollmentDialogComponent, EnrollmentFileDialogComponent } from './admin-school-dialogs.component';

type Tab = 'dashboard' | 'enrollments' | 'grades' | 'certificates' | 'announcements';

@Component({
  selector: 'app-admin-scolarite',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, FormsModule, RouterLink],
  template: `
    <div class="fade-in-up">
      <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <div class="flex-grow-1">
          <h1 class="fw-bold mb-0">Scolarité</h1>
          <p class="text-muted mb-0">Inscriptions, paiements mobiles, notes, attestations et notifications</p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <label class="small text-muted" for="schoolYear">Année</label>
          <select id="schoolYear" class="form-select" style="width:auto" [(ngModel)]="year" (ngModelChange)="reload()">
            <option *ngFor="let y of years" [value]="y">{{ y }}</option>
          </select>
        </div>
        <button class="btn btn-primary fw-semibold" (click)="openEnroll()"><i class="bi bi-person-plus me-2"></i>Inscrire</button>
      </div>

      <ul class="nav nav-underline school-tabs">
        <li class="nav-item" *ngFor="let t of tabs">
          <button type="button" class="nav-link" [class.active]="tab === t.key" (click)="setTab(t.key)">
            <i class="bi me-1" [ngClass]="t.icon"></i>{{ t.label }}
          </button>
        </li>
      </ul>

      <!-- ── Tableau de bord ── -->
      <ng-container *ngIf="tab === 'dashboard'">
        <div *ngIf="!stats" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        <ng-container *ngIf="stats as s">
          <div class="row g-3 mb-4">
            <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon"><i class="bi bi-people"></i></div>
              <div class="stat-value">{{ s.students }}</div><div class="stat-label">Inscrits ({{ s.active }} actifs)</div></div></div>
            <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon"><i class="bi bi-cash-coin"></i></div>
              <div class="stat-value amount" style="font-size:1.4rem">{{ fcfa(s.collected) }}</div><div class="stat-label">Encaissé · {{ s.collectionRate }} % des frais</div></div></div>
            <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon"><i class="bi bi-hourglass-split"></i></div>
              <div class="stat-value amount" style="font-size:1.4rem">{{ fcfa(s.remaining) }}</div><div class="stat-label">Reste à recouvrer</div></div></div>
            <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon"><i class="bi bi-exclamation-triangle"></i></div>
              <div class="stat-value amount" style="font-size:1.4rem" [class.text-danger]="s.overdue > 0">{{ fcfa(s.overdue) }}</div><div class="stat-label">En retard · {{ s.overdueStudents }} étudiant(s)</div></div></div>
          </div>

          <div class="row g-3">
            <div class="col-lg-8">
              <div class="card h-100"><div class="card-body">
                <h6 class="fw-bold mb-3">Recouvrement par niveau</h6>
                <div class="table-responsive">
                  <table class="table table-sm align-middle mb-0">
                    <thead class="table-light"><tr><th>Niveau</th><th class="text-center">Inscrits</th><th class="text-end">Attendu</th><th class="text-end">Encaissé</th><th style="width:25%">Progression</th><th class="text-center">Non soldés</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let l of s.byLevel">
                        <td class="fw-semibold">{{ l.level }}</td>
                        <td class="text-center">{{ l.students }}</td>
                        <td class="text-end amount">{{ fcfa(l.expected) }}</td>
                        <td class="text-end amount">{{ fcfa(l.collected) }}</td>
                        <td><div class="progress pay-progress"><div class="progress-bar" [style.width.%]="l.expected ? l.collected * 100 / l.expected : 0"></div></div></td>
                        <td class="text-center">{{ l.unpaidStudents }}</td>
                      </tr>
                      <tr *ngIf="s.byLevel.length === 0"><td colspan="6" class="text-center text-muted py-3">Aucune inscription pour {{ s.academicYear }}.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div></div>
            </div>
            <div class="col-lg-4">
              <div class="card mb-3"><div class="card-body">
                <h6 class="fw-bold mb-3">Encaissements par mode</h6>
                <div *ngFor="let m of methodEntries(s.byMethod)" class="d-flex justify-content-between py-1 border-bottom">
                  <span>{{ methodLabel(m[0]) }}</span><span class="amount fw-semibold">{{ fcfa(m[1]) }}</span>
                </div>
                <div *ngIf="methodEntries(s.byMethod).length === 0" class="text-muted small">Aucun encaissement.</div>
              </div></div>
              <div class="card"><div class="card-body">
                <h6 class="fw-bold mb-2">Actions</h6>
                <button class="btn btn-light w-100 mb-2 text-start" routerLink="/admin/paiements">
                  <i class="bi bi-phone me-2"></i>{{ s.pendingPayments }} paiement(s) mobile(s) à vérifier · {{ fcfa(s.pendingAmount) }}</button>
                <button class="btn btn-light w-100 mb-2 text-start" [disabled]="busy" (click)="remind()">
                  <i class="bi bi-bell me-2"></i>Relancer les étudiants en retard</button>
                <button class="btn btn-light w-100 text-start" (click)="setTab('certificates')">
                  <i class="bi bi-patch-check me-2"></i>{{ s.certificates }} document(s) délivré(s)</button>
              </div></div>
            </div>
          </div>
        </ng-container>
      </ng-container>

      <!-- ── Inscriptions ── -->
      <ng-container *ngIf="tab === 'enrollments'">
        <div class="d-flex flex-wrap gap-2 mb-3">
          <input type="search" class="form-control" style="max-width:320px" [(ngModel)]="search" placeholder="Nom, matricule, email…" aria-label="Rechercher">
          <select class="form-select" style="width:auto" [(ngModel)]="levelFilter" aria-label="Niveau">
            <option value="">Tous les niveaux</option><option *ngFor="let l of levels" [value]="l">{{ l }}</option>
          </select>
          <select class="form-select" style="width:auto" [(ngModel)]="statusFilter" aria-label="Statut">
            <option value="">Tous les statuts</option>
            <option *ngFor="let s of enrollmentStatuses" [value]="s[0]">{{ s[1].label }}</option>
            <option value="UNPAID">Non soldés</option><option value="OVERDUE">En retard</option>
          </select>
        </div>
        <div class="card"><div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead class="table-light"><tr><th>Matricule</th><th>Étudiant</th><th>Niveau</th><th>Statut</th><th style="min-width:160px">Paiement</th><th class="text-end">Reste</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let e of filteredEnrollments | paginate: enrollmentsPg.page : enrollmentsPg.size" style="cursor:pointer" (click)="openFile(e.id)">
                <td class="small fw-semibold">{{ e.matricule }}</td>
                <td>{{ e.studentName }}<div class="small text-muted">{{ spec(e.specialization) }}</div></td>
                <td>{{ e.level }}</td>
                <td><span class="status-badge" [ngClass]="enrollmentStatus[e.status].tone">{{ enrollmentStatus[e.status].label }}</span></td>
                <td>
                  <div class="progress pay-progress mb-1"><div class="progress-bar" [style.width.%]="e.totalDue ? e.paid * 100 / e.totalDue : 100"></div></div>
                  <span class="small text-muted amount">{{ fcfa(e.paid) }} / {{ fcfa(e.totalDue) }}</span>
                </td>
                <td class="text-end">
                  <span class="amount" [class.text-danger]="e.overdue > 0">{{ fcfa(e.balance) }}</span>
                  <div *ngIf="e.overdue > 0" class="small text-danger">{{ fcfa(e.overdue) }} en retard</div>
                  <div *ngIf="e.pendingAmount > 0" class="small text-warning">{{ fcfa(e.pendingAmount) }} à vérifier</div>
                </td>
                <td class="text-end"><i class="bi bi-chevron-right text-muted"></i></td>
              </tr>
              <tr *ngIf="filteredEnrollments.length === 0"><td colspan="7" class="text-center text-muted py-4">
                Aucune inscription{{ search || levelFilter || statusFilter ? ' ne correspond aux filtres' : ' pour ' + year + '. Utilisez « Inscrire »' }}.</td></tr>
            </tbody>
          </table>
        </div>
        <app-pagination [pager]="enrollmentsPg" [total]="filteredEnrollments.length"></app-pagination></div>
      </ng-container>

      <!-- ── Notes ── -->
      <ng-container *ngIf="tab === 'grades'">
        <div class="card mb-3"><div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-6 col-md-2">
              <label class="form-label small" for="gLevel">Niveau</label>
              <select id="gLevel" class="form-select" [(ngModel)]="sheet.level" (ngModelChange)="loadSubjects()">
                <option *ngFor="let l of levels" [value]="l">{{ l }}</option></select>
            </div>
            <div class="col-6 col-md-2">
              <label class="form-label small" for="gSem">Semestre</label>
              <select id="gSem" class="form-select" [(ngModel)]="sheet.semester"><option value="S1">S1</option><option value="S2">S2</option></select>
            </div>
            <div class="col-6 col-md-2">
              <label class="form-label small" for="gSession">Session</label>
              <select id="gSession" class="form-select" [(ngModel)]="sheet.session"><option value="NORMALE">Normale</option><option value="RATTRAPAGE">Rattrapage</option></select>
            </div>
            <div class="col-6 col-md-4">
              <label class="form-label small" for="gSubject">Matière</label>
              <input id="gSubject" class="form-control" list="subjectList" [(ngModel)]="sheet.subject" placeholder="Ex. Comptabilité générale">
              <datalist id="subjectList"><option *ngFor="let s of subjects" [value]="s"></option></datalist>
            </div>
            <div class="col-12 col-md-2">
              <button class="btn btn-primary w-100" [disabled]="!sheet.subject.trim()" (click)="loadSheet()">Ouvrir</button>
            </div>
          </div>
        </div></div>

        <div *ngIf="sheetRows" class="card"><div class="card-body">
          <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
            <h6 class="fw-bold mb-0 flex-grow-1">{{ sheetTitle }}</h6>
            <label class="small text-muted" for="gCoef">Coefficient</label>
            <input id="gCoef" type="number" min="0.5" max="20" step="0.5" class="form-control" style="width:90px" [(ngModel)]="sheetCoefficient">
          </div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light"><tr><th>Matricule</th><th>Étudiant</th><th style="width:130px">Note /20</th><th>Appréciation</th><th></th></tr></thead>
              <tbody>
                <tr *ngFor="let r of sheetRows | paginate: sheetPg.page : sheetPg.size">
                  <td class="small">{{ r.matricule }}</td>
                  <td>{{ r.studentName }}</td>
                  <td><input type="number" min="0" max="20" step="0.25" class="form-control form-control-sm" [(ngModel)]="r.grade" [attr.aria-label]="'Note de ' + r.studentName"
                             [class.is-invalid]="r.grade !== null && (r.grade < 0 || r.grade > 20)"></td>
                  <td><input class="form-control form-control-sm" [(ngModel)]="r.comment" maxlength="500" [attr.aria-label]="'Appréciation pour ' + r.studentName"></td>
                  <td class="text-end"><span class="status-badge" [ngClass]="r.published ? 'ok' : 'muted'">{{ r.published ? 'Publiée' : 'Brouillon' }}</span></td>
                </tr>
                <tr *ngIf="sheetRows.length === 0"><td colspan="5" class="text-center text-muted py-4">Aucun étudiant inscrit en {{ sheet.level }} pour {{ year }}.</td></tr>
              </tbody>
            </table>
          </div>
          <app-pagination [pager]="sheetPg" [total]="sheetRows.length"></app-pagination>
          <div class="d-flex flex-wrap justify-content-between gap-2 mt-3">
            <button class="btn btn-outline-primary" [disabled]="busy" (click)="publish()"><i class="bi bi-megaphone me-1"></i>Publier les notes du {{ sheet.semester }} ({{ sheet.level }})</button>
            <button class="btn btn-primary" [disabled]="busy || sheetRows.length === 0" (click)="saveSheet()"><i class="bi bi-save me-1"></i>Enregistrer la feuille</button>
          </div>
          <p class="small text-muted mt-2 mb-0">Les notes restent en brouillon tant qu'elles ne sont pas publiées. La publication prévient chaque étudiant par notification et email. Une case vide supprime la note.</p>
        </div></div>
      </ng-container>

      <!-- ── Attestations ── -->
      <ng-container *ngIf="tab === 'certificates'">
        <div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
          <input type="search" class="form-control" style="max-width:320px" [(ngModel)]="certSearch" placeholder="Nom, matricule, référence…" aria-label="Rechercher">
          <span class="small text-muted"><i class="bi bi-info-circle me-1"></i>Pour délivrer un document, ouvrez le dossier de l'étudiant (onglet Inscriptions → Attestations).</span>
        </div>
        <div class="card"><div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead class="table-light"><tr><th>Référence</th><th>Document</th><th>Étudiant</th><th>Délivré le</th><th>État</th><th class="text-end"></th></tr></thead>
            <tbody>
              <tr *ngFor="let c of filteredCertificates | paginate: certificatesPg.page : certificatesPg.size">
                <td class="small fw-semibold">{{ c.reference }}</td>
                <td>{{ c.typeLabel }}<div *ngIf="c.mention" class="small text-muted">Mention {{ c.mention }}</div></td>
                <td>{{ c.studentName }}<div class="small text-muted">{{ c.matricule }} · {{ c.level }} · {{ c.academicYear }}</div></td>
                <td class="small">{{ c.issuedAt | date:'dd/MM/yyyy' }}</td>
                <td><span class="status-badge" [ngClass]="c.revoked ? 'danger' : 'ok'">{{ c.revoked ? 'Annulée' : 'Valide' }}</span></td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-light me-1" (click)="school.openPdf('/api/admin/scolarite/certificates/' + c.id + '/pdf', c.reference)"><i class="bi bi-file-earmark-pdf"></i></button>
                  <button class="btn btn-sm btn-light" (click)="openFile(c.enrollmentId, 'attestations')" title="Dossier de l'étudiant"><i class="bi bi-folder2-open"></i></button>
                </td>
              </tr>
              <tr *ngIf="filteredCertificates.length === 0"><td colspan="6" class="text-center text-muted py-4">Aucun document délivré.</td></tr>
            </tbody>
          </table>
        </div>
        <app-pagination [pager]="certificatesPg" [total]="filteredCertificates.length"></app-pagination></div>
      </ng-container>

      <!-- ── Annonces ── -->
      <ng-container *ngIf="tab === 'announcements'">
        <div class="card" style="max-width:720px"><div class="card-body">
          <h6 class="fw-bold">Envoyer une annonce aux étudiants inscrits ({{ year }})</h6>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label small" for="anLevel">Destinataires</label>
              <select id="anLevel" class="form-select" [(ngModel)]="announcement.level">
                <option value="">Tous les niveaux</option><option *ngFor="let l of levels" [value]="l">{{ l }}</option></select>
            </div>
            <div class="col-md-6">
              <label class="form-label small" for="anTarget">Filtre</label>
              <select id="anTarget" class="form-select" [(ngModel)]="announcement.target">
                <option value="ALL">Tous les inscrits</option><option value="UNPAID">Seulement ceux qui n'ont pas soldé</option></select>
            </div>
            <div class="col-12">
              <label class="form-label small" for="anTitle">Titre</label>
              <input id="anTitle" class="form-control" maxlength="200" [(ngModel)]="announcement.title" placeholder="Ex. Calendrier des examens du semestre 1">
            </div>
            <div class="col-12">
              <label class="form-label small" for="anMsg">Message</label>
              <textarea id="anMsg" class="form-control" rows="5" maxlength="1000" [(ngModel)]="announcement.message"></textarea>
            </div>
            <div class="col-12 form-check ms-2">
              <input id="anEmail" type="checkbox" class="form-check-input" [(ngModel)]="announcement.email">
              <label class="form-check-label" for="anEmail">Envoyer aussi par email</label>
            </div>
          </div>
          <div class="text-end mt-3">
            <button class="btn btn-primary" [disabled]="busy || !announcement.title.trim() || !announcement.message.trim()" (click)="sendAnnouncement()">
              <i class="bi bi-send me-1"></i>Envoyer</button>
          </div>
        </div></div>
      </ng-container>
    </div>
  `
})
export class AdminScolariteComponent implements OnInit {
  /** Pagination des listes. */
  enrollmentsPg = new Pager(20);
  sheetPg = new Pager(50);
  certificatesPg = new Pager(20);
  tab: Tab = 'dashboard';
  year = '';
  years: string[] = [];
  busy = false;

  stats: SchoolStats | null = null;
  enrollments: Enrollment[] = [];
  certificates: Certificate[] = [];

  search = '';
  levelFilter = '';
  statusFilter = '';
  certSearch = '';

  sheet = { level: 'L1', semester: 'S1', session: 'NORMALE', subject: '' };
  subjects: string[] = [];
  sheetRows: SheetRow[] | null = null;
  sheetCoefficient = 1;
  sheetTitle = '';

  announcement = { level: '', target: 'ALL', title: '', message: '', email: true };

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Tableau de bord', icon: 'bi-speedometer2' },
    { key: 'enrollments', label: 'Inscriptions', icon: 'bi-person-vcard' },
    { key: 'grades', label: 'Notes', icon: 'bi-journal-text' },
    { key: 'certificates', label: 'Attestations', icon: 'bi-qr-code' },
    { key: 'announcements', label: 'Annonces', icon: 'bi-megaphone' }
  ];
  readonly levels = LEVELS;
  readonly enrollmentStatus = ENROLLMENT_STATUS;
  readonly enrollmentStatuses = Object.entries(ENROLLMENT_STATUS);
  readonly fcfa = fcfa;

  constructor(public school: SchoolService, private dialogs: DialogService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    // Onglet demandé par l'adresse (ex. lien d'une notification), y compris quand la page est déjà ouverte
    this.route.queryParamMap.subscribe(q => {
      const tab = q.get('tab') as Tab | null;
      if (tab && tab !== this.tab && this.tabs.some(t => t.key === tab)) {
        this.tab = tab;
        if (this.year) this.loadTab();
      }
    });
    this.school.options().subscribe(o => {
      const start = parseInt(o.currentYear.substring(0, 4), 10);
      this.years = [start + 1, start, start - 1, start - 2].map(y => `${y}-${y + 1}`);
      this.year = o.currentYear;
      this.reload();
    });
  }

  setTab(tab: Tab) {
    this.tab = tab;
    this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
    this.loadTab();
  }

  reload() {
    this.sheetRows = null;
    this.loadTab();
  }

  loadTab() {
    switch (this.tab) {
      case 'dashboard': this.stats = null; this.school.stats(this.year).subscribe(s => this.stats = s); break;
      case 'enrollments': this.school.enrollments(this.year).subscribe(e => this.enrollments = e); break;
      case 'grades': this.loadSubjects(); break;
      case 'certificates': this.school.certificates().subscribe(c => this.certificates = c); break;
    }
  }

  // ── Inscriptions ──
  get filteredEnrollments(): Enrollment[] {
    const q = this.search.trim().toLowerCase();
    return this.enrollments.filter(e =>
      (!q || `${e.studentName} ${e.matricule} ${e.email}`.toLowerCase().includes(q))
      && (!this.levelFilter || e.level === this.levelFilter)
      && (!this.statusFilter || e.status === this.statusFilter
          || (this.statusFilter === 'UNPAID' && e.balance > 0) || (this.statusFilter === 'OVERDUE' && e.overdue > 0)));
  }

  openEnroll() {
    this.dialogs.open<boolean>(EnrollmentDialogComponent, { title: 'Inscription', icon: 'bi-person-plus', size: 'lg', data: { year: this.year } })
      .afterClosed.then(changed => { if (changed) this.loadTab(); });
  }

  openFile(id: number, tab?: string) {
    this.dialogs.open(EnrollmentFileDialogComponent, { title: 'Dossier de scolarité', icon: 'bi-folder2-open', size: 'xl', data: { id, tab } })
      .afterClosed.then(() => this.loadTab());
  }

  // ── Notes ──
  loadSubjects() {
    if (!this.year) return;
    this.school.subjects(this.year, this.sheet.level).subscribe(s => this.subjects = s);
  }

  loadSheet() {
    const p = { year: this.year, ...this.sheet, subject: this.sheet.subject.trim() };
    this.school.gradeSheet(p).subscribe({
      next: r => {
        this.sheetRows = r.rows;
        this.sheetCoefficient = r.coefficient ?? 1;
        this.sheetTitle = `${p.subject} — ${p.level}, ${p.semester}, session ${p.session === 'NORMALE' ? 'normale' : 'de rattrapage'}`;
      },
      error: err => this.dialogs.toast(apiError(err), 'danger', 6000)
    });
  }

  saveSheet() {
    if (!this.sheetRows) return;
    const invalid = this.sheetRows.find(r => r.grade !== null && (r.grade as any) !== '' && (r.grade < 0 || r.grade > 20));
    if (invalid) { this.dialogs.toast(`Note invalide pour ${invalid.studentName} (0 à 20).`, 'danger'); return; }
    this.busy = true;
    this.school.saveGradeSheet({
      academicYear: this.year, ...this.sheet, subject: this.sheet.subject.trim(), coefficient: this.sheetCoefficient,
      entries: this.sheetRows.map(r => ({ enrollmentId: r.enrollmentId, grade: r.grade === null || (r.grade as any) === '' ? null : r.grade, comment: r.comment }))
    }).subscribe({
      next: r => { this.busy = false; this.dialogs.toast(`${r.saved} note(s) enregistrée(s).`); this.loadSheet(); this.loadSubjects(); },
      error: err => { this.busy = false; this.dialogs.toast(apiError(err), 'danger', 6000); }
    });
  }

  async publish() {
    const ok = await this.dialogs.confirm({ title: `Publier les notes du ${this.sheet.semester} ?`,
      message: `Toutes les notes en brouillon du ${this.sheet.semester} des ${this.sheet.level} (${this.year}) deviendront visibles par les étudiants, qui seront prévenus.`,
      icon: 'bi-megaphone', confirmText: 'Publier' });
    if (!ok) return;
    this.busy = true;
    this.school.publishGrades(this.year, this.sheet.level, this.sheet.semester).subscribe({
      next: r => { this.busy = false; this.dialogs.toast(r.published ? `${r.published} note(s) publiée(s).` : 'Aucune note en brouillon à publier.', r.published ? 'success' : 'info');
                   if (this.sheetRows) this.loadSheet(); },
      error: err => { this.busy = false; this.dialogs.toast(apiError(err), 'danger', 6000); }
    });
  }

  // ── Attestations ──
  get filteredCertificates(): Certificate[] {
    const q = this.certSearch.trim().toLowerCase();
    return this.certificates.filter(c => !q || `${c.studentName} ${c.matricule} ${c.reference}`.toLowerCase().includes(q));
  }

  // ── Relances et annonces ──
  remind() {
    this.busy = true;
    this.school.sendReminders(this.year).subscribe({
      next: r => { this.busy = false; this.dialogs.toast(r.sent ? `${r.sent} étudiant(s) relancé(s).` : 'Aucun étudiant en retard de paiement.', r.sent ? 'success' : 'info'); },
      error: err => { this.busy = false; this.dialogs.toast(apiError(err), 'danger'); }
    });
  }

  sendAnnouncement() {
    this.busy = true;
    this.school.broadcast({ ...this.announcement, academicYear: this.year }).subscribe({
      next: r => { this.busy = false; this.dialogs.toast(`Annonce envoyée à ${r.sent} étudiant(s).`); this.announcement = { ...this.announcement, title: '', message: '' }; },
      error: err => { this.busy = false; this.dialogs.toast(apiError(err), 'danger'); }
    });
  }

  // ── Libellés ──
  spec(s: string | null) { return s ? SPECIALIZATIONS[s] ?? s : 'Sans filière'; }
  methodLabel(m: string) { return METHOD_LABELS[m] ?? m; }
  methodEntries(m: Record<string, number>) { return Object.entries(m); }
}
