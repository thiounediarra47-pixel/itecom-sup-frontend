import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReferenceService } from '../../core/services/reference.service';
import { Reference, CitationStyle } from '../../core/models/reference.model';
import { MarkdownItalicPipe } from '../../shared/directives/markdown-italic.pipe';
import { DialogService } from '../../core/services/dialog.service';

type View = 'list' | 'form' | 'citation';

@Component({
  selector: 'app-reference-manager',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, FormsModule, RouterLink, MarkdownItalicPipe],
  template: `
<div class="fade-in-up">

  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="d-flex justify-content-between align-items-start mb-4">
    <div>
      <h1 class="fw-bold mb-1"><i class="bi bi-folder2-open me-1"></i>Gestionnaire de références</h1>
      <p class="text-muted small">
        Bibliothèque personnelle Zotero-like : gérez vos références bibliographiques,
        générez des citations APA/MLA/Chicago/IEEE et exportez en BibTeX.
      </p>
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-outline-secondary btn-sm" (click)="openIsbnLookup()">
        <i class="bi bi-upc-scan me-1"></i>ISBN / DOI
      </button>
      <button class="btn btn-outline-success btn-sm" (click)="openZoteroImport()">
        <i class="bi bi-cloud-download me-1"></i>Zotero Web API
      </button>
      <button class="btn btn-primary btn-sm" (click)="openForm()">
        <i class="bi bi-plus-circle me-1"></i>Ajouter
      </button>
    </div>
  </div>

  <!-- ── Stats ────────────────────────────────────────────────────────── -->
  <div class="row g-3 mb-4">
    <div class="col-6 col-md-3">
      <div class="stat-card">
        <div class="stat-icon"><i class="bi bi-journal-bookmark"></i></div>
        <div class="stat-value">{{ refs.length }}</div>
        <div class="stat-label">Références totales</div>
      </div>
    </div>
    <div class="col-6 col-md-3">
      <div class="stat-card">
        <div class="stat-icon"><i class="bi bi-book"></i></div>
        <div class="stat-value">{{ countType('book') }}</div>
        <div class="stat-label">Livres</div>
      </div>
    </div>
    <div class="col-6 col-md-3">
      <div class="stat-card">
        <div class="stat-icon"><i class="bi bi-newspaper"></i></div>
        <div class="stat-value">{{ countType('article') + countType('journal') }}</div>
        <div class="stat-label">Articles</div>
      </div>
    </div>
    <div class="col-6 col-md-3">
      <div class="stat-card">
        <div class="stat-icon"><i class="bi bi-folder2-open"></i></div>
        <div class="stat-value">{{ collections.length }}</div>
        <div class="stat-label">Collections</div>
      </div>
    </div>
  </div>

  <div class="d-flex gap-3 align-items-start">

    <!-- ── Collections sidebar ──────────────────────────────────────── -->
    <div class="collections-sidebar">
      <div class="sidebar-section">
        <div class="sidebar-label">Bibliothèque</div>
        <button class="sidebar-item" [class.active]="!activeCollection"
                (click)="activeCollection=''; filterRefs()">
          <i class="bi bi-collection me-2"></i>Toutes les références
          <span class="ms-auto badge bg-light text-secondary">{{ refs.length }}</span>
        </button>
        <button *ngFor="let col of refTypes" class="sidebar-item"
                [class.active]="activeCollection==='__type__'+col.type"
                (click)="filterByType(col.type)">
          <span class="me-2"><i class="bi" [ngClass]="col.icon"></i></span>{{ col.label }}
          <span class="ms-auto badge bg-light text-secondary">{{ countType(col.type) }}</span>
        </button>
      </div>
      <div class="sidebar-section" *ngIf="collections.length">
        <div class="sidebar-label">Collections</div>
        <button *ngFor="let c of collections" class="sidebar-item"
                [class.active]="activeCollection===c"
                (click)="activeCollection=c; filterRefs()">
          <i class="bi bi-folder2 me-2 text-warning"></i>{{ c }}
        </button>
      </div>
    </div>

    <!-- ── Main list ─────────────────────────────────────────────────── -->
    <div class="flex-grow-1 min-w-0">

      <!-- Toolbar -->
      <div class="d-flex gap-2 mb-3 align-items-center flex-wrap">
        <div class="input-group input-group-sm flex-grow-1" style="max-width:320px">
          <span class="input-group-text bg-white border-end-0">
            <i class="bi bi-search text-muted"></i>
          </span>
          <input class="form-control border-start-0" placeholder="Rechercher titre, auteur…"
                 [(ngModel)]="searchQuery" (input)="filterRefs()">
        </div>
        <select class="form-select form-select-sm" style="width:160px" [(ngModel)]="sortBy" (change)="filterRefs()">
          <option value="date">Récentes en premier</option>
          <option value="title">Titre (A-Z)</option>
          <option value="author">Auteur (A-Z)</option>
          <option value="year">Année</option>
        </select>
        <div class="ms-auto d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" (click)="exportBibTeX()" [disabled]="!filteredRefs.length">
            <i class="bi bi-filetype-raw me-1"></i>BibTeX
          </button>
          <button class="btn btn-sm btn-outline-secondary" (click)="exportRIS()" [disabled]="!filteredRefs.length">
            <i class="bi bi-download me-1"></i>RIS
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <!-- Empty -->
      <div *ngIf="!loading && filteredRefs.length === 0" class="empty-state text-center py-5">
        <div style="font-size:3.5rem"><i class="bi bi-folder2-open"></i></div>
        <h5 class="mt-3 fw-bold">Aucune référence</h5>
        <p class="text-muted small">Ajoutez votre première référence bibliographique.</p>
        <button class="btn btn-primary btn-sm" (click)="openForm()">
          <i class="bi bi-plus-circle me-1"></i>Ajouter une référence
        </button>
      </div>

      <!-- Reference cards -->
      <div *ngFor="let ref of filteredRefs | paginate: refsPg.page : refsPg.size" class="ref-card">
        <div class="d-flex align-items-start gap-3">
          <div class="ref-type-badge" [style.background]="typeColor(ref.refType)">
            <i class="bi" [ngClass]="typeIcon(ref.refType)"></i>
          </div>
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex align-items-start justify-content-between gap-2">
              <h6 class="ref-title mb-0">{{ ref.title }}</h6>
              <div class="d-flex gap-1 flex-shrink-0">
                <button class="btn btn-xs btn-outline-secondary" (click)="openCitation(ref)" title="Générer citation">
                  <i class="bi bi-quote"></i>
                </button>
                <button class="btn btn-xs btn-outline-primary" (click)="openForm(ref)" title="Modifier">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-xs btn-outline-danger" (click)="deleteRef(ref)" title="Supprimer">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
            <div class="ref-meta">
              <span *ngIf="ref.authors" class="ref-authors">{{ ref.authors }}</span>
              <span *ngIf="ref.year" class="ref-year">{{ ref.year }}</span>
              <span *ngIf="ref.journal" class="ref-journal">— {{ ref.journal }}</span>
              <span *ngIf="ref.publisher" class="ref-journal">— {{ ref.publisher }}</span>
            </div>
            <div class="d-flex gap-2 mt-1 flex-wrap">
              <span class="badge bg-light text-secondary" style="font-size:.65rem">{{ typeLabel(ref.refType) }}</span>
              <span *ngIf="ref.collection" class="badge bg-warning bg-opacity-25 text-warning-emphasis" style="font-size:.65rem">
                <i class="bi bi-folder2 me-1"></i>{{ ref.collection }}
              </span>
              <span *ngFor="let tag of getTags(ref)" class="badge bg-primary bg-opacity-10 text-primary" style="font-size:.65rem">
                #{{ tag }}
              </span>
              <span *ngIf="ref.doi" class="badge bg-info bg-opacity-10 text-info" style="font-size:.65rem">
                DOI: {{ ref.doi }}
              </span>
              <span *ngIf="ref.isbn" class="badge bg-light text-secondary" style="font-size:.65rem">
                ISBN: {{ ref.isbn }}
              </span>
            </div>
            <p *ngIf="ref.note" class="small text-muted mt-1 mb-0">
              <i class="bi bi-sticky me-1"></i>{{ ref.note }}
            </p>
          </div>
        </div>
      </div>

    </div>
    <app-pagination [pager]="refsPg" [total]="filteredRefs.length"></app-pagination>
  </div>
</div>

<!-- ── ISBN / DOI LOOKUP MODAL ─────────────────────────────────────────── -->
<div *ngIf="showIsbnModal" class="modal-overlay" (click)="showIsbnModal=false">
  <div class="modal-box" style="max-width:480px" (click)="$event.stopPropagation()">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="fw-bold mb-0"><i class="bi bi-upc-scan me-2 text-primary"></i>Recherche ISBN / DOI</h5>
      <button class="btn btn-sm btn-ghost" (click)="showIsbnModal=false"><i class="bi bi-x-lg"></i></button>
    </div>
    <p class="small text-muted mb-3">
      Entrez un ISBN (livre) ou un DOI (article) pour remplir automatiquement les métadonnées
      depuis OpenLibrary et CrossRef.
    </p>
    <div class="input-group mb-3">
      <input class="form-control" [(ngModel)]="isbnInput"
             placeholder="978-2-7236-0009-0 ou 10.1000/xyz123"
             (keyup.enter)="lookupIdentifier()">
      <button class="btn btn-primary" (click)="lookupIdentifier()" [disabled]="lookupLoading">
        <span *ngIf="lookupLoading" class="spinner-border spinner-border-sm me-1"></span>
        <i *ngIf="!lookupLoading" class="bi bi-search me-1"></i>Chercher
      </button>
    </div>
    <div *ngIf="lookupError" class="alert alert-danger py-2 small">{{ lookupError }}</div>
    <div *ngIf="lookupResult" class="card border-0 bg-light p-3" style="border-radius:10px">
      <div class="fw-bold mb-1">{{ lookupResult.title }}</div>
      <div class="small text-muted mb-2">{{ lookupResult.authors }}</div>
      <div class="d-flex gap-2 flex-wrap mb-3">
        <span *ngIf="lookupResult.year" class="badge bg-light text-dark">{{ lookupResult.year }}</span>
        <span *ngIf="lookupResult.publisher" class="badge bg-light text-dark">{{ lookupResult.publisher }}</span>
        <span *ngIf="lookupResult.isbn" class="badge bg-light text-dark">{{ lookupResult.isbn }}</span>
      </div>
      <button class="btn btn-sm btn-primary" (click)="importLookupResult()">
        <i class="bi bi-plus-circle me-1"></i>Importer cette référence
      </button>
    </div>
  </div>
</div>

<!-- ── ZOTERO WEB API MODAL ─────────────────────────────────────────────── -->
<div *ngIf="showZoteroModal" class="modal-overlay" (click)="showZoteroModal=false">
  <div class="modal-box" style="max-width:520px" (click)="$event.stopPropagation()">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="fw-bold mb-0"><i class="bi bi-cloud-download me-2 text-success"></i>Connecter Zotero</h5>
      <button class="btn btn-sm btn-ghost" (click)="showZoteroModal=false"><i class="bi bi-x-lg"></i></button>
    </div>
    <p class="small text-muted mb-3">
      Importez vos références directement depuis votre bibliothèque Zotero en ligne.
      Nécessite un compte Zotero et une clé API.
    </p>
    <div class="alert alert-info py-2 small mb-3">
      <strong>Comment obtenir votre clé API :</strong><br>
      1. Allez sur <strong>zotero.org/settings/keys</strong><br>
      2. Créez une nouvelle clé avec accès en lecture à votre bibliothèque<br>
      3. Notez votre <strong>User ID</strong> (visible sur la même page)
    </div>
    <div class="mb-2">
      <label class="form-label small fw-semibold">User ID Zotero</label>
      <input class="form-control form-control-sm" [(ngModel)]="zoteroUserId" placeholder="Ex: 1234567">
    </div>
    <div class="mb-3">
      <label class="form-label small fw-semibold">Clé API Zotero</label>
      <input class="form-control form-control-sm" [(ngModel)]="zoteroApiKey"
             type="password" placeholder="Votre clé API…">
    </div>
    <button class="btn btn-success btn-sm" (click)="fetchZoteroRefs()" [disabled]="zoteroLoading">
      <span *ngIf="zoteroLoading" class="spinner-border spinner-border-sm me-1"></span>
      <i *ngIf="!zoteroLoading" class="bi bi-cloud-download me-1"></i>Importer depuis Zotero
    </button>
    <div *ngIf="zoteroError" class="alert alert-danger py-2 small mt-2">{{ zoteroError }}</div>
    <div *ngIf="zoteroImported > 0" class="alert alert-success py-2 small mt-2">
      <i class="bi bi-check-circle me-1"></i>{{ zoteroImported }} référence(s) importée(s) avec succès !
    </div>
  </div>
</div>

<!-- ── FORM MODAL ──────────────────────────────────────────────────────── -->
<div *ngIf="showForm" class="modal-overlay" (click)="showForm=false">
  <div class="modal-box" (click)="$event.stopPropagation()">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="fw-bold mb-0">
        <i class="bi bi-{{ editingRef?.id ? 'pencil' : 'plus-circle' }} me-2 text-primary"></i>
        {{ editingRef?.id ? 'Modifier' : 'Ajouter' }} une référence
      </h5>
      <button class="btn btn-sm btn-ghost" (click)="showForm=false"><i class="bi bi-x-lg"></i></button>
    </div>

    <!-- Type selector -->
    <div class="d-flex gap-2 flex-wrap mb-3">
      <button *ngFor="let t of refTypes" class="btn btn-sm"
              [class.btn-primary]="form.refType===t.type"
              [class.btn-outline-secondary]="form.refType!==t.type"
              (click)="form.refType=t.type">
        <i class="bi me-1" [ngClass]="t.icon"></i>{{ t.label }}
      </button>
    </div>

    <div class="row g-2">
      <!-- Common -->
      <div class="col-12">
        <label class="form-label small fw-semibold">Titre *</label>
        <input class="form-control form-control-sm" [(ngModel)]="form.title" placeholder="Titre complet">
      </div>
      <div class="col-12">
        <label class="form-label small fw-semibold">Auteur(s)</label>
        <input class="form-control form-control-sm" [(ngModel)]="form.authors"
               placeholder="Bâ, Mariama, Kane, Cheikh Hamidou (virgule entre les auteurs)">
        <div class="form-text">Séparez les auteurs par des virgules</div>
      </div>
      <div class="col-md-4">
        <label class="form-label small fw-semibold">Année</label>
        <input class="form-control form-control-sm" [(ngModel)]="form.year" placeholder="2024">
      </div>
      <div class="col-md-4">
        <label class="form-label small fw-semibold">Langue</label>
        <select class="form-select form-select-sm" [(ngModel)]="form.language">
          <option value="Français">Français</option>
          <option value="Anglais">Anglais</option>
          <option value="Arabe">Arabe</option>
          <option value="Autre">Autre</option>
        </select>
      </div>

      <!-- Book-specific -->
      <ng-container *ngIf="form.refType==='book'">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Éditeur</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.publisher" placeholder="Présence Africaine">
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Lieu de publication</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.place" placeholder="Paris">
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold">ISBN</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.isbn" placeholder="978-…">
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold">Édition</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.edition" placeholder="3e éd.">
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold">Pages</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.pages" placeholder="250">
        </div>
      </ng-container>

      <!-- Article/Journal-specific -->
      <ng-container *ngIf="form.refType==='article' || form.refType==='journal'">
        <div class="col-12">
          <label class="form-label small fw-semibold">Revue / Journal</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.journal" placeholder="Nom de la revue">
        </div>
        <div class="col-md-3">
          <label class="form-label small fw-semibold">Volume</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.volume" placeholder="12">
        </div>
        <div class="col-md-3">
          <label class="form-label small fw-semibold">Numéro</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.issue" placeholder="3">
        </div>
        <div class="col-md-3">
          <label class="form-label small fw-semibold">Page début</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.startPage" placeholder="45">
        </div>
        <div class="col-md-3">
          <label class="form-label small fw-semibold">Page fin</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.endPage" placeholder="67">
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">DOI</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.doi" placeholder="10.1000/xyz123">
        </div>
      </ng-container>

      <!-- Website -->
      <ng-container *ngIf="form.refType==='website'">
        <div class="col-12">
          <label class="form-label small fw-semibold">URL</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.url" placeholder="https://…">
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Date de consultation</label>
          <input class="form-control form-control-sm" type="date" [(ngModel)]="form.accessDate">
        </div>
      </ng-container>

      <!-- Thesis -->
      <ng-container *ngIf="form.refType==='thesis'">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Université</label>
          <input class="form-control form-control-sm" [(ngModel)]="form.university" placeholder="Université Cheikh Anta Diop">
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Type de thèse</label>
          <select class="form-select form-select-sm" [(ngModel)]="form.thesisType">
            <option value="Thèse de doctorat">Thèse de doctorat</option>
            <option value="Mémoire de master">Mémoire de master</option>
            <option value="Mémoire de licence">Mémoire de licence</option>
          </select>
        </div>
      </ng-container>

      <!-- Organization -->
      <div class="col-md-6">
        <label class="form-label small fw-semibold">Collection / Dossier</label>
        <input class="form-control form-control-sm" [(ngModel)]="form.collection"
               placeholder="Ex: Cours GL, Littérature africaine…">
      </div>
      <div class="col-md-6">
        <label class="form-label small fw-semibold">Mots-clés (tags)</label>
        <input class="form-control form-control-sm" [(ngModel)]="form.tags"
               placeholder="colonialisme, roman, 20e siècle">
      </div>
      <div class="col-12">
        <label class="form-label small fw-semibold">Résumé</label>
        <textarea class="form-control form-control-sm" rows="2" [(ngModel)]="form.abstract_"
                  placeholder="Résumé optionnel…"></textarea>
      </div>
      <div class="col-12">
        <label class="form-label small fw-semibold">Note personnelle</label>
        <textarea class="form-control form-control-sm" rows="2" [(ngModel)]="form.note"
                  placeholder="Vos notes…"></textarea>
      </div>
    </div>

    <div class="d-flex justify-content-end gap-2 mt-4">
      <button class="btn btn-outline-secondary btn-sm" (click)="showForm=false">Annuler</button>
      <button class="btn btn-primary btn-sm" (click)="saveRef()" [disabled]="saving">
        <span *ngIf="saving" class="spinner-border spinner-border-sm me-1"></span>
        <i *ngIf="!saving" class="bi bi-check2 me-1"></i>
        {{ editingRef?.id ? 'Mettre à jour' : 'Enregistrer' }}
      </button>
    </div>
  </div>
</div>

<!-- ── CITATION MODAL ──────────────────────────────────────────────────── -->
<div *ngIf="showCitationModal" class="modal-overlay" (click)="showCitationModal=false">
  <div class="modal-box" style="max-width:680px" (click)="$event.stopPropagation()">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="fw-bold mb-0"><i class="bi bi-quote me-2 text-primary"></i>Générer une citation</h5>
      <button class="btn btn-sm btn-ghost" (click)="showCitationModal=false"><i class="bi bi-x-lg"></i></button>
    </div>
    <p class="small text-muted mb-1 fw-semibold">{{ citationRef?.title }}</p>
    <p class="small text-muted mb-3">{{ citationRef?.authors }}</p>

    <div class="d-flex gap-2 mb-3 flex-wrap">
      <button *ngFor="let s of citationStyles" class="btn btn-sm"
              [class.btn-primary]="activeStyle===s"
              [class.btn-outline-secondary]="activeStyle!==s"
              (click)="activeStyle=s; generateCitation()">
        {{ s }}
      </button>
    </div>

    <div class="citation-box">
      <div class="citation-text" [innerHTML]="citationText | markdownItalic"></div>
      <button class="btn btn-sm btn-outline-secondary mt-2" (click)="copyCitation()">
        <i class="bi bi-clipboard me-1"></i>Copier
      </button>
    </div>

    <div class="mt-3 pt-3 border-top">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0 small fw-bold">Export BibTeX</h6>
        <button class="btn btn-sm btn-outline-secondary" (click)="copyBibTeX()">
          <i class="bi bi-clipboard me-1"></i>Copier BibTeX
        </button>
      </div>
      <pre class="bibtex-box">{{ bibtexText }}</pre>
    </div>
  </div>
</div>
  `,
  styles: [`
    /* ── Stats ─────────────────────────────── */
    .stat-card {
      background: var(--surface); border-radius: 12px; padding: 16px; text-align: center;
      border: 1px solid #e2e8f0; transition: box-shadow .2s;
    }
    .stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); }
    .stat-icon { font-size: 1.8rem; }
    .stat-value { font-size: 1.6rem; font-weight: 700; color: #1e293b; }
    .stat-label { font-size: .72rem; color: #94a3b8; margin-top: 2px; }

    /* ── Collections sidebar ────────────────── */
    .collections-sidebar {
      width: 220px; flex-shrink: 0;
      background: var(--surface); border: 1px solid #e2e8f0;
      border-radius: 12px; padding: 8px; height: fit-content; position: sticky; top: 8px;
    }
    .sidebar-section { margin-bottom: 8px; }
    .sidebar-label {
      font-size: .65rem; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: .08em;
      padding: 6px 10px 4px;
    }
    .sidebar-item {
      display: flex; align-items: center; width: 100%;
      padding: 7px 10px; border-radius: 8px; font-size: .82rem;
      background: none; border: none; text-align: left; color: #334155;
      transition: background .12s; cursor: pointer;
    }
    .sidebar-item:hover { background: #f1f5f9; }
    .sidebar-item.active { background: #eef0fb; color: #1f2d7a; font-weight: 600; }

    /* ── Ref cards ──────────────────────────── */
    .ref-card {
      background: var(--surface); border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 14px 16px; margin-bottom: 10px; transition: box-shadow .15s;
    }
    .ref-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,.07); }
    .ref-type-badge {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; opacity: .85;
    }
    .ref-title { font-size: .88rem; font-weight: 600; color: #1e293b; }
    .ref-meta { font-size: .78rem; color: #64748b; margin: 3px 0; }
    .ref-authors { font-style: italic; }
    .ref-year { margin-left: 6px; color: #94a3b8; }
    .ref-journal { color: #2b3ea8; }
    .btn-xs { padding: 2px 7px; font-size: .72rem; }
    .btn-ghost { background: transparent; border: none; color: #64748b; }

    /* ── Modals ─────────────────────────────── */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      z-index: 1050; display: flex; align-items: center;
      justify-content: center; padding: 16px;
    }
    .modal-box {
      background: var(--surface); border-radius: 16px; padding: 24px;
      max-width: 760px; width: 100%; max-height: 90vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,.18);
    }

    /* ── Citation ─────────────────────────────── */
    .citation-box {
      background: var(--surface-muted); border-radius: 10px; padding: 16px;
      border-left: 4px solid #2b3ea8;
    }
    .citation-text { font-size: .88rem; line-height: 1.7; color: #1e293b; }
    .citation-text em { font-style: italic; }
    .bibtex-box {
      background: #1e1e2e; color: #cdd6f4; border-radius: 8px;
      padding: 14px; font-size: .75rem; max-height: 200px; overflow-y: auto;
      white-space: pre-wrap;
    }

    @media(max-width:768px) {
      .d-flex.gap-3 { flex-direction: column; }
      .collections-sidebar { width: 100%; position: static; }
    }
  `]
})
export class ReferenceManagerComponent implements OnInit {
  /** Pagination des listes. */
  refsPg = new Pager(10);
  refs: Reference[] = [];
  filteredRefs: Reference[] = [];
  collections: string[] = [];
  activeCollection = '';
  searchQuery = '';
  sortBy: 'date' | 'title' | 'author' | 'year' = 'date';
  loading = true;
  saving = false;

  // Form
  showForm = false;
  editingRef: Reference | null = null;
  form: Partial<Reference & { language?: string }> = { refType: 'book' };

  // Citation
  showCitationModal = false;
  citationRef: Reference | null = null;
  citationText = '';
  bibtexText = '';
  activeStyle: CitationStyle = 'APA';
  readonly citationStyles: CitationStyle[] = ['APA', 'MLA', 'Chicago', 'IEEE', 'Vancouver'];

  // ISBN/DOI lookup
  showIsbnModal = false;
  isbnInput = '';
  lookupLoading = false;
  lookupError = '';
  lookupResult: Partial<Reference> | null = null;

  // Zotero
  showZoteroModal = false;
  zoteroUserId = '';
  zoteroApiKey = '';
  zoteroLoading = false;
  zoteroError = '';
  zoteroImported = 0;

  private activeTypeFilter = '';

  readonly refTypes = [
    { type: 'book' as const,       label: 'Livre',       icon: 'bi-book' },
    { type: 'article' as const,    label: 'Article',     icon: 'bi-newspaper' },
    { type: 'journal' as const,    label: 'Revue',       icon: 'bi-journal' },
    { type: 'website' as const,    label: 'Site Web',    icon: 'bi-globe' },
    { type: 'thesis' as const,     label: 'Thèse',       icon: 'bi-mortarboard' },
    { type: 'conference' as const, label: 'Conférence',  icon: 'bi-mic' },
  ];

  constructor(private dialogs: DialogService, private refService: ReferenceService) {}

  ngOnInit() { this.loadRefs(); }

  loadRefs() {
    this.loading = true;
    this.refService.getReferences().subscribe({
      next: refs => {
        this.refs = refs;
        this.filterRefs();
        this.loading = false;
        this.refService.getCollections().subscribe(c => this.collections = c);
      },
      error: () => { this.loading = false; }
    });
  }

  filterByType(type: string) {
    this.activeTypeFilter = type;
    this.activeCollection = '__type__' + type;
    this.filterRefs();
  }

  filterRefs() {
    let list = [...this.refs];
    if (this.activeCollection.startsWith('__type__')) {
      list = list.filter(r => r.refType === this.activeTypeFilter);
    } else if (this.activeCollection) {
      list = list.filter(r => r.collection === this.activeCollection);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.authors?.toLowerCase().includes(q) ||
        r.tags?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (this.sortBy === 'title')  return (a.title ?? '').localeCompare(b.title ?? '');
      if (this.sortBy === 'author') return (a.authors ?? '').localeCompare(b.authors ?? '');
      if (this.sortBy === 'year')   return (b.year ?? '').localeCompare(a.year ?? '');
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
    this.filteredRefs = list;
  }

  countType(type: string): number { return this.refs.filter(r => r.refType === type).length; }

  typeIcon(t: string): string {
    return this.refTypes.find(x => x.type === t)?.icon ?? 'bi-file-earmark-text';
  }
  typeLabel(t: string): string {
    return this.refTypes.find(x => x.type === t)?.label ?? t;
  }
  typeColor(t: string): string {
    const m: Record<string, string> = {
      book: '#eef0fb', article: '#dcfce7', journal: '#fef9c3',
      website: '#fce7f3', thesis: '#f3e8ff', conference: '#ffedd5'
    };
    return m[t] ?? '#f1f5f9';
  }
  getTags(r: Reference): string[] {
    return r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  openForm(ref?: Reference) {
    this.editingRef = ref ?? null;
    this.form = ref ? { ...ref } : { refType: 'book' };
    this.showForm = true;
  }

  saveRef() {
    if (!this.form.title?.trim()) return;
    this.saving = true;
    const obs = this.editingRef?.id
      ? this.refService.update(this.editingRef.id, this.form as Reference)
      : this.refService.create(this.form as Reference);

    obs.subscribe({
      next: saved => {
        if (this.editingRef?.id) {
          const i = this.refs.findIndex(r => r.id === saved.id);
          if (i >= 0) this.refs[i] = saved;
        } else {
          this.refs.unshift(saved);
        }
        this.filterRefs();
        this.refService.getCollections().subscribe(c => this.collections = c);
        this.showForm = false;
        this.saving = false;
      },
      error: () => { this.saving = false; }
    });
  }

  async deleteRef(ref: Reference) {
    if (!(await this.dialogs.confirmDelete(`« ${ref.title} »`))) return;
    this.refService.delete(ref.id!).subscribe(() => {
      this.refs = this.refs.filter(r => r.id !== ref.id);
      this.filterRefs();
    });
  }

  // ── Citation ────────────────────────────────────────────────────────────────
  openCitation(ref: Reference) {
    this.citationRef = ref;
    this.activeStyle = 'APA';
    this.showCitationModal = true;
    this.generateCitation();
  }

  generateCitation() {
    if (!this.citationRef) return;
    this.citationText = this.refService.formatCitation(this.citationRef, this.activeStyle);
    this.bibtexText   = this.refService.toBibTeX(this.citationRef);
  }

  copyCitation() {
    const plain = this.citationText.replace(/\*/g, '');
    navigator.clipboard.writeText(plain).then(() => this.dialogs.toast('Citation copiée'));
  }

  copyBibTeX() {
    navigator.clipboard.writeText(this.bibtexText).then(() => this.dialogs.toast('BibTeX copié'));
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  exportBibTeX() {
    const content = this.filteredRefs.map(r => this.refService.toBibTeX(r)).join('\n\n');
    this.downloadFile(content, 'references.bib', 'text/plain');
  }

  exportRIS() {
    const lines: string[] = [];
    for (const r of this.filteredRefs) {
      const t = r.refType === 'article' || r.refType === 'journal' ? 'JOUR' : 'BOOK';
      lines.push(`TY  - ${t}`);
      if (r.title)     lines.push(`TI  - ${r.title}`);
      if (r.authors)   r.authors.split(',').forEach(a => lines.push(`AU  - ${a.trim()}`));
      if (r.year)      lines.push(`PY  - ${r.year}`);
      if (r.publisher) lines.push(`PB  - ${r.publisher}`);
      if (r.place)     lines.push(`CY  - ${r.place}`);
      if (r.isbn)      lines.push(`SN  - ${r.isbn}`);
      if (r.doi)       lines.push(`DO  - ${r.doi}`);
      if (r.journal)   lines.push(`JO  - ${r.journal}`);
      if (r.url)       lines.push(`UR  - ${r.url}`);
      lines.push('ER  - \n');
    }
    this.downloadFile(lines.join('\n'), 'references.ris', 'text/plain');
  }

  private downloadFile(content: string, name: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── ISBN / DOI lookup ────────────────────────────────────────────────────────
  openIsbnLookup() { this.showIsbnModal = true; this.lookupResult = null; this.lookupError = ''; }

  lookupIdentifier() {
    const val = this.isbnInput.trim();
    if (!val) return;
    this.lookupLoading = true; this.lookupError = ''; this.lookupResult = null;

    if (val.startsWith('10.') || val.includes('/')) {
      // DOI → proxy backend → CrossRef
      this.refService.lookupDOI(val).subscribe({
        next: (res: any) => {
          if (res?.error) { this.lookupError = 'DOI introuvable via CrossRef.'; this.lookupLoading = false; return; }
          const w = res.message;
          const authors = (w.author ?? []).map((a: any) =>
            [a.given, a.family].filter(Boolean).join(' ')).join(', ');
          this.lookupResult = {
            refType: 'article', title: (w.title ?? [''])[0],
            authors, year: w.published?.['date-parts']?.[0]?.[0]?.toString(),
            journal: (w['container-title'] ?? [''])[0], doi: val,
            volume: w.volume, issue: w.issue,
            startPage: w.page?.split('-')[0], endPage: w.page?.split('-')[1]
          };
          this.lookupLoading = false;
        },
        error: () => { this.lookupError = 'DOI introuvable via CrossRef.'; this.lookupLoading = false; }
      });
    } else {
      // ISBN → proxy backend → OpenLibrary
      const clean = val.replace(/[-\s]/g, '');
      this.refService.lookupISBN(clean).subscribe({
        next: (data: any) => {
          if (data?.error) { this.lookupError = 'ISBN introuvable sur OpenLibrary.'; this.lookupLoading = false; return; }
          const key = `ISBN:${clean}`;
          const book = data[key];
          if (!book) { this.lookupError = 'ISBN introuvable sur OpenLibrary.'; this.lookupLoading = false; return; }
          const authors = (book.authors ?? []).map((a: any) => a.name).join(', ');
          this.lookupResult = {
            refType: 'book', title: book.title, authors,
            year: book.publish_date?.replace(/\D.*/, ''),
            publisher: (book.publishers ?? [{}])[0]?.name,
            place: (book.publish_places ?? [{}])[0]?.name,
            isbn: clean, pages: book.number_of_pages?.toString()
          };
          this.lookupLoading = false;
        },
        error: () => { this.lookupError = 'ISBN introuvable sur OpenLibrary.'; this.lookupLoading = false; }
      });
    }
  }

  importLookupResult() {
    if (!this.lookupResult) return;
    this.refService.create(this.lookupResult as Reference).subscribe(saved => {
      this.refs.unshift(saved);
      this.filterRefs();
      this.showIsbnModal = false;
    });
  }

  // ── Zotero Web API ───────────────────────────────────────────────────────────
  openZoteroImport() { this.showZoteroModal = true; this.zoteroError = ''; this.zoteroImported = 0; }

  fetchZoteroRefs() {
    if (!this.zoteroUserId || !this.zoteroApiKey) {
      this.zoteroError = 'User ID et clé API requis.'; return;
    }
    this.zoteroLoading = true; this.zoteroError = ''; this.zoteroImported = 0;

    this.refService.lookupZotero(this.zoteroUserId, this.zoteroApiKey).subscribe({
      next: (items: any[]) => {
        const toCreate: Partial<Reference>[] = [];
        for (const item of items) {
          const d = item.data;
          if (!d.title) continue;
          const authors = (d.creators ?? [])
            .filter((c: any) => c.creatorType === 'author')
            .map((c: any) => [c.firstName, c.lastName].filter(Boolean).join(' '))
            .join(', ');
          const typeMap: Record<string, Reference['refType']> = {
            book: 'book', journalArticle: 'article', magazineArticle: 'article',
            thesis: 'thesis', webpage: 'website', conferencePaper: 'conference'
          };
          toCreate.push({
            refType: typeMap[d.itemType] ?? 'book',
            title: d.title, authors,
            year: d.date?.substring(0, 4),
            publisher: d.publisher, place: d.place,
            isbn: d.ISBN, doi: d.DOI,
            journal: d.publicationTitle, volume: d.volume, issue: d.issue,
            url: d.url, university: d.university,
            thesisType: d.thesisType, note: d.abstractNote,
            collection: 'Zotero'
          });
        }
        // Save all to backend sequentially
        let count = 0;
        const save = (i: number) => {
          if (i >= toCreate.length) {
            this.zoteroImported = count;
            this.zoteroLoading = false;
            this.loadRefs();
            return;
          }
          this.refService.create(toCreate[i] as Reference).subscribe({
            next: () => { count++; save(i + 1); },
            error: () => save(i + 1)
          });
        };
        save(0);
      },
      error: () => {
        this.zoteroError = 'Connexion à Zotero échouée. Vérifiez votre User ID et clé API.';
        this.zoteroLoading = false;
      }
    });
  }
}
