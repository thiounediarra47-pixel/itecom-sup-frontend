import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SPECIALIZATIONS, SchoolService, fcfa } from '../../core/services/school.service';

/** Page publique ouverte par le QR code d'une attestation ou d'un reçu : authentique, annulé ou inconnu. */
@Component({
  selector: 'app-verification',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center p-3" style="background:var(--page-bg)">
      <div class="card w-100" style="max-width:560px;border-radius:16px">
        <div class="card-body p-4">
          <div class="d-flex align-items-center gap-2 mb-4">
            <span class="sidebar-logo-mark"><i class="bi bi-mortarboard-fill"></i></span>
            <div><div class="fw-bold">ITECOM</div><div class="small text-muted">Vérification de document</div></div>
          </div>

          <div *ngIf="loading" class="text-center py-4"><div class="spinner-border text-primary"></div></div>

          <ng-container *ngIf="!loading && result">
            <div class="text-center mb-4">
              <i class="bi" style="font-size:3.5rem" [ngClass]="result.valid ? 'bi-patch-check-fill text-success' : result.found ? 'bi-x-octagon-fill text-danger' : 'bi-question-circle-fill text-warning'"></i>
              <h4 class="fw-bold mt-2 mb-1">{{ result.valid ? 'Document authentique' : result.found ? 'Document annulé' : 'Document introuvable' }}</h4>
              <p class="text-muted mb-0" *ngIf="result.valid">Ce document a bien été délivré par ITECOM et est toujours valide.</p>
              <p class="text-muted mb-0" *ngIf="result.found && !result.valid">Ce document a été délivré par ITECOM mais n'est plus valide{{ result.revokedAt ? ' depuis le ' + (result.revokedAt | date:'dd/MM/yyyy') : '' }}.</p>
              <p class="text-muted mb-0" *ngIf="!result.found">Aucun document ne correspond au code « {{ code }} ». Il peut s'agir d'un faux : contactez la scolarité.</p>
            </div>

            <table *ngIf="result.found" class="table table-sm mb-0">
              <tbody>
                <tr><th class="text-muted fw-normal">Document</th><td class="fw-semibold">{{ result.documentLabel }}</td></tr>
                <tr><th class="text-muted fw-normal">Référence</th><td>{{ result.reference }}</td></tr>
                <tr><th class="text-muted fw-normal">Délivré le</th><td>{{ result.issuedAt | date:'dd/MM/yyyy' }}</td></tr>
                <tr><th class="text-muted fw-normal">Étudiant</th><td class="fw-semibold">{{ result.studentName }}</td></tr>
                <tr *ngIf="result.birthDate"><th class="text-muted fw-normal">Né(e) le</th><td>{{ result.birthDate | date:'dd/MM/yyyy' }}</td></tr>
                <tr><th class="text-muted fw-normal">Matricule</th><td>{{ result.matricule }}</td></tr>
                <tr><th class="text-muted fw-normal">Niveau</th><td>{{ result.level }}{{ result.specialization ? ' · ' + spec(result.specialization) : '' }} · {{ result.academicYear }}</td></tr>
                <tr *ngIf="result.average != null"><th class="text-muted fw-normal">Moyenne</th><td>{{ result.average | number:'1.2-2' }}/20{{ result.mention ? ' · mention ' + result.mention : '' }}</td></tr>
                <tr *ngIf="result.amount != null"><th class="text-muted fw-normal">Montant</th><td>{{ fcfa(result.amount) }} · {{ result.method }}</td></tr>
              </tbody>
            </table>
          </ng-container>

          <form class="d-flex gap-2 mt-4" (ngSubmit)="check()">
            <input class="form-control" name="code" [(ngModel)]="input" placeholder="Code de vérification" aria-label="Code de vérification">
            <button class="btn btn-primary" type="submit" [disabled]="!input.trim()">Vérifier</button>
          </form>
          <div class="text-center mt-3"><a routerLink="/dashboard" class="small">Aller sur la plateforme</a></div>
        </div>
      </div>
    </div>
  `
})
export class VerificationComponent implements OnInit {
  code = '';
  input = '';
  result: any = null;
  loading = false;
  readonly fcfa = fcfa;

  constructor(private route: ActivatedRoute, private router: Router, private school: SchoolService) {}

  ngOnInit() {
    this.route.paramMap.subscribe(p => {
      this.code = (p.get('code') || '').toUpperCase();
      this.input = this.code;
      if (this.code) this.load();
    });
  }

  load() {
    this.loading = true;
    this.school.verify(this.code).subscribe({
      next: r => { this.result = r; this.loading = false; },
      error: () => { this.result = { found: false, valid: false }; this.loading = false; }
    });
  }

  check() {
    this.router.navigate(['/verification', this.input.trim().toUpperCase()]);
  }

  spec(s: string) { return SPECIALIZATIONS[s] ?? s; }
}
