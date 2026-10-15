import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleItem, SCHEDULE_STATUS, Transcript, fcfa } from '../../core/services/school.service';

/** Échéancier : frais d'inscription puis mensualités, avec l'état de chaque échéance. */
@Component({
  selector: 'app-school-schedule',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-responsive">
      <table class="table table-sm align-middle mb-0 table-stack">
        <thead class="table-light"><tr><th>Échéance</th><th>Date limite</th><th class="text-end">Montant</th><th class="text-end">Réglé</th><th class="text-end">État</th></tr></thead>
        <tbody>
          <tr *ngFor="let i of items">
            <td class="fw-semibold">{{ i.label }}</td>
            <td data-label="Date limite">{{ i.dueDate | date:'dd/MM/yyyy' }}</td>
            <td data-label="Montant" class="text-end amount">{{ fcfa(i.amount) }}</td>
            <td data-label="Réglé" class="text-end amount">{{ fcfa(i.paid) }}</td>
            <td data-label="État" class="text-end"><span class="status-badge" [ngClass]="status[i.status].tone">{{ status[i.status].label }}</span></td>
          </tr>
          <tr *ngIf="items.length === 0"><td colspan="5" class="text-muted text-center py-3">Aucun frais à régler.</td></tr>
        </tbody>
      </table>
    </div>
  `
})
export class SchoolScheduleComponent {
  @Input() items: ScheduleItem[] = [];
  readonly status = SCHEDULE_STATUS;
  readonly fcfa = fcfa;
}

/** Bulletin : notes par semestre (meilleure des deux sessions), moyennes, décision et mention. */
@Component({
  selector: 'app-school-transcript',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="!transcript || transcript.semesters.length === 0" class="text-center text-muted py-4">
      <i class="bi bi-journal-x" style="font-size:2rem"></i>
      <p class="mb-0 mt-2">{{ emptyText }}</p>
    </div>
    <ng-container *ngIf="transcript && transcript.semesters.length > 0">
      <div *ngFor="let s of transcript.semesters" class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="fw-bold mb-0">Semestre {{ s.semester.substring(1) }}</h6>
          <span class="fw-semibold">Moyenne : {{ s.average !== null ? (s.average | number:'1.2-2') + '/20' : '—' }}</span>
        </div>
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead class="table-light"><tr><th>Matière</th><th class="text-center">Coef.</th><th class="text-center">Normale</th><th class="text-center">Rattrapage</th><th class="text-center">Note retenue</th><th *ngIf="showPublished" class="text-end">Publication</th></tr></thead>
            <tbody>
              <tr *ngFor="let l of s.lines">
                <td>{{ l.subject }}<div *ngIf="l.comment" class="small text-muted">{{ l.comment }}</div></td>
                <td class="text-center">{{ l.coefficient }}</td>
                <td class="text-center">{{ l.normale ?? '—' }}</td>
                <td class="text-center">{{ l.rattrapage ?? '—' }}</td>
                <td class="text-center fw-semibold" [class.text-danger]="l.effective < 10">{{ l.effective | number:'1.0-2' }}/20</td>
                <td *ngIf="showPublished" class="text-end"><span class="status-badge" [ngClass]="l.published ? 'ok' : 'muted'">{{ l.published ? 'Publiée' : 'Brouillon' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div *ngIf="transcript.annualAverage !== null" class="d-flex flex-wrap gap-3 align-items-center p-3 rounded-3" style="background:var(--surface-muted)">
        <span class="fw-bold">Moyenne générale : {{ transcript.annualAverage | number:'1.2-2' }}/20</span>
        <span class="status-badge" [ngClass]="transcript.annualAverage >= 10 ? 'ok' : 'danger'">{{ transcript.decision }}</span>
        <span *ngIf="transcript.mention" class="text-muted">Mention {{ transcript.mention }}</span>
      </div>
    </ng-container>
  `
})
export class SchoolTranscriptComponent {
  @Input() transcript: Transcript | null = null;
  @Input() showPublished = false;
  @Input() emptyText = 'Aucune note pour le moment.';
}
