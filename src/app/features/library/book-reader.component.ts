import {
  Component, OnInit, OnDestroy, HostListener,
  ChangeDetectorRef, ViewChild, ElementRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PdfViewerModule, PdfViewerComponent } from 'ng2-pdf-viewer';
import { BookService } from '../../core/services/book.service';
import { AnnotationService } from '../../core/services/annotation.service';
import { ReferenceService } from '../../core/services/reference.service';
import { Book } from '../../core/models/book.model';
import { Annotation } from '../../core/models/annotation.model';
import { Reference } from '../../core/models/reference.model';

type ReadingMode = 'day' | 'sepia' | 'night';
type SidePanel   = 'none' | 'toc' | 'annotations' | 'bookmarks' | 'search';

@Component({
  selector: 'app-book-reader',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PdfViewerModule],
  template: `
<div class="reader-shell" [attr.data-mode]="readingMode">

  <!-- ── TOP BAR ─────────────────────────────────────────────────────────── -->
  <div class="reader-topbar d-flex align-items-center gap-2 px-3">

    <a routerLink="/library" class="btn btn-sm btn-ghost">
      <i class="bi bi-arrow-left"></i>
    </a>

    <div class="vr mx-1"></div>

    <div class="book-title-bar flex-grow-1 min-w-0" *ngIf="book">
      <span class="fw-semibold text-truncate d-block" style="font-size:.88rem">{{ book.title }}</span>
      <span class="text-muted" style="font-size:.72rem">{{ book.author }}</span>
    </div>

    <!-- Page navigation -->
    <div *ngIf="book?.hasFile" class="d-flex align-items-center gap-1">
      <button class="btn btn-sm btn-ghost" (click)="prevPage()" [disabled]="currentPage <= 1">
        <i class="bi bi-chevron-left"></i>
      </button>
      <div class="page-input-wrap">
        <input type="number" class="page-input" [(ngModel)]="currentPage"
               (change)="onPageInput()" [min]="1" [max]="totalPages">
        <span class="text-muted" style="font-size:.75rem"> / {{ totalPages }}</span>
      </div>
      <button class="btn btn-sm btn-ghost" (click)="nextPage()" [disabled]="currentPage >= totalPages">
        <i class="bi bi-chevron-right"></i>
      </button>
    </div>

    <div class="vr mx-1"></div>

    <!-- Zoom -->
    <div *ngIf="book?.hasFile" class="d-flex align-items-center gap-1">
      <button class="btn btn-sm btn-ghost" (click)="zoomOut()" title="Réduire">
        <i class="bi bi-zoom-out"></i>
      </button>
      <select class="zoom-select" [(ngModel)]="zoom" (change)="applyZoom()">
        <option [value]="0.5">50%</option>
        <option [value]="0.75">75%</option>
        <option [value]="1">100%</option>
        <option [value]="1.25">125%</option>
        <option [value]="1.5">150%</option>
        <option [value]="2">200%</option>
      </select>
      <button class="btn btn-sm btn-ghost" (click)="zoomIn()" title="Agrandir">
        <i class="bi bi-zoom-in"></i>
      </button>
    </div>

    <div class="vr mx-1"></div>

    <!-- Rotation -->
    <div *ngIf="book?.hasFile" class="d-flex gap-1">
      <button class="btn btn-sm btn-ghost" (click)="rotateLeft()" title="Rotation gauche">
        <i class="bi bi-arrow-counterclockwise"></i>
      </button>
      <button class="btn btn-sm btn-ghost" (click)="rotateRight()" title="Rotation droite">
        <i class="bi bi-arrow-clockwise"></i>
      </button>
    </div>

    <div class="vr mx-1"></div>

    <!-- Reading mode -->
    <div class="d-flex gap-1">
      <button class="btn btn-sm btn-ghost mode-btn"
              [class.active]="readingMode==='day'"    (click)="readingMode='day'"    title="Jour"><i class="bi bi-sun"></i></button>
      <button class="btn btn-sm btn-ghost mode-btn"
              [class.active]="readingMode==='sepia'"  (click)="readingMode='sepia'"  title="Sépia"><i class="bi bi-palette"></i></button>
      <button class="btn btn-sm btn-ghost mode-btn"
              [class.active]="readingMode==='night'"  (click)="readingMode='night'"  title="Nuit"><i class="bi bi-moon-stars"></i></button>
    </div>

    <div class="vr mx-1"></div>

    <!-- Panel toggles -->
    <div class="d-flex gap-1">
      <button class="btn btn-sm btn-ghost" [class.active-panel]="sidePanel==='search'"
              (click)="togglePanel('search')" title="Rechercher dans le document">
        <i class="bi bi-search"></i>
      </button>
      <button class="btn btn-sm btn-ghost" [class.active-panel]="sidePanel==='annotations'"
              (click)="togglePanel('annotations')" title="Surlignages & notes">
        <i class="bi bi-highlighter"></i>
        <span *ngIf="annotations.length" class="badge-count">{{ annotations.length }}</span>
      </button>
      <button class="btn btn-sm btn-ghost" [class.active-panel]="sidePanel==='bookmarks'"
              (click)="togglePanel('bookmarks')" title="Marque-pages">
        <i class="bi bi-bookmark"></i>
        <span *ngIf="bookmarks.length" class="badge-count">{{ bookmarks.length }}</span>
      </button>
    </div>

    <div class="vr mx-1"></div>

    <a *ngIf="book?.fileUrl" [href]="book?.fileUrl" download
       class="btn btn-sm btn-ghost" title="Télécharger le PDF">
      <i class="bi bi-download"></i>
    </a>

    <button class="btn btn-sm btn-ghost" (click)="addToReferences()" title="Ajouter aux références Zotero">
      <i class="bi bi-journals"></i>
    </button>
  </div>

  <!-- ── PROGRESS BAR ───────────────────────────────────────────────────── -->
  <div class="reading-progress-bar" *ngIf="totalPages > 0">
    <div class="reading-progress-fill" [style.width.%]="(currentPage / totalPages) * 100"></div>
  </div>

  <!-- ── MAIN AREA ──────────────────────────────────────────────────────── -->
  <div class="reader-main">

    <!-- Side panel -->
    <aside class="side-panel" *ngIf="sidePanel !== 'none'" [@slideIn]>

      <!-- Search panel -->
      <div *ngIf="sidePanel==='search'" class="panel-content">
        <h6 class="panel-title"><i class="bi bi-search me-2"></i>Rechercher</h6>
        <div class="input-group input-group-sm mb-3">
          <input class="form-control" [(ngModel)]="searchQuery"
                 placeholder="Terme à chercher…" (keyup.enter)="searchInPdf()">
          <button class="btn btn-outline-primary btn-sm" (click)="searchInPdf()">
            <i class="bi bi-search"></i>
          </button>
        </div>
        <p class="small text-muted">La recherche met en évidence les occurrences dans le document.</p>
      </div>

      <!-- Annotations panel -->
      <div *ngIf="sidePanel==='annotations'" class="panel-content">
        <h6 class="panel-title"><i class="bi bi-highlighter me-2"></i>Surlignages & Notes</h6>

        <div *ngIf="annotations.length === 0" class="text-center py-4">
          <i class="bi bi-highlighter text-muted" style="font-size:2rem"></i>
          <p class="small text-muted mt-2">Sélectionnez du texte dans le PDF<br>pour ajouter un surlignage.</p>
        </div>

        <div *ngFor="let ann of highlights" class="annotation-card" (click)="goToPage(ann.pageNumber)">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <span class="ann-color-dot" [style.background]="colorMap[ann.color]"></span>
            <span class="small text-muted ms-auto">p. {{ ann.pageNumber }}</span>
            <button class="btn btn-ghost btn-xs ms-1" (click)="deleteAnnotation($event, ann)">
              <i class="bi bi-x"></i>
            </button>
          </div>
          <p class="ann-text">"{{ ann.selectedText }}"</p>
          <p *ngIf="ann.note" class="ann-note"><i class="bi bi-chat-left-text me-1"></i>{{ ann.note }}</p>
        </div>

        <div *ngFor="let ann of notesList" class="annotation-card note-card" (click)="goToPage(ann.pageNumber)">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <i class="bi bi-sticky text-warning"></i>
            <span class="small text-muted ms-auto">p. {{ ann.pageNumber }}</span>
            <button class="btn btn-ghost btn-xs ms-1" (click)="deleteAnnotation($event, ann)">
              <i class="bi bi-x"></i>
            </button>
          </div>
          <p class="ann-note">{{ ann.note }}</p>
        </div>
      </div>

      <!-- Bookmarks panel -->
      <div *ngIf="sidePanel==='bookmarks'" class="panel-content">
        <h6 class="panel-title"><i class="bi bi-bookmark me-2"></i>Marque-pages</h6>
        <button class="btn btn-sm btn-outline-primary w-100 mb-3" (click)="addBookmark()">
          <i class="bi bi-bookmark-plus me-1"></i>Marquer la page {{ currentPage }}
        </button>
        <div *ngIf="bookmarks.length === 0" class="text-center py-3">
          <i class="bi bi-bookmark text-muted" style="font-size:2rem"></i>
          <p class="small text-muted mt-2">Aucun marque-page.</p>
        </div>
        <div *ngFor="let bm of bookmarks" class="bookmark-item d-flex align-items-center justify-content-between"
             (click)="goToPage(bm.pageNumber)">
          <div>
            <i class="bi bi-bookmark-fill text-primary me-2"></i>
            <span class="small fw-semibold">Page {{ bm.pageNumber }}</span>
            <p *ngIf="bm.selectedText" class="small text-muted mb-0 ms-3">{{ bm.selectedText | slice:0:40 }}…</p>
          </div>
          <button class="btn btn-ghost btn-xs" (click)="deleteAnnotation($event, bm)">
            <i class="bi bi-x"></i>
          </button>
        </div>
      </div>

    </aside>

    <!-- PDF viewer area -->
    <div class="pdf-area" (mouseup)="onTextSelection()" #pdfArea>

      <!-- Loading state -->
      <div *ngIf="loading" class="pdf-loading">
        <div class="spinner-border text-primary mb-3"></div>
        <p class="text-muted">Chargement du document…</p>
      </div>

      <!-- No PDF yet -->
      <div *ngIf="!loading && book && !book.hasFile" class="pdf-no-file">
        <div class="text-center">
          <i class="bi bi-hourglass-split" style="font-size:4rem;color:#f59e0b"></i>
          <h4 class="fw-bold mt-3">Document en cours d'intégration</h4>
          <p class="text-muted">Le fichier PDF de <strong>« {{ book.title }} »</strong><br>
            sera disponible prochainement.</p>
          <div class="book-info-card mt-4">
            <div *ngIf="book.author"><i class="bi bi-person me-2 text-primary"></i>{{ book.author }}</div>
            <div *ngIf="book.year"><i class="bi bi-calendar me-2 text-primary"></i>{{ book.year }}</div>
            <div *ngIf="book.pages"><i class="bi bi-file-text me-2 text-primary"></i>{{ book.pages }} pages</div>
            <div *ngIf="book.publisher"><i class="bi bi-building me-2 text-primary"></i>{{ book.publisher }}</div>
          </div>
          <a routerLink="/library" class="btn btn-primary mt-4">
            <i class="bi bi-arrow-left me-1"></i>Retour à la bibliothèque
          </a>
        </div>
      </div>

      <!-- PDF.js viewer (ng2-pdf-viewer) -->
      <div *ngIf="!loading && book?.hasFile && pdfSrc" class="pdf-viewer-wrapper">
        <pdf-viewer #pdfViewer
          [src]="pdfSrc"
          [page]="currentPage"
          [zoom]="zoom"
          [zoom-scale]="'page-width'"
          [rotation]="rotation"
          [show-all]="false"
          [render-text]="true"
          [render-text-mode]="2"
          [original-size]="false"
          [fit-to-page]="false"
          [show-borders]="false"
          [autoresize]="false"
          [c-maps-url]="'assets/cmaps/'"
          (after-load-complete)="onPdfLoaded($event)"
          (page-rendered)="onPageRendered($event)"
          (error)="onPdfError($event)"
          style="display:block;width:100%;height:80vh">
        </pdf-viewer>
      </div>

      <!-- Bottom navigation bar -->
      <div *ngIf="!loading && book?.hasFile && totalPages > 0" class="bottom-nav">
        <button class="btn btn-outline-secondary btn-sm" (click)="prevPage()" [disabled]="currentPage <= 1">
          <i class="bi bi-chevron-left me-1"></i>Précédent
        </button>
        <span class="page-indicator">Page <strong>{{ currentPage }}</strong> / {{ totalPages }}</span>
        <button class="btn btn-primary btn-sm" (click)="nextPage()" [disabled]="currentPage >= totalPages">
          Suivant<i class="bi bi-chevron-right ms-1"></i>
        </button>
      </div>

    </div>
  </div>

  <!-- ── HIGHLIGHT POPUP ──────────────────────────────────────────────────── -->
  <div *ngIf="showHighlightPopup" class="highlight-popup"
       [style.top.px]="popupY" [style.left.px]="popupX">
    <div class="popup-header small fw-semibold mb-2">Surligner en :</div>
    <div class="color-swatches">
      <button *ngFor="let c of highlightColors" class="swatch"
              [style.background]="colorMap[c]" [title]="c"
              (click)="saveHighlight(c)"></button>
    </div>
    <div class="popup-divider"></div>
    <button class="popup-action" (click)="openNoteDialog()">
      <i class="bi bi-sticky me-1"></i>Ajouter une note
    </button>
    <button class="popup-action" (click)="addBookmarkFromSelection()">
      <i class="bi bi-bookmark me-1"></i>Marque-page
    </button>
    <button class="popup-action text-muted" (click)="closeHighlightPopup()">
      <i class="bi bi-x me-1"></i>Annuler
    </button>
  </div>

  <!-- ── NOTE DIALOG ──────────────────────────────────────────────────────── -->
  <div *ngIf="showNoteDialog" class="modal-overlay" (click)="showNoteDialog=false">
    <div class="note-dialog" (click)="$event.stopPropagation()">
      <h6 class="fw-bold mb-3"><i class="bi bi-sticky me-2"></i>Ajouter une note</h6>
      <div class="mb-2 p-2 bg-light rounded small text-muted" *ngIf="pendingText" style="border-left:3px solid #2b3ea8">
        "{{ pendingText | slice:0:120 }}{{ pendingText.length > 120 ? '…' : '' }}"
      </div>
      <textarea class="form-control form-control-sm mb-3" rows="4"
                [(ngModel)]="pendingNote" placeholder="Votre note…" autofocus></textarea>
      <div class="d-flex gap-2 justify-content-between align-items-center">
        <div class="color-swatches">
          <button *ngFor="let c of highlightColors" class="swatch sm"
                  [style.background]="colorMap[c]"
                  [class.selected-swatch]="pendingColor===c"
                  (click)="pendingColor=c"></button>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" (click)="showNoteDialog=false">Annuler</button>
          <button class="btn btn-sm btn-primary" (click)="saveNoteHighlight()">
            <i class="bi bi-check2 me-1"></i>Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── ADD-TO-REFERENCES DIALOG ──────────────────────────────────────────── -->
  <div *ngIf="showRefDialog" class="modal-overlay" (click)="showRefDialog=false">
    <div class="note-dialog" style="max-width:420px" (click)="$event.stopPropagation()">
      <h6 class="fw-bold mb-2"><i class="bi bi-journals me-2 text-primary"></i>Ajouter à mes références</h6>
      <p class="small text-muted mb-3">Ce livre sera ajouté à votre bibliothèque Zotero personnelle.</p>
      <div class="mb-2">
        <label class="form-label small fw-semibold">Collection</label>
        <input class="form-control form-control-sm" [(ngModel)]="refCollection"
               placeholder="Ex: Littérature africaine, Cours GL…">
      </div>
      <div class="mb-3">
        <label class="form-label small fw-semibold">Note personnelle</label>
        <textarea class="form-control form-control-sm" rows="2"
                  [(ngModel)]="refNote" placeholder="Optionnel…"></textarea>
      </div>
      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-sm btn-outline-secondary" (click)="showRefDialog=false">Annuler</button>
        <button class="btn btn-sm btn-primary" (click)="confirmAddReference()" [disabled]="savingRef">
          <span *ngIf="savingRef" class="spinner-border spinner-border-sm me-1"></span>
          <i *ngIf="!savingRef" class="bi bi-plus-circle me-1"></i>Ajouter
        </button>
      </div>
    </div>
  </div>

  <!-- ── TOAST ───────────────────────────────────────────────────────────── -->
  <div *ngIf="toastMsg" class="reader-toast" [class.toast-error]="toastError">
    {{ toastMsg }}
  </div>

</div>
  `,
  styles: [`
    /* ── Shell ──────────────────────────────────────────── */
    :host { display:block; }
    .reader-shell {
      height: 100vh; display: flex; flex-direction: column;
      overflow: hidden; margin: -24px; background: var(--surface-muted);
    }
    .reader-shell[data-mode="sepia"] { background: #f4ede3; }
    .reader-shell[data-mode="night"] { background: #1a1a2e; color: #e2e8f0; }

    /* ── Top bar ─────────────────────────────────────────── */
    .reader-topbar {
      background: var(--surface); border-bottom: 1px solid #e2e8f0;
      height: 52px; flex-shrink: 0; position: sticky; top: 0; z-index: 50;
    }
    [data-mode="night"] .reader-topbar { background: #16213e; border-color: #2d3748; }
    [data-mode="sepia"] .reader-topbar { background: #fdf6ec; border-color: #e8d5b7; }
    .btn-ghost {
      background: transparent; border: none; padding: 4px 8px;
      border-radius: 6px; color: #64748b; transition: background .15s;
      position: relative;
    }
    .btn-ghost:hover { background: #f1f5f9; color: #1e293b; }
    .btn-ghost.active-panel, .btn-ghost.active { background: #eef0fb; color: #1f2d7a; }
    [data-mode="night"] .btn-ghost { color: #94a3b8; }
    [data-mode="night"] .btn-ghost:hover { background: #2d3748; }
    .mode-btn { font-size: .85rem; }
    .page-input-wrap { display: flex; align-items: center; gap: 4px; }
    .page-input {
      width: 48px; text-align: center; border: 1px solid #e2e8f0;
      border-radius: 6px; font-size: .8rem; padding: 2px 4px;
    }
    [data-mode="night"] .page-input { background:#2d3748; color:#e2e8f0; border-color:#4a5568; }
    .zoom-select {
      border: 1px solid #e2e8f0; border-radius: 6px; font-size: .78rem;
      padding: 2px 4px; background: var(--surface); color: #334155;
    }
    [data-mode="night"] .zoom-select { background:#2d3748; color:#e2e8f0; border-color:#4a5568; }
    .badge-count {
      position: absolute; top: 0; right: 0;
      background: #ef4444; color: #fff; border-radius: 999px;
      font-size: .55rem; padding: 1px 4px; min-width: 14px; text-align: center;
    }

    /* ── Progress bar ────────────────────────────────────── */
    .reading-progress-bar {
      height: 3px; background: #e2e8f0; flex-shrink: 0;
    }
    .reading-progress-fill {
      height: 100%; background: #2b3ea8;
      transition: width .3s ease;
    }

    /* ── Main area ───────────────────────────────────────── */
    .reader-main {
      flex: 1; display: flex; overflow: hidden; position: relative;
    }

    /* ── Side panel ──────────────────────────────────────── */
    .side-panel {
      width: 280px; flex-shrink: 0; background: var(--surface);
      border-right: 1px solid #e2e8f0; overflow-y: auto;
    }
    [data-mode="night"] .side-panel { background: #16213e; border-color: #2d3748; }
    [data-mode="sepia"] .side-panel { background: #fdf6ec; border-color: #e8d5b7; }
    .panel-content { padding: 16px; }
    .panel-title { font-size: .85rem; font-weight: 700; color: #475569; margin-bottom: 12px; }
    [data-mode="night"] .panel-title { color: #94a3b8; }

    .annotation-card {
      padding: 10px; border-radius: 8px; margin-bottom: 8px;
      background: var(--surface-muted); border: 1px solid #e2e8f0; cursor: pointer;
      transition: border-color .15s;
    }
    .annotation-card:hover { border-color: #2b3ea8; }
    [data-mode="night"] .annotation-card { background: #2d3748; border-color: #4a5568; }
    .note-card { border-left: 3px solid #f59e0b; }
    .ann-color-dot {
      width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0;
    }
    .ann-text {
      font-size: .78rem; color: #475569; margin: 4px 0 2px; font-style: italic;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    [data-mode="night"] .ann-text { color: #94a3b8; }
    .ann-note { font-size: .75rem; color: #2b3ea8; margin: 0; }
    .btn-xs { padding: 1px 4px; font-size: .7rem; }

    .bookmark-item {
      padding: 8px 10px; border-radius: 8px; margin-bottom: 6px;
      cursor: pointer; transition: background .15s;
    }
    .bookmark-item:hover { background: #f1f5f9; }
    [data-mode="night"] .bookmark-item:hover { background: #2d3748; }

    /* ── PDF area ────────────────────────────────────────── */
    .pdf-area {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column;
      align-items: center; padding: 24px 16px; position: relative;
    }
    [data-mode="sepia"] .pdf-area { background: #f4ede3; }
    [data-mode="night"] .pdf-area { background: #1a1a2e; }
    .pdf-loading, .pdf-no-file {
      flex: 1; display: flex; align-items: center; justify-content: center;
      flex-direction: column; min-height: 60vh;
    }
    .pdf-viewer-wrapper {
      width: 100%; max-width: 900px;
      background: var(--surface); border-radius: 4px;
      box-shadow: 0 4px 24px rgba(0,0,0,.12);
      overflow: hidden;
    }
    [data-mode="sepia"] .pdf-viewer-wrapper {
      filter: sepia(25%) brightness(.97);
    }
    [data-mode="night"] .pdf-viewer-wrapper {
      filter: invert(1) hue-rotate(180deg) brightness(.85);
    }
    .book-info-card {
      background: var(--surface-muted); border-radius: 12px; padding: 16px;
      display: inline-block; text-align: left; min-width: 280px;
    }
    .book-info-card > div { padding: 4px 0; font-size: .88rem; }

    /* ── Highlight popup ─────────────────────────────────── */
    .highlight-popup {
      position: fixed; z-index: 1000; background: var(--surface);
      border-radius: 12px; padding: 12px 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18);
      border: 1px solid #e2e8f0; min-width: 180px;
    }
    .popup-header { color: #64748b; }
    .color-swatches { display: flex; gap: 6px; margin-bottom: 8px; }
    .swatch {
      width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; transition: transform .1s, border-color .1s;
    }
    .swatch:hover { transform: scale(1.2); border-color: #334155; }
    .swatch.sm { width: 18px; height: 18px; }
    .swatch.selected-swatch { border-color: #1e293b; transform: scale(1.15); }
    .popup-divider { height: 1px; background: #e2e8f0; margin: 8px 0; }
    .popup-action {
      display: block; width: 100%; text-align: left; background: none; border: none;
      padding: 5px 2px; font-size: .8rem; color: #334155; cursor: pointer;
      border-radius: 4px; transition: background .1s;
    }
    .popup-action:hover { background: #f1f5f9; }

    /* ── Note / dialog ───────────────────────────────────── */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.4);
      z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .note-dialog {
      background: var(--surface); border-radius: 16px; padding: 24px;
      width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,.2);
    }

    /* ── Toast ───────────────────────────────────────────── */
    .reader-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: #fff; padding: 10px 20px; border-radius: 999px;
      font-size: .85rem; z-index: 3000; box-shadow: 0 4px 20px rgba(0,0,0,.2);
      animation: fadeInUp .2s ease;
    }
    .reader-toast.toast-error { background: #ef4444; }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .bottom-nav {
      display: flex; align-items: center; justify-content: center; gap: 20px;
      padding: 14px 24px; background: var(--surface); border-top: 1px solid #e2e8f0;
      flex-shrink: 0; position: sticky; bottom: 0; z-index: 10;
    }
    [data-mode="night"] .bottom-nav { background: #16213e; border-color: #2d3748; }
    [data-mode="sepia"] .bottom-nav { background: #fdf6ec; border-color: #e8d5b7; }
    .page-indicator { font-size: .9rem; color: #64748b; min-width: 120px; text-align: center; }
    [data-mode="night"] .page-indicator { color: #94a3b8; }

    @media(max-width:768px) {
      .reader-shell { margin: -16px; }
      .side-panel { position: absolute; inset: 0 auto 0 0; z-index: 10; width: 85%; }
      .book-title-bar { display: none; }
    }
  `]
})
export class BookReaderComponent implements OnInit, OnDestroy {
  @ViewChild('pdfArea') pdfArea!: ElementRef;
  @ViewChild('pdfViewer') pdfViewerRef!: PdfViewerComponent;

  book: Book | null = null;
  pdfSrc: string | null = null;
  loading = true;
  currentPage = 1;
  totalPages = 0;
  zoom = 1;
  rotation = 0;
  readingMode: ReadingMode = 'day';
  sidePanel: SidePanel = 'none';
  searchQuery = '';
  annotations: Annotation[] = [];
  toastMsg = '';
  toastError = false;
  private toastTimer: any;

  // Highlight popup
  showHighlightPopup = false;
  popupX = 0;
  popupY = 0;
  pendingText = '';
  pendingColor: Annotation['color'] = 'yellow';
  pendingNote = '';
  showNoteDialog = false;

  // Ref dialog
  showRefDialog = false;
  refCollection = '';
  refNote = '';
  savingRef = false;

  readonly highlightColors: Annotation['color'][] = ['yellow', 'green', 'blue', 'pink', 'orange'];
  readonly colorMap: Record<string, string> = {
    yellow: '#fde68a', green: '#86efac', blue: '#93c5fd',
    pink: '#f9a8d4', orange: '#fdba74'
  };

  get highlights(): Annotation[] {
    return this.annotations.filter(a => a.type === 'HIGHLIGHT');
  }
  get notesList(): Annotation[] {
    return this.annotations.filter(a => a.type === 'NOTE');
  }
  get bookmarks(): Annotation[] {
    return this.annotations.filter(a => a.type === 'BOOKMARK');
  }

  constructor(
    private route: ActivatedRoute,
    private bookService: BookService,
    private annotationService: AnnotationService,
    private referenceService: ReferenceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.bookService.getBook(id).subscribe({
      next: book => {
        this.book = book;
        this.loading = false;
        if (book.hasFile && book.fileUrl) {
          this.pdfSrc = book.fileUrl;
          this.loadAnnotations();
        } else if (book.hasExternalRead && book.externalReadUrl) {
          // Livre sans PDF local mais avec lien externe → rediriger
          window.location.href = book.externalReadUrl;
          return;
        }
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; }
    });
  }

  ngOnDestroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── PDF events ─────────────────────────────────────────────────────────────
  onPdfLoaded(pdf: any) {
    this.totalPages = pdf.numPages;
    this.cdr.detectChanges();
  }

  onPageRendered(e: any) {
    this.applyHighlightsToTextLayer();
  }

  onPdfError(e: any) {
    this.showToast('Erreur lors du chargement du PDF.', true);
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  prevPage() { if (this.currentPage > 1) this.currentPage--; }
  nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
  goToPage(page: number) { this.currentPage = page; this.togglePanel('none'); }
  onPageInput() {
    this.currentPage = Math.max(1, Math.min(this.totalPages, this.currentPage));
  }

  // ── Zoom ────────────────────────────────────────────────────────────────────
  zoomIn()  { this.zoom = Math.min(+(this.zoom + 0.25).toFixed(2), 3); }
  zoomOut() { this.zoom = Math.max(+(this.zoom - 0.25).toFixed(2), 0.5); }
  applyZoom() { /* ngModel binding handles it */ }
  rotateLeft()  { this.rotation = ((this.rotation - 90) + 360) % 360; }
  rotateRight() { this.rotation = (this.rotation + 90) % 360; }

  // ── Side panel ──────────────────────────────────────────────────────────────
  togglePanel(p: SidePanel) {
    this.sidePanel = this.sidePanel === p ? 'none' : p;
  }

  // ── Search ──────────────────────────────────────────────────────────────────
  searchInPdf() {
    if (!this.searchQuery || !this.pdfViewerRef) return;
    (this.pdfViewerRef as any).pdfFindController?.executeCommand('find', {
      query: this.searchQuery, highlightAll: true, caseSensitive: false, findPrevious: false
    });
  }

  // ── Text selection → highlight popup ────────────────────────────────────────
  onTextSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      return; // don't close popup immediately — let button clicks register
    }
    this.pendingText = sel.toString().trim();
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    this.popupX = Math.min(rect.left, window.innerWidth - 200);
    this.popupY = rect.top - 140 + window.scrollY;
    this.showHighlightPopup = true;
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (this.showHighlightPopup && !target.closest('.highlight-popup')) {
      this.closeHighlightPopup();
    }
  }

  closeHighlightPopup() {
    this.showHighlightPopup = false;
    window.getSelection()?.removeAllRanges();
  }

  // ── Save highlight ──────────────────────────────────────────────────────────
  saveHighlight(color: Annotation['color']) {
    this.closeHighlightPopup();
    if (!this.book || !this.pendingText) return;
    this.annotationService.addAnnotation(this.book.id, {
      bookId: this.book.id,
      pageNumber: this.currentPage,
      selectedText: this.pendingText,
      color,
      type: 'HIGHLIGHT'
    }).subscribe(ann => {
      this.annotations.push(ann);
      this.applyHighlightsToTextLayer();
      this.showToast('Surlignage enregistré ');
      if (this.sidePanel === 'none') this.sidePanel = 'annotations';
    });
  }

  openNoteDialog() {
    this.showHighlightPopup = false;
    this.pendingColor = 'yellow';
    this.pendingNote = '';
    this.showNoteDialog = true;
  }

  saveNoteHighlight() {
    if (!this.book) return;
    this.annotationService.addAnnotation(this.book.id, {
      bookId: this.book.id,
      pageNumber: this.currentPage,
      selectedText: this.pendingText,
      color: this.pendingColor,
      note: this.pendingNote,
      type: this.pendingText ? 'HIGHLIGHT' : 'NOTE'
    }).subscribe(ann => {
      this.annotations.push(ann);
      this.applyHighlightsToTextLayer();
      this.showNoteDialog = false;
      this.showToast('Note enregistrée ');
      this.sidePanel = 'annotations';
    });
  }

  // ── Bookmarks ───────────────────────────────────────────────────────────────
  addBookmark() {
    if (!this.book) return;
    if (this.bookmarks.some(b => b.pageNumber === this.currentPage)) {
      this.showToast('Page déjà marquée.'); return;
    }
    this.annotationService.addAnnotation(this.book.id, {
      bookId: this.book.id, pageNumber: this.currentPage,
      selectedText: `Page ${this.currentPage}`, color: 'blue', type: 'BOOKMARK'
    }).subscribe(ann => {
      this.annotations.push(ann);
      this.showToast(`Page ${this.currentPage} marquée `);
    });
  }

  addBookmarkFromSelection() {
    this.closeHighlightPopup();
    this.addBookmark();
  }

  // ── Delete annotation ───────────────────────────────────────────────────────
  deleteAnnotation(e: Event, ann: Annotation) {
    e.stopPropagation();
    if (!this.book || !ann.id) return;
    this.annotationService.deleteAnnotation(this.book.id, ann.id).subscribe(() => {
      this.annotations = this.annotations.filter(a => a.id !== ann.id);
      this.applyHighlightsToTextLayer();
    });
  }

  // ── Apply highlights visually to PDF text layer ─────────────────────────────
  private applyHighlightsToTextLayer() {
    setTimeout(() => {
      // Remove existing highlights
      document.querySelectorAll('.pdf-highlight-span').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent ?? ''), el);
          (parent as Element).normalize();
        }
      });

      const pageHighlights = this.highlights.filter(a => a.pageNumber === this.currentPage);
      if (!pageHighlights.length) return;

      const textLayer = document.querySelector('.textLayer');
      if (!textLayer) return;

      pageHighlights.forEach(ann => {
        const spans = Array.from(textLayer.querySelectorAll('span'));
        const searchText = ann.selectedText;
        const fullText   = spans.map(s => s.textContent).join('');
        const idx = fullText.indexOf(searchText);
        if (idx === -1) return;

        let charCount = 0;
        for (const span of spans) {
          const len = (span.textContent ?? '').length;
          const start = idx - charCount;
          const end   = start + searchText.length;
          if (end > 0 && start < len) {
            const bg = this.colorMap[ann.color] ?? '#fde68a';
            const mark = document.createElement('mark');
            mark.className = 'pdf-highlight-span';
            mark.style.cssText = `background:${bg};opacity:.6;border-radius:2px;`;
            mark.title = ann.note ?? ann.selectedText;
            const text = span.textContent ?? '';
            const s = Math.max(0, start);
            const e2 = Math.min(len, end);
            span.innerHTML = text.slice(0, s) +
              `<mark class="pdf-highlight-span" style="background:${bg};opacity:.6;border-radius:2px;"
                    title="${ann.note ?? ''}">${text.slice(s, e2)}</mark>` +
              text.slice(e2);
          }
          charCount += len;
        }
      });
    }, 300);
  }

  // ── Load annotations from backend ───────────────────────────────────────────
  private loadAnnotations() {
    if (!this.book) return;
    this.annotationService.getAnnotations(this.book.id).subscribe(anns => {
      this.annotations = anns;
    });
  }

  // ── Add to Zotero references ────────────────────────────────────────────────
  addToReferences() { this.showRefDialog = true; }

  confirmAddReference() {
    if (!this.book) return;
    this.savingRef = true;
    const ref: Partial<Reference> = {
      refType: 'book',
      title: this.book.title,
      authors: this.book.author,
      year: this.book.year?.toString(),
      publisher: this.book.publisher,
      isbn: this.book.isbn,
      pages: this.book.pages?.toString(),
      collection: this.refCollection || undefined,
      note: this.refNote || undefined,
      language: this.book.language
    };
    this.referenceService.create(ref as any).subscribe({
      next: () => {
        this.showRefDialog = false;
        this.savingRef = false;
        this.showToast('Ajouté à vos références Zotero ');
      },
      error: () => {
        this.savingRef = false;
        this.showToast('Erreur lors de l\'ajout.', true);
      }
    });
  }

  // ── Toast ────────────────────────────────────────────────────────────────────
  showToast(msg: string, error = false) {
    this.toastMsg = msg; this.toastError = error;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastMsg = ''; this.cdr.detectChanges(); }, 2800);
    this.cdr.detectChanges();
  }
}
