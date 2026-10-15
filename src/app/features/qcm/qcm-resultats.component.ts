import { Component, HostListener, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, PagerMap } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { FileViewerComponent } from '../../shared/components/file-viewer.component';
import { DialogService } from '../../core/services/dialog.service';

interface ReponseDetail { questionText: string; points: number; choiceSelected: string; isCorrect: boolean; correctChoice: string; questionType?: string; textAnswer?: string; }
/** Correction d'une question « cas pratique » (les copies corrigées avant ce format n'ont que earned / total). */
interface CorrectionDetail { questionId: number; questionText?: string; points?: number; score?: number; source?: 'IA' | 'chiffres' | 'manuelle';
  comment?: string | null; numbersFound?: number; numbersTotal?: number; numbersMissing?: string[]; earned?: number; total?: number; }
interface PaperPage { url: string; filename?: string | null; }
interface PassageResult  { passageId?: number; studentName: string; studentEmail: string; studentLevel?: string; lastName?: string; firstName?: string; birthDate?: string; score?: number; maxScore?: number; manualScore?: number; manualCorrectionNote?: string; ocrScore?: number; ocrCorrectionNote?: string; percentage?: string; submittedAt?: string; status: string; paperCorrectionUrl?: string; paperCorrectionFilename?: string; documentAnswer?: string; correctionText?: string; correctionDetail?: CorrectionDetail[] | null; ocrExtractedText?: string | null; paperPages?: PaperPage[] | null; reponses: ReponseDetail[]; }

@Component({
  selector: 'app-qcm-resultats',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, RouterLink, FormsModule],
  template: `
    <div class="fade-in-up">
      <div class="d-flex align-items-center justify-content-between gap-3 mb-4 flex-wrap">
        <div class="d-flex align-items-center gap-3">
          <a routerLink="/teacher/qcms" class="btn btn-outline-secondary btn-sm" aria-label="Retour"><i class="bi bi-arrow-left"></i></a>
          <div>
            <h1 class="fw-bold mb-0">Étudiants et notes</h1>
            <p class="text-muted mb-0">{{ results.length }} étudiant(s) · {{ submittedCount }} copie(s) rendue(s)</p>
          </div>
        </div>
        <button (click)="downloadReport()" class="btn btn-success btn-sm" [disabled]="downloading">
          <span *ngIf="downloading" class="spinner-border spinner-border-sm me-1"></span>
          <i *ngIf="!downloading" class="bi bi-file-earmark-excel me-1"></i>
          Télécharger les notes (Excel)
        </button>
      </div>

      <!-- Indicateurs -->
      <div class="row g-3 mb-4" *ngIf="!loading && results.length">
        <div class="col-6 col-md-3"><div class="stat"><div class="stat-value">{{ results.length }}</div><div class="stat-label">Étudiants</div></div></div>
        <div class="col-6 col-md-3"><div class="stat"><div class="stat-value">{{ submittedCount }}</div><div class="stat-label">Copies rendues</div></div></div>
        <div class="col-6 col-md-3"><div class="stat"><div class="stat-value">{{ averageLabel }}</div><div class="stat-label">Moyenne</div></div></div>
        <div class="col-6 col-md-3"><div class="stat"><div class="stat-value">{{ results.length - submittedCount }}</div><div class="stat-label">Non rendues</div></div></div>
      </div>

      <div *ngIf="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>

      <div *ngIf="!loading && results.length === 0" class="text-center py-5">
        <div style="font-size:4rem"><i class="bi bi-inbox"></i></div>
        <h5 class="mt-3 fw-bold">Aucun étudiant</h5>
        <p class="text-muted">Aucun étudiant n'est inscrit à ce devoir et personne ne l'a encore passé.</p>
      </div>

      <div *ngIf="!loading && results.length">
        <!-- Recherche et filtres -->
        <div class="card mb-3" style="border-radius:14px">
          <div class="card-body p-3">
            <div class="d-flex gap-2 flex-wrap align-items-center">
              <div class="input-group input-group-sm" style="max-width:340px">
                <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                <input type="search" class="form-control" [(ngModel)]="search" placeholder="Rechercher un étudiant (nom, email…)" aria-label="Rechercher un étudiant">
              </div>
              <select class="form-select form-select-sm" style="max-width:200px" [(ngModel)]="statusFilter" aria-label="Filtrer par statut">
                <option value="">Tous les statuts</option>
                <option value="SOUMIS">Rendu</option>
                <option value="EN_COURS">En cours</option>
                <option value="NON_COMMENCE">Non commencé</option>
              </select>
            </div>
            <div class="d-flex flex-wrap gap-2 mt-3" role="group" aria-label="Filtrer par niveau">
              <button type="button" class="chip" [class.active]="!levelFilter" (click)="levelFilter = ''">Tous les niveaux</button>
              <button type="button" *ngFor="let g of allLevelGroups" class="chip" [class.active]="levelFilter === g.key" (click)="levelFilter = g.key">
                {{ g.label }} <span class="chip-count">{{ g.rows.length }}</span>
              </button>
            </div>
          </div>
        </div>

        <div *ngIf="visibleLevelGroups.length === 0" class="text-center text-muted py-5">Aucun étudiant ne correspond à la recherche.</div>

        <!-- Un groupe par niveau -->
        <div *ngFor="let g of visibleLevelGroups" class="card mb-3 group-card">
          <button type="button" class="group-head" (click)="collapsed[g.key] = !collapsed[g.key]" [attr.aria-expanded]="!collapsed[g.key]">
            <i class="bi" [ngClass]="collapsed[g.key] ? 'bi-chevron-right' : 'bi-chevron-down'"></i>
            <span class="group-title">{{ g.label }}</span>
            <span class="group-meta">
              {{ g.rows.length }} étudiant{{ g.rows.length > 1 ? 's' : '' }} · {{ submittedIn(g.rows) }} copie{{ submittedIn(g.rows) > 1 ? 's' : '' }} rendue{{ submittedIn(g.rows) > 1 ? 's' : '' }} · moyenne {{ averageOf(g.rows) }}
            </span>
          </button>
          <div *ngIf="!collapsed[g.key]" class="table-responsive">
            <table class="table table-hover align-middle mb-0 results-table">
              <thead>
                <tr>
                  <th style="width:48px">#</th>
                  <th style="width:16%">Nom</th>
                  <th style="width:16%">Prénom</th>
                  <th style="width:13%">Naissance</th>
                  <th>Email</th>
                  <th style="width:12%">Statut</th>
                  <th class="text-end" style="width:11%">Note</th>
                  <th class="text-end" style="width:150px">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of g.rows | paginate: rowPages.get(g.key).page : rowPages.get(g.key).size; let i = index">
                  <td class="text-muted">{{ (rowPages.get(g.key).current(g.rows.length) - 1) * rowPages.get(g.key).size + i + 1 }}</td>
                  <td class="fw-semibold">{{ r.lastName || lastNameOf(r) }}</td>
                  <td>{{ r.firstName || firstNameOf(r) }}</td>
                  <td>{{ r.birthDate ? (r.birthDate | date:'dd/MM/yyyy') : '—' }}</td>
                  <td class="text-muted small">{{ r.studentEmail }}</td>
                  <td><span class="status-badge" [ngClass]="statusClass(r.status)">{{ statusLabel(r.status) }}</span></td>
                  <td class="text-end">
                    <ng-container *ngIf="r.status === 'SOUMIS'; else noGrade">
                      <div class="fw-bold">{{ r.score ?? '—' }} / {{ r.maxScore ?? '—' }}</div>
                      <div class="small text-muted">{{ r.percentage }}<span *ngIf="r.manualScore != null" title="Note modifiée par le professeur"> · <i class="bi bi-pencil-fill"></i></span></div>
                    </ng-container>
                    <ng-template #noGrade><span class="text-muted">—</span></ng-template>
                  </td>
                  <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-light action-btn" (click)="openDetail(r)" title="Voir le détail" aria-label="Voir le détail">
                      <i class="bi bi-eye"></i>
                    </button>
                    <button *ngIf="pagesOf(r).length" class="btn btn-sm btn-light action-btn ms-1" (click)="openDetail(r)"
                            [title]="'Voir la copie envoyée (' + pagesOf(r).length + ' page(s))'" aria-label="Voir la copie envoyée">
                      <i class="bi bi-paperclip"></i>
                    </button>
                    <button class="btn btn-sm btn-light action-btn ms-1" (click)="openEdit(r)"
                            [disabled]="r.status !== 'SOUMIS' || !r.passageId"
                            [title]="r.status === 'SOUMIS' ? 'Modifier la note' : 'Disponible une fois la copie rendue'"
                            aria-label="Modifier la note">
                      <i class="bi bi-pencil-square"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <app-pagination [pager]="rowPages.get(g.key)" [total]="g.rows.length"></app-pagination>
        </div>
      </div>

      <!-- Détail d'une copie -->
      <div *ngIf="detail" class="modal-backdrop-custom" (click)="detail = null">
        <div class="modal-panel modal-lg-panel" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
          <div class="modal-head">
            <div>
              <h5 id="detailTitle" class="fw-bold mb-0">{{ detail.lastName || lastNameOf(detail) }} {{ detail.firstName || firstNameOf(detail) }}</h5>
              <div class="small text-muted">{{ detail.studentEmail }}</div>
            </div>
            <button type="button" class="btn-close" (click)="detail = null" aria-label="Fermer"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3 mb-3">
              <div class="col-6 col-md-3"><div class="info-cell"><span>Date de naissance</span>{{ detail.birthDate ? (detail.birthDate | date:'dd/MM/yyyy') : '—' }}</div></div>
              <div class="col-6 col-md-3"><div class="info-cell"><span>Niveau</span>{{ detail.studentLevel || '—' }}</div></div>
              <div class="col-6 col-md-3"><div class="info-cell"><span>Statut</span>{{ statusLabel(detail.status) }}</div></div>
              <div class="col-6 col-md-3"><div class="info-cell"><span>Rendu le</span>{{ detail.submittedAt ? (detail.submittedAt | date:'dd/MM/yyyy HH:mm') : '—' }}</div></div>
            </div>

            <div *ngIf="detail.status === 'SOUMIS'" class="grade-banner mb-3" [style.borderColor]="getColor(detail.score, detail.maxScore)">
              <div>
                <div class="small text-muted">Note</div>
                <div class="fs-4 fw-bold" [style.color]="getColor(detail.score, detail.maxScore)">{{ detail.score ?? '—' }} / {{ detail.maxScore ?? '—' }}</div>
                <div class="small">{{ detail.percentage }} · {{ getMention(detail.score, detail.maxScore) }}</div>
              </div>
              <div class="text-end small">
                <div *ngIf="detail.manualScore != null"><i class="bi bi-pencil-fill me-1"></i>Note modifiée par le professeur</div>
                <div *ngIf="detail.manualCorrectionNote" class="text-muted">« {{ detail.manualCorrectionNote }} »</div>
                <button class="btn btn-sm btn-outline-primary mt-2" (click)="openEdit(detail)" [disabled]="!detail.passageId">
                  <i class="bi bi-pencil-square me-1"></i>Modifier la note
                </button>
              </div>
            </div>

            <div *ngIf="detail.status === 'EN_COURS'" class="alert alert-warning">
              <i class="bi bi-hourglass-split me-1"></i>Devoir commencé, copie pas encore rendue. Les réponses sont enregistrées
              au fil de l'eau : la copie est soumise et notée automatiquement à la fin du temps imparti.
            </div>
            <div *ngIf="detail.status === 'NON_COMMENCE'" class="alert alert-light border">L'étudiant n'a pas encore commencé ce devoir.</div>

            <div *ngIf="pagesOf(detail).length" class="copy-box mb-3">
              <div class="d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-file-earmark-image me-1"></i>Copie envoyée par l'étudiant
                  <span class="fw-normal text-muted small ms-1">{{ pagesOf(detail).length }} page(s)</span>
                </h6>
              </div>
              <div class="row g-3">
                <div [class]="detail.ocrExtractedText ? 'col-md-7' : 'col-12'">
                  <div *ngFor="let page of pagesOf(detail); let i = index" class="copy-page">
                    <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
                      <span class="small fw-semibold text-truncate">Page {{ i + 1 }} <span class="fw-normal text-muted">· {{ page.filename }}</span></span>
                      <span class="d-flex gap-1 flex-shrink-0">
                        <button type="button" class="btn btn-sm btn-light action-btn" (click)="viewFile(page.url, page.filename, 'Page ' + (i + 1) + ' de la copie')"
                                title="Agrandir" aria-label="Agrandir la page"><i class="bi bi-arrows-fullscreen"></i></button>
                        <a class="btn btn-sm btn-light action-btn" [href]="page.url" [attr.download]="page.filename || ''"
                           title="Télécharger" aria-label="Télécharger la page"><i class="bi bi-download"></i></a>
                      </span>
                    </div>
                    <button *ngIf="fileKind(page.url) === 'image'" type="button" class="copy-preview"
                            (click)="viewFile(page.url, page.filename, 'Page ' + (i + 1) + ' de la copie')" title="Agrandir la page">
                      <img [src]="page.url" [alt]="'Page ' + (i + 1) + ' de la copie'" loading="lazy">
                    </button>
                    <iframe *ngIf="fileKind(page.url) === 'pdf'" class="copy-pdf" [src]="safeUrl(page.url)"
                            [title]="page.filename || 'Copie de l’étudiant'"></iframe>
                    <div *ngIf="fileKind(page.url) === 'other'" class="text-muted small py-3">
                      <i class="bi bi-file-earmark me-1"></i>Aperçu indisponible pour ce type de fichier : téléchargez-le.
                    </div>
                  </div>
                </div>
                <div *ngIf="detail.ocrExtractedText" class="col-md-5">
                  <div class="fw-semibold small mb-1"><i class="bi bi-eye me-1"></i>Texte lu sur la copie (OCR)</div>
                  <pre class="answer-pre ocr-pre">{{ detail.ocrExtractedText }}</pre>
                </div>
              </div>
              <div *ngIf="!detail.ocrExtractedText && detail.status === 'SOUMIS'" class="small text-warning mt-2">
                <i class="bi bi-exclamation-triangle me-1"></i>La copie n'a pas pu être lue automatiquement : vérifiez-la et ajustez la note si besoin.
              </div>
            </div>

            <div *ngIf="detail.correctionDetail?.length" class="mb-3">
              <h6 class="fw-bold mb-2"><i class="bi bi-clipboard-check me-1"></i>Correction du cas pratique</h6>
              <div *ngIf="summaryOf(detail.ocrCorrectionNote) as summary" class="small text-muted mb-2" style="white-space:pre-wrap">{{ summary }}</div>
              <div *ngFor="let c of detail.correctionDetail" class="case-grade">
                <div class="d-flex justify-content-between align-items-start gap-2">
                  <div class="small fw-semibold question-preview">{{ c.questionText || 'Cas pratique' }}</div>
                  <div class="text-nowrap text-end">
                    <span class="fw-bold">{{ c.score ?? c.earned ?? '—' }} / {{ c.points ?? c.total ?? '—' }}</span>
                    <span class="source-badge ms-1" [ngClass]="'source-' + (c.source || 'IA')">{{ sourceLabel(c) }}</span>
                  </div>
                </div>
                <div *ngIf="c.comment" class="small mt-1" style="white-space:pre-wrap">{{ c.comment }}</div>
                <div *ngIf="c.numbersTotal" class="small text-muted mt-1">
                  <i class="bi bi-123 me-1"></i>Chiffres du corrigé retrouvés : {{ c.numbersFound }}/{{ c.numbersTotal }}
                  <span *ngIf="c.numbersMissing?.length"> · absents ou différents : {{ c.numbersMissing!.join(', ') }}</span>
                </div>
              </div>
            </div>

            <div *ngIf="detail.ocrCorrectionNote && !detail.correctionDetail?.length" class="section-box mb-3" style="background:var(--surface-muted)">
              <div class="fw-semibold small mb-1"><i class="bi bi-calculator me-1"></i>Correction automatique</div>
              <div class="small" style="white-space:pre-wrap">{{ detail.ocrCorrectionNote }}</div>
            </div>

            <div *ngIf="detail.documentAnswer" class="mb-3">
              <h6 class="fw-bold">Réponse rédigée</h6>
              <pre class="answer-pre">{{ detail.documentAnswer }}</pre>
            </div>

            <div *ngFor="let rep of detail.reponses" class="answer-row">
              <div class="answer-icon" [class.ok]="rep.isCorrect"><i class="bi" [ngClass]="rep.isCorrect ? 'bi-check-lg' : 'bi-x-lg'"></i></div>
              <div class="flex-grow-1 min-w-0">
                <div class="fw-semibold small mb-1 question-preview">{{ rep.questionText }}
                  <span class="text-muted">({{ rep.points }} pt{{ rep.points > 1 ? 's' : '' }})</span>
                </div>
                <div class="small">
                  Réponse : <strong [style.color]="rep.isCorrect ? '#10b981' : '#ef4444'">{{ rep.choiceSelected }}</strong>
                  <span *ngIf="!rep.isCorrect && !rep.textAnswer && rep.correctChoice !== '—'" class="text-muted ms-2">
                    Attendu : <strong class="text-success">{{ rep.correctChoice }}</strong>
                  </span>
                </div>
                <pre *ngIf="rep.textAnswer" class="answer-pre mt-2">{{ rep.textAnswer }}</pre>
              </div>
            </div>

            <details *ngIf="detail.correctionText" class="mt-3">
              <summary class="fw-semibold small">Correction déposée par le professeur</summary>
              <pre class="answer-pre mt-2" style="background:#fff8e1">{{ detail.correctionText }}</pre>
            </details>
          </div>
        </div>
      </div>

      <!-- Modification de la note -->
      <div *ngIf="editing" class="modal-backdrop-custom" (click)="closeEdit()">
        <div class="modal-panel" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="editTitle">
          <div class="modal-head">
            <h5 id="editTitle" class="fw-bold mb-0">Modifier la note</h5>
            <button type="button" class="btn-close" (click)="closeEdit()" aria-label="Fermer"></button>
          </div>
          <div class="p-4">
            <div class="small text-muted mb-3">{{ editing.lastName || lastNameOf(editing) }} {{ editing.firstName || firstNameOf(editing) }} · {{ editing.studentEmail }}</div>
            <label class="form-label fw-semibold" for="editScore">Note (sur {{ editing.maxScore }})</label>
            <input id="editScore" type="number" class="form-control mb-3" min="0" [max]="editing.maxScore ?? null" [(ngModel)]="editScore">
            <label class="form-label fw-semibold" for="editNote">Observation</label>
            <textarea id="editNote" class="form-control" rows="3" [(ngModel)]="editNote" placeholder="Commentaire pour l'étudiant (facultatif)"></textarea>
            <div *ngIf="editError" class="alert alert-danger py-2 small mt-3 mb-0">{{ editError }}</div>
            <div class="d-flex justify-content-end gap-2 mt-4">
              <button class="btn btn-outline-secondary" (click)="closeEdit()">Annuler</button>
              <button class="btn btn-primary fw-semibold" (click)="saveGrade()" [disabled]="saving">
                <span *ngIf="saving" class="spinner-border spinner-border-sm me-2"></span>Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chip { border: 1px solid var(--border); background: var(--surface); color: var(--dark); border-radius: 999px; padding: 4px 12px; font-size: .85rem; font-weight: 500; }
    .chip:hover { border-color: var(--dark); }
    .chip.active { background: var(--dark); border-color: var(--dark); color: #fff; }
    .chip-count { opacity: .65; margin-left: 2px; }
    .group-card { border-radius: 14px; overflow: hidden; }
    .group-head { width: 100%; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 14px 18px; border: 0;
      background: var(--gray-50); border-bottom: 1px solid var(--border); text-align: left; }
    .group-title { font-weight: 700; color: var(--dark); }
    .group-meta { margin-left: auto; color: var(--muted); font-size: .85rem; }
    .results-table { table-layout: fixed; min-width: 900px; }
    .results-table td { overflow: hidden; text-overflow: ellipsis; }
    .stat { background: var(--surface); border-radius: 14px; padding: 16px; border: 1px solid var(--border); text-align: center; }
    .stat-value { font-size: 1.6rem; font-weight: 800; color: var(--dark); }
    .stat-label { font-size: .8rem; color: #64748b; }
    .results-table thead th { font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; color: #64748b; background: var(--surface-muted); white-space: nowrap; }
    .results-table td { white-space: nowrap; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: .75rem; font-weight: 600; }
    .status-badge.done { background: #d1fae5; color: #065f46; }
    .status-badge.progress { background: #fef3c7; color: #92400e; }
    .status-badge.todo { background: #e5e7eb; color: #374151; }
    .action-btn { width: 34px; height: 34px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
    .action-btn:hover:not(:disabled) { background: #eef0fb; color: #2b3ea8; }
    .modal-backdrop-custom { position: fixed; inset: 0; background: rgba(15, 23, 42, .5); z-index: 1060; display: flex; align-items: flex-start; justify-content: center; padding: 5vh 16px; overflow-y: auto; }
    .modal-panel { background: var(--surface); border-radius: 18px; width: 100%; max-width: 480px; box-shadow: 0 30px 60px rgba(15, 23, 42, .3); animation: pop .18s ease-out; }
    .modal-lg-panel { max-width: 860px; }
    .modal-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 18px 24px; border-bottom: 1px solid #e5e7eb; }
    .modal-body-scroll { padding: 20px 24px; max-height: 75vh; overflow-y: auto; }
    .info-cell { background: var(--surface-muted); border-radius: 10px; padding: 10px 12px; font-weight: 600; font-size: .9rem; }
    .info-cell span { display: block; font-size: .72rem; font-weight: 500; color: #64748b; }
    .grade-banner { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 14px; border-left: 5px solid; background: var(--surface-muted); }
    .case-grade { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
    .case-grade + .case-grade { margin-top: 8px; }
    .source-badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: .7rem; font-weight: 600; background: var(--surface-muted); color: var(--muted); }
    .source-badge.source-chiffres, .source-badge.source-manuelle { background: #fef3c7; color: #92400e; }
    .section-box { padding: 12px 14px; border-radius: 12px; }
    .answer-row { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid #f1f5f9; }
    .answer-icon { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: .8rem; background: #fee2e2; color: #991b1b; }
    .answer-icon.ok { background: #d1fae5; color: #065f46; }
    .question-preview { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .answer-pre { white-space: pre-wrap; background: var(--surface-muted); border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: .85rem; max-height: 320px; overflow: auto; margin: 0; }
    .min-w-0 { min-width: 0; }
    .copy-box { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
    .copy-page + .copy-page { margin-top: 12px; }
    .copy-preview { display: block; width: 100%; padding: 0; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-muted); cursor: zoom-in; overflow: hidden; }
    .copy-preview img { display: block; width: 100%; max-height: 420px; object-fit: contain; }
    .copy-pdf { width: 100%; height: 420px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
    .ocr-pre { max-height: 420px; font-size: .8rem; }
    @keyframes pop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  `]
})
export class QcmResultatsComponent implements OnInit {
  /** Pagination des listes. */
  rowPages = new PagerMap(20);
  results: PassageResult[] = [];
  loading = true;
  downloading = false;
  qcmId!: number;
  search = '';
  statusFilter = '';

  detail: PassageResult | null = null;
  editing: PassageResult | null = null;
  editScore: number | null = null;
  editNote = '';
  editError = '';
  saving = false;

  private safeUrls = new Map<string, SafeResourceUrl>();

  constructor(private dialogs: DialogService, private http: HttpClient, private route: ActivatedRoute, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.qcmId = +this.route.snapshot.paramMap.get('id')!;
    this.http.get<PassageResult[]>(`/api/teacher/qcms/${this.qcmId}/resultats`).subscribe({
      next: (d) => { this.results = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  get filteredResults(): PassageResult[] {
    const q = this.search.trim().toLowerCase();
    return this.results.filter(r =>
      (!this.statusFilter || r.status === this.statusFilter) &&
      (!q || [r.lastName, r.firstName, r.studentName, r.studentEmail, r.studentLevel]
        .some(v => (v || '').toLowerCase().includes(q))));
  }

  levelFilter = '';
  collapsed: Record<string, boolean> = {};
  private readonly lmdLevels = ['L1', 'L2', 'L3', 'M1', 'M2'];
  private readonly lmdLabels: Record<string, string> = {
    L1: 'Licence 1 (L1)', L2: 'Licence 2 (L2)', L3: 'Licence 3 (L3)', M1: 'Master 1 (M1)', M2: 'Master 2 (M2)'
  };

  /** Étudiants groupés par niveau : L1 → M2, autres niveaux saisis, puis « Niveau non renseigné ». */
  get allLevelGroups(): { key: string; label: string; rows: PassageResult[] }[] {
    const map = new Map<string, PassageResult[]>();
    for (const r of this.filteredResults) {
      const key = (r.studentLevel || '').trim().toUpperCase().replace(/\s+/g, ' ') || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const rank = (k: string) => k === '__none__' ? 999 : (this.lmdLevels.indexOf(k) >= 0 ? this.lmdLevels.indexOf(k) : 100);
    return [...map.entries()]
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'fr'))
      .map(([key, rows]) => ({
        key,
        label: key === '__none__' ? 'Niveau non renseigné' : (this.lmdLabels[key] || key),
        rows: [...rows].sort((x, y) => ((x.lastName || this.lastNameOf(x)) + ' ' + (x.firstName || ''))
          .localeCompare((y.lastName || this.lastNameOf(y)) + ' ' + (y.firstName || ''), 'fr'))
      }));
  }

  get visibleLevelGroups() {
    return this.allLevelGroups.filter(g => !this.levelFilter || g.key === this.levelFilter);
  }

  submittedIn(rows: PassageResult[]): number {
    return rows.filter(r => r.status === 'SOUMIS').length;
  }

  /** Moyenne sur 20 des copies rendues d'un groupe. */
  averageOf(rows: PassageResult[]): string {
    const graded = rows.filter(r => r.status === 'SOUMIS' && r.score != null && r.maxScore);
    if (!graded.length) return '—';
    const avg = graded.reduce((sum, r) => sum + (r.score! / r.maxScore!) * 20, 0) / graded.length;
    return avg.toFixed(1).replace('.', ',') + ' / 20';
  }

  get submittedCount(): number {
    return this.results.filter(r => r.status === 'SOUMIS').length;
  }

  /** Moyenne ramenée sur 20 des copies rendues. */
  get averageLabel(): string {
    const graded = this.results.filter(r => r.status === 'SOUMIS' && r.score != null && r.maxScore);
    if (!graded.length) return '—';
    const avg = graded.reduce((sum, r) => sum + (r.score! / r.maxScore!) * 20, 0) / graded.length;
    return avg.toFixed(1).replace('.', ',') + ' / 20';
  }

  /** Découpage de secours « Prénom(s) Nom » quand l'étudiant n'a rien saisi. */
  lastNameOf(r: PassageResult): string {
    const parts = (r.studentName || '').trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : (parts[0] || '—');
  }

  firstNameOf(r: PassageResult): string {
    const parts = (r.studentName || '').trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(0, -1).join(' ') : '—';
  }

  statusLabel(status: string): string {
    return status === 'SOUMIS' ? 'Rendu' : status === 'EN_COURS' ? 'En cours' : 'Non commencé';
  }

  statusClass(status: string): string {
    return status === 'SOUMIS' ? 'done' : status === 'EN_COURS' ? 'progress' : 'todo';
  }

  getPct(score?: number, max?: number) { return score != null && max != null && max > 0 ? Math.round((score / max) * 100) : 0; }
  getColor(score?: number, max?: number) {
    const p = this.getPct(score, max);
    return p >= 80 ? '#10b981' : p >= 60 ? '#2b3ea8' : p >= 50 ? '#f59e0b' : '#ef4444';
  }
  getMention(score?: number, max?: number) {
    const p = this.getPct(score, max);
    return p >= 80 ? 'Excellent' : p >= 60 ? 'Bien' : p >= 50 ? 'Passable' : 'Insuffisant';
  }

  openDetail(r: PassageResult) {
    this.detail = r;
  }

  openEdit(r: PassageResult) {
    if (r.status !== 'SOUMIS' || !r.passageId) return;
    this.editing = r;
    this.editScore = r.manualScore ?? r.score ?? 0;
    this.editNote = r.manualCorrectionNote || '';
    this.editError = '';
  }

  closeEdit() {
    this.editing = null;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.editing) this.closeEdit();
    else this.detail = null;
  }

  saveGrade() {
    const r = this.editing;
    if (!r?.passageId || this.saving) return;
    const score = Number(this.editScore);
    if (!Number.isFinite(score) || score < 0 || (r.maxScore != null && score > r.maxScore)) {
      this.editError = `La note doit être comprise entre 0 et ${r.maxScore}.`;
      return;
    }
    this.saving = true;
    this.http.patch<PassageResult>(`/api/teacher/qcms/${this.qcmId}/passages/${r.passageId}/note`, {
      score, note: this.editNote
    }).subscribe({
      next: updated => {
        // L'identité et le niveau affichés restent ceux de la liste
        const { lastName, firstName, birthDate, studentLevel, studentName } = r;
        Object.assign(r, updated, { lastName, firstName, birthDate, studentLevel, studentName });
        this.saving = false;
        this.editing = null;
      },
      error: () => {
        this.saving = false;
        this.editError = 'Impossible d’enregistrer la note.';
      }
    });
  }

  downloadReport() {
    this.downloading = true;
    this.http.get(`/api/teacher/qcms/${this.qcmId}/report`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resultats-qcm-${this.qcmId}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading = false;
      },
      error: () => { this.downloading = false; }
    });
  }

  pagesOf(r: PassageResult): PaperPage[] {
    if (r.paperPages?.length) return r.paperPages;
    return r.paperCorrectionUrl ? [{ url: r.paperCorrectionUrl, filename: r.paperCorrectionFilename }] : [];
  }

  sourceLabel(c: CorrectionDetail): string {
    if (c.source === 'chiffres') return 'Provisoire (chiffres)';
    if (c.source === 'manuelle') return 'À corriger';
    return c.source === 'IA' ? 'IA' : 'Grille';
  }

  /** Synthèse en tête de la note de correction (premier paragraphe). */
  summaryOf(note?: string | null): string {
    return (note || '').split('\n\n')[0].trim();
  }

  fileKind(url?: string | null): 'image' | 'pdf' | 'other' {
    const path = (url || '').split('?')[0].toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp)$/.test(path) ? 'image' : path.endsWith('.pdf') ? 'pdf' : 'other';
  }

  /** URL de la copie PDF pour l'aperçu intégré (mise en cache pour ne pas recharger l'iframe). */
  safeUrl(url: string): SafeResourceUrl {
    let safe = this.safeUrls.get(url);
    if (!safe) {
      safe = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      this.safeUrls.set(url, safe);
    }
    return safe;
  }

  /** Affiche un fichier (copie scannée, sujet…) dans une popup, sans quitter la page. */
  viewFile(url: string | null | undefined, name?: string | null, title = 'Aperçu du fichier') {
    if (!url) return;
    this.dialogs.open(FileViewerComponent, { title, icon: 'bi-file-earmark-richtext', size: 'xl', data: { url, name: name || undefined } });
  }
}
