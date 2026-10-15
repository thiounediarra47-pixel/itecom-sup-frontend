import { Component, OnInit } from '@angular/core';
import { PaginatePipe, PaginationComponent, Pager } from '../../shared/components/pagination.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BookService } from '../../core/services/book.service';
import { Book } from '../../core/models/book.model';
import { AuthService } from '../../core/services/auth.service';
import { DialogService } from '../../core/services/dialog.service';

interface DiscoveredBook {
  googleId: string;
  title: string;
  authors: string;
  description: string;
  coverUrl: string;
  publisher: string;
  year: string;
  pages: number;
  isbn: string;
  language: string;
  categories: string;
  previewLink: string;
  readUrl: string;        // lien lecture gratuite Internet Archive
  isPublicDomain: boolean;
}

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [PaginationComponent, PaginatePipe, CommonModule, FormsModule, RouterLink],
  template: `
    <div class="fade-in-up">

      <!-- Header -->
      <div class="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-journal-bookmark me-1"></i>Bibliothèque</h1>
          <p class="text-muted small">Explorez notre collection de livres : littérature africaine, informatique, génie logiciel…</p>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-primary btn-sm" (click)="openDiscoverModal()">
            <i class="bi bi-search me-1"></i>Découvrir des livres
          </button>
          <button *ngIf="authService.isTeacher || authService.isAdmin"
                  class="btn btn-primary btn-sm"
                  (click)="openAddModal()">
            <i class="bi bi-plus-circle me-1"></i>Ajouter manuellement
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card border-0 shadow-sm mb-4" style="border-radius:12px">
        <div class="card-body p-3">
          <div class="row g-2 align-items-center">
            <div class="col-md-4">
              <div class="input-group input-group-sm">
                <span class="input-group-text bg-white border-end-0">
                  <i class="bi bi-search text-muted"></i>
                </span>
                <input type="text" class="form-control border-start-0"
                       placeholder="Rechercher titre, auteur…"
                       [(ngModel)]="searchQuery"
                       (input)="applyFilters()">
              </div>
            </div>
            <div class="col-md-3">
              <select class="form-select form-select-sm" [(ngModel)]="selectedCategory" (change)="applyFilters()">
                <option value="">Toutes les catégories</option>
                <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
              </select>
            </div>
            <div class="col-md-3">
              <select class="form-select form-select-sm" [(ngModel)]="selectedLanguage" (change)="applyFilters()">
                <option value="">Toutes les langues</option>
                <option value="Français">Français</option>
                <option value="Anglais">Anglais</option>
                <option value="Arabe">Arabe</option>
              </select>
            </div>
            <div class="col-md-2">
              <button class="btn btn-sm btn-outline-secondary w-100" (click)="resetFilters()">
                <i class="bi bi-x-circle me-1"></i>Réinitialiser
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Category pills -->
      <div class="d-flex gap-2 flex-wrap mb-4">
        <button class="btn btn-sm rounded-pill"
                [class.btn-primary]="selectedCategory === ''"
                [class.btn-outline-secondary]="selectedCategory !== ''"
                (click)="selectedCategory = ''; applyFilters()">
          Tous ({{ allBooks.length }})
        </button>
        <button *ngFor="let c of categories" class="btn btn-sm rounded-pill"
                [class.btn-primary]="selectedCategory === c"
                [class.btn-outline-secondary]="selectedCategory !== c"
                (click)="selectedCategory = c; applyFilters()">
          {{ c }} ({{ countByCategory(c) }})
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="text-muted mt-2 small">Chargement de la bibliothèque…</p>
      </div>

      <!-- Empty -->
      <div *ngIf="!loading && filteredBooks.length === 0" class="text-center py-5">
        <i class="bi bi-book text-muted" style="font-size:3rem"></i>
        <p class="text-muted mt-2">Aucun livre trouvé pour ces critères.</p>
        <button class="btn btn-outline-primary btn-sm" (click)="openDiscoverModal()">
          <i class="bi bi-search me-1"></i>Chercher dans les catalogues en ligne
        </button>
      </div>

      <!-- Books grid -->
      <div *ngIf="!loading" class="row g-4">
        <div *ngFor="let book of filteredBooks | paginate: booksPg.page : booksPg.size" class="col-6 col-md-4 col-lg-3 col-xl-2-custom">
          <div class="book-card card border-0 shadow-sm h-100" (click)="openBook(book)"
               style="border-radius:12px;cursor:pointer;transition:transform .2s,box-shadow .2s">
            <div class="book-cover position-relative" [style.background]="getCoverColor(book)">
              <img *ngIf="book.coverUrl" [src]="book.coverUrl" class="cover-img" [alt]="book.title">
              <div *ngIf="!book.coverUrl" class="cover-placeholder d-flex flex-column align-items-center justify-content-center p-2">
                <span class="cover-icon"><i class="bi" [ngClass]="getCategoryIcon(book.category)"></i></span>
                <span class="cover-title text-white text-center fw-bold mt-1">{{ book.title }}</span>
              </div>
              <span *ngIf="book.hasFile" class="position-absolute top-0 end-0 m-1 badge bg-success"
                    style="font-size:.55rem"><i class="bi bi-file-pdf me-1"></i>PDF</span>
              <span *ngIf="!book.hasFile" class="position-absolute top-0 end-0 m-1 badge bg-warning text-dark"
                    style="font-size:.55rem"><i class="bi bi-clock me-1"></i>Bientôt</span>
            </div>
            <div class="card-body p-2">
              <h6 class="mb-0 fw-bold" style="font-size:.78rem;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                {{ book.title }}
              </h6>
              <p class="text-muted mb-1" style="font-size:.7rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                {{ book.author }}
              </p>
              <div class="d-flex align-items-center gap-1 flex-wrap">
                <span class="badge bg-light text-secondary" style="font-size:.58rem">{{ book.category }}</span>
                <span *ngIf="book.year" class="badge bg-light text-secondary" style="font-size:.58rem">{{ book.year }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <app-pagination [pager]="booksPg" [total]="filteredBooks.length"></app-pagination>

      <!-- ═══════════════════════════════════════════════════════
           MODAL : Découvrir des livres (Google Books)
           ═══════════════════════════════════════════════════════ -->
      <div *ngIf="showDiscoverModal" class="modal-overlay" (click)="showDiscoverModal = false">
        <div class="modal-box" style="max-width:900px" (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 class="fw-bold mb-0"><i class="bi bi-search me-1"></i>Découvrir des livres</h5>
              <p class="text-muted small mb-0">Recherchez dans Google Books et importez en un clic</p>
            </div>
            <button class="btn btn-sm btn-outline-secondary" (click)="showDiscoverModal = false">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>

          <!-- Search bar -->
          <div class="row g-2 mb-3">
            <div class="col">
              <div class="input-group">
                <input type="text" class="form-control"
                       placeholder='Ex: "littérature africaine", "algorithmes", "Mariama Bâ"…'
                       [(ngModel)]="discoverQuery"
                       (keydown.enter)="searchExternalBooks()">
                <select class="form-select" style="max-width:130px" [(ngModel)]="discoverLang">
                  <option value="">Toutes langues</option>
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                  <option value="ar">Arabe</option>
                </select>
                <button class="btn btn-primary" (click)="searchExternalBooks()" [disabled]="discoverLoading">
                  <span *ngIf="discoverLoading" class="spinner-border spinner-border-sm"></span>
                  <i *ngIf="!discoverLoading" class="bi bi-search"></i>
                  Rechercher
                </button>
              </div>
            </div>
          </div>

          <!-- Quick searches -->
          <div *ngIf="!discoverResults.length && !discoverLoading" class="mb-3">
            <p class="small text-muted fw-semibold mb-2">Suggestions rapides :</p>
            <div class="d-flex flex-wrap gap-2">
              <button *ngFor="let s of quickSearches" class="btn btn-sm btn-outline-secondary rounded-pill"
                      (click)="quickSearch(s.query, s.lang)">
                {{ s.label }}
              </button>
            </div>
          </div>

          <!-- Error -->
          <div *ngIf="discoverError" class="alert alert-danger py-2 small">
            <i class="bi bi-exclamation-triangle me-1"></i>{{ discoverError }}
          </div>

          <!-- Loading -->
          <div *ngIf="discoverLoading" class="text-center py-4">
            <div class="spinner-border text-primary"></div>
            <p class="text-muted small mt-2">Recherche en cours…</p>
          </div>

          <!-- Results -->
          <div *ngIf="discoverResults.length > 0 && !discoverLoading">
            <p class="small text-muted mb-3">
              <strong>{{ discoverResults.length }}</strong> résultats trouvés
              <span *ngIf="importedIds.size > 0" class="ms-2 text-success">
                · {{ importedIds.size }} importé(s)
              </span>
            </p>
            <div class="discover-results">
              <div *ngFor="let b of discoverResults" class="discover-item d-flex gap-3 p-3 rounded-3 mb-2"
                   [class.imported]="importedIds.has(b.googleId)">

                <!-- Cover -->
                <div class="discover-cover flex-shrink-0">
                  <img *ngIf="b.coverUrl" [src]="b.coverUrl" [alt]="b.title" class="w-100 h-100" style="object-fit:cover;border-radius:6px">
                  <div *ngIf="!b.coverUrl" class="no-cover d-flex align-items-center justify-content-center h-100 rounded"
                       [style.background]="getDiscoverColor(b)">
                    <span style="font-size:1.6rem"><i class="bi" [ngClass]="getDiscoverIcon(b)"></i></span>
                  </div>
                </div>

                <!-- Info -->
                <div class="flex-grow-1 min-w-0">
                  <div class="d-flex justify-content-between align-items-start gap-2">
                    <div class="min-w-0">
                      <h6 class="fw-bold mb-1" style="font-size:.88rem;line-height:1.3">{{ b.title }}</h6>
                      <p class="text-muted mb-1" style="font-size:.78rem">
                        <i class="bi bi-person me-1"></i>{{ b.authors || 'Auteur inconnu' }}
                      </p>
                    </div>
                    <div class="flex-shrink-0">
                      <button *ngIf="!importedIds.has(b.googleId)"
                              class="btn btn-sm btn-primary"
                              (click)="importBook(b)"
                              [disabled]="importingId === b.googleId">
                        <span *ngIf="importingId === b.googleId" class="spinner-border spinner-border-sm me-1"></span>
                        <i *ngIf="importingId !== b.googleId" class="bi bi-plus-circle me-1"></i>
                        Importer
                      </button>
                      <span *ngIf="importedIds.has(b.googleId)" class="badge bg-success py-2 px-3">
                        <i class="bi bi-check2 me-1"></i>Importé
                      </span>
                    </div>
                  </div>

                  <div class="d-flex flex-wrap gap-1 mb-1">
                    <span *ngIf="b.year" class="badge bg-light text-secondary" style="font-size:.65rem">{{ b.year }}</span>
                    <span *ngIf="b.publisher" class="badge bg-light text-secondary" style="font-size:.65rem">{{ b.publisher }}</span>
                    <span *ngIf="b.pages" class="badge bg-light text-secondary" style="font-size:.65rem">{{ b.pages }} p.</span>
                    <span *ngIf="b.language" class="badge bg-light text-secondary" style="font-size:.65rem">{{ b.language }}</span>
                    <span *ngIf="b.isbn" class="badge bg-light text-secondary" style="font-size:.65rem">ISBN {{ b.isbn }}</span>
                  </div>

                  <p class="text-muted mb-0" style="font-size:.75rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                    {{ b.description }}
                  </p>

                  <div class="d-flex gap-2 flex-wrap mt-1">
                    <a *ngIf="b.isPublicDomain && b.readUrl" [href]="b.readUrl" target="_blank"
                       class="btn btn-sm btn-success" style="font-size:.72rem;padding:2px 10px">
                      <i class="bi bi-book-half me-1"></i>Lire gratuitement
                    </a>
                    <a *ngIf="!b.isPublicDomain && b.previewLink" [href]="b.previewLink" target="_blank"
                       class="small text-primary d-inline-flex align-items-center" style="font-size:.72rem">
                      <i class="bi bi-box-arrow-up-right me-1"></i>Voir sur OpenLibrary
                    </a>
                    <span *ngIf="b.isPublicDomain" class="badge bg-success-subtle text-success" style="font-size:.62rem">
                      <i class="bi bi-unlock me-1"></i>Accès libre
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════
           MODAL : Détail livre
           ═══════════════════════════════════════════════════════ -->
      <div *ngIf="selectedBook" class="modal-overlay" (click)="closeModal($event)">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <div class="d-flex gap-3">
            <div class="book-detail-cover flex-shrink-0" [style.background]="getCoverColor(selectedBook)">
              <img *ngIf="selectedBook.coverUrl" [src]="selectedBook.coverUrl" class="w-100 h-100" style="object-fit:cover;border-radius:8px" [alt]="selectedBook.title">
              <div *ngIf="!selectedBook.coverUrl" class="d-flex flex-column align-items-center justify-content-center h-100 p-3">
                <span style="font-size:3rem"><i class="bi" [ngClass]="getCategoryIcon(selectedBook.category)"></i></span>
                <span class="text-white text-center fw-bold mt-2 small">{{ selectedBook.title }}</span>
              </div>
            </div>
            <div class="flex-grow-1 min-w-0">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <span class="badge mb-2" [style.background]="getCoverColor(selectedBook)">{{ selectedBook.category }}</span>
                  <h4 class="fw-bold mb-1">{{ selectedBook.title }}</h4>
                  <p class="text-muted mb-2"><i class="bi bi-person me-1"></i>{{ selectedBook.author }}</p>
                </div>
                <button class="btn btn-sm btn-outline-secondary" (click)="selectedBook = null">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>

              <div class="d-flex flex-wrap gap-2 mb-3">
                <span *ngIf="selectedBook.genre" class="badge bg-light text-dark">
                  <i class="bi bi-bookmark me-1"></i>{{ selectedBook.genre }}
                </span>
                <span *ngIf="selectedBook.language" class="badge bg-light text-dark">
                  <i class="bi bi-translate me-1"></i>{{ selectedBook.language }}
                </span>
                <span *ngIf="selectedBook.year" class="badge bg-light text-dark">
                  <i class="bi bi-calendar me-1"></i>{{ selectedBook.year }}
                </span>
                <span *ngIf="selectedBook.pages" class="badge bg-light text-dark">
                  <i class="bi bi-file-text me-1"></i>{{ selectedBook.pages }} pages
                </span>
                <span *ngIf="selectedBook.publisher" class="badge bg-light text-dark">
                  <i class="bi bi-building me-1"></i>{{ selectedBook.publisher }}
                </span>
              </div>

              <p class="text-muted small mb-3" style="line-height:1.6">{{ selectedBook.description }}</p>

              <div *ngIf="selectedBook.isbn" class="small text-muted mb-3">
                <i class="bi bi-upc-scan me-1"></i>ISBN : {{ selectedBook.isbn }}
              </div>

              <div class="d-flex gap-2 flex-wrap align-items-center">
                <!-- PDF local uploadé → liseuse intégrée -->
                <a *ngIf="selectedBook.hasFile"
                   [routerLink]="['/library', selectedBook.id, 'read']"
                   class="btn btn-primary">
                  <i class="bi bi-book-half me-1"></i>Lire le livre
                </a>
                <a *ngIf="selectedBook.hasFile && selectedBook.fileUrl"
                   [href]="selectedBook.fileUrl" download
                   class="btn btn-outline-secondary">
                  <i class="bi bi-download me-1"></i>Télécharger PDF
                </a>
                <!-- Lien externe Internet Archive / OpenLibrary -->
                <a *ngIf="!selectedBook.hasFile && selectedBook.hasExternalRead && selectedBook.externalReadUrl"
                   [href]="selectedBook.externalReadUrl" target="_blank"
                   class="btn btn-success">
                  <i class="bi bi-book-half me-1"></i>Lire en ligne
                </a>
                <span *ngIf="!selectedBook.hasFile && selectedBook.hasExternalRead"
                      class="badge bg-success-subtle text-success small">
                  <i class="bi bi-unlock me-1"></i>Accès libre
                </span>
                <!-- Aucune source disponible -->
                <div *ngIf="!selectedBook.hasFile && !selectedBook.hasExternalRead" class="w-100">
                  <div class="alert alert-info py-2 px-3 mb-2 small">
                    <i class="bi bi-info-circle-fill me-1"></i>
                    <strong>Ce livre n'est pas encore disponible en lecture.</strong><br>
                    <span class="text-muted">Recherchez-le sur <a href="https://archive.org/search?query={{selectedBook.title}}" target="_blank">Internet Archive</a>
                    ou <a href="https://gallica.bnf.fr/recherche/simple?lang=FR&query={{selectedBook.title}}" target="_blank">Gallica (BnF)</a> pour lire gratuitement en ligne.</span>
                  </div>
                  <div *ngIf="authService.isTeacher || authService.isAdmin" class="small text-muted">
                    <i class="bi bi-arrow-down me-1"></i>Ou uploadez le fichier PDF du livre ci-dessous (section professeur)
                  </div>
                </div>
              </div>

              <div *ngIf="authService.isTeacher || authService.isAdmin" class="mt-3 pt-3 border-top">
                <p class="small fw-semibold text-muted mb-2"><i class="bi bi-gear me-1"></i>Gestion (professeur)</p>
                <div class="d-flex gap-2 flex-wrap">
                  <label class="btn btn-sm btn-outline-primary mb-0">
                    <i class="bi bi-file-pdf me-1"></i>Uploader PDF
                    <input type="file" accept=".pdf" hidden (change)="onUploadPdf($event, selectedBook.id)">
                  </label>
                  <label class="btn btn-sm btn-outline-secondary mb-0">
                    <i class="bi bi-image me-1"></i>Uploader couverture
                    <input type="file" accept="image/*" hidden (change)="onUploadCover($event, selectedBook.id)">
                  </label>
                  <button class="btn btn-sm btn-danger" (click)="deleteBook(selectedBook.id)">
                    <i class="bi bi-trash me-1"></i>Supprimer
                  </button>
                </div>
                <div *ngIf="uploadMessage" class="mt-2 small"
                     [class.text-success]="!uploadError" [class.text-danger]="uploadError">
                  {{ uploadMessage }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════
           MODAL : Ajouter manuellement
           ═══════════════════════════════════════════════════════ -->
      <div *ngIf="showAddModal" class="modal-overlay" (click)="showAddModal = false">
        <div class="modal-box" style="max-width:560px" (click)="$event.stopPropagation()">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="fw-bold mb-0"><i class="bi bi-plus-circle me-1"></i>Ajouter un livre</h5>
            <button class="btn btn-sm btn-outline-secondary" (click)="showAddModal = false">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="row g-2">
            <div class="col-12">
              <label class="form-label small fw-semibold">Titre *</label>
              <input class="form-control form-control-sm" [(ngModel)]="newBook.title" placeholder="Titre du livre">
            </div>
            <div class="col-12">
              <label class="form-label small fw-semibold">Auteur *</label>
              <input class="form-control form-control-sm" [(ngModel)]="newBook.author" placeholder="Nom de l'auteur">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold">Catégorie</label>
              <select class="form-select form-select-sm" [(ngModel)]="newBook.category">
                <option value="Littérature">Littérature</option>
                <option value="Informatique">Informatique</option>
                <option value="Histoire">Histoire</option>
                <option value="Sciences">Sciences</option>
                <option value="Mathématiques">Mathématiques</option>
                <option value="Philosophie">Philosophie</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold">Genre</label>
              <input class="form-control form-control-sm" [(ngModel)]="newBook.genre" placeholder="Roman, Essai, Manuel…">
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold">Langue</label>
              <select class="form-select form-select-sm" [(ngModel)]="newBook.language">
                <option value="Français">Français</option>
                <option value="Anglais">Anglais</option>
                <option value="Arabe">Arabe</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-semibold">Année</label>
              <input type="number" class="form-control form-control-sm" [(ngModel)]="newBook.year" placeholder="2024">
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-semibold">Pages</label>
              <input type="number" class="form-control form-control-sm" [(ngModel)]="newBook.pages" placeholder="250">
            </div>
            <div class="col-md-8">
              <label class="form-label small fw-semibold">Éditeur</label>
              <input class="form-control form-control-sm" [(ngModel)]="newBook.publisher" placeholder="Nom de l'éditeur">
            </div>
            <div class="col-md-4">
              <label class="form-label small fw-semibold">ISBN</label>
              <input class="form-control form-control-sm" [(ngModel)]="newBook.isbn" placeholder="978-…">
            </div>
            <div class="col-12">
              <label class="form-label small fw-semibold">Description</label>
              <textarea class="form-control form-control-sm" rows="3" [(ngModel)]="newBook.description"
                        placeholder="Résumé du livre…"></textarea>
            </div>
          </div>
          <div class="d-flex justify-content-end gap-2 mt-3">
            <button class="btn btn-sm btn-outline-secondary" (click)="showAddModal = false">Annuler</button>
            <button class="btn btn-sm btn-primary" (click)="saveNewBook()" [disabled]="savingBook">
              <span *ngIf="savingBook" class="spinner-border spinner-border-sm me-1"></span>
              <i *ngIf="!savingBook" class="bi bi-check2 me-1"></i>Enregistrer
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .book-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,.12) !important; }
    .book-cover { height: 180px; border-radius: 12px 12px 0 0; overflow: hidden; position: relative; }
    .cover-img { width: 100%; height: 100%; object-fit: cover; }
    .cover-placeholder { height: 100%; }
    .cover-icon { font-size: 2rem; }
    .cover-title { font-size: .68rem; line-height: 1.2; max-height: 4em; overflow: hidden; }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      z-index: 1050; display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-box {
      background: var(--surface); border-radius: 16px; padding: 24px;
      max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,.2);
    }
    .book-detail-cover {
      width: 140px; height: 200px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
    }
    .discover-results { max-height: 55vh; overflow-y: auto; }
    .discover-item {
      border: 1px solid #e5e7eb; background: #fafafa; transition: background .15s;
    }
    .discover-item:hover { background: #f0f4ff; }
    .discover-item.imported { background: #f0fdf4; border-color: #bbf7d0; }
    .discover-cover { width: 60px; height: 80px; }
    .no-cover { width: 60px; height: 80px; }
  `]
})
export class LibraryComponent implements OnInit {
  /** Pagination des listes. */
  booksPg = new Pager(12);
  allBooks: Book[] = [];
  filteredBooks: Book[] = [];
  categories: string[] = [];
  selectedBook: Book | null = null;
  selectedCategory = '';
  selectedLanguage = '';
  searchQuery = '';
  loading = true;
  showAddModal = false;
  savingBook = false;
  uploadMessage = '';
  uploadError = false;

  // Discover modal
  showDiscoverModal = false;
  discoverQuery = '';
  discoverLang = 'fr';
  discoverLoading = false;
  discoverError = '';
  discoverResults: DiscoveredBook[] = [];
  importedIds = new Set<string>();
  importingId = '';

  quickSearches = [
    // Littérature sénégalaise & africaine francophone
    { label: '🇸🇳 Mariama Bâ', query: 'Mariama Ba', lang: 'fr' },
    { label: '🇸🇳 Ousmane Sembène', query: 'Ousmane Sembene', lang: 'fr' },
    { label: '🇸🇳 Cheikh Hamidou Kane', query: 'Cheikh Hamidou Kane', lang: 'fr' },
    { label: '🇸🇳 Léopold Sédar Senghor', query: 'Léopold Sédar Senghor', lang: 'fr' },
    { label: '🇸🇳 Birago Diop', query: 'Birago Diop', lang: 'fr' },
    { label: '🇸🇳 Fatou Diome', query: 'Fatou Diome', lang: 'fr' },
    { label: '🇸🇳 Boubacar Boris Diop', query: 'Boubacar Boris Diop', lang: 'fr' },
    { label: 'Roman sénégalais', query: 'roman sénégalais Sénégal', lang: 'fr' },
    { label: 'Littérature africaine', query: 'littérature africaine roman', lang: 'fr' },
    { label: 'Négritude poésie', query: 'négritude poésie africaine Césaire Senghor', lang: 'fr' },
    { label: 'Ahmadou Kourouma', query: 'Ahmadou Kourouma', lang: 'fr' },
    { label: 'Mongo Beti', query: 'Mongo Beti roman', lang: 'fr' },
    // Informatique
    { label: 'Algorithmes', query: 'algorithmes structures de données', lang: 'fr' },
    { label: 'Génie logiciel', query: 'génie logiciel conception', lang: 'fr' },
    { label: 'Intelligence artificielle', query: 'intelligence artificielle machine learning', lang: 'fr' },
    { label: 'UML modélisation', query: 'UML modélisation objet', lang: 'fr' },
    { label: 'Bases de données', query: 'bases de données SQL conception', lang: 'fr' },
    { label: 'Réseaux informatiques', query: 'réseaux informatiques protocoles', lang: 'fr' },
  ];

  newBook: Partial<Book> = {
    category: 'Littérature', language: 'Français', genre: ''
  };

  private coverPalette: Record<string, string> = {
    'Littérature':    '#7c3aed',
    'Informatique':   '#0891b2',
    'Histoire':       '#b45309',
    'Sciences':       '#059669',
    'Mathématiques':  '#dc2626',
    'Philosophie':    '#7c3aed',
    'Autre':          '#475569',
  };

  constructor(private dialogs: DialogService, 
    private bookService: BookService,
    public authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() { this.loadBooks(); }

  loadBooks() {
    this.loading = true;
    this.bookService.getBooks().subscribe({
      next: books => {
        this.allBooks = books;
        this.categories = [...new Set(books.map(b => b.category).filter(Boolean))].sort();
        this.applyFilters();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  applyFilters() {
    let list = this.allBooks;
    if (this.selectedCategory) list = list.filter(b => b.category === this.selectedCategory);
    if (this.selectedLanguage) list = list.filter(b => b.language === this.selectedLanguage);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.description ?? '').toLowerCase().includes(q)
      );
    }
    this.filteredBooks = list;
  }

  resetFilters() {
    this.selectedCategory = '';
    this.selectedLanguage = '';
    this.searchQuery = '';
    this.applyFilters();
  }

  countByCategory(cat: string): number {
    return this.allBooks.filter(b => b.category === cat).length;
  }

  getCoverColor(book: Book): string {
    return this.coverPalette[book.category] ?? '#475569';
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Littérature':    'bi-book',
      'Informatique':   'bi-laptop',
      'Histoire':       'bi-bank2',
      'Sciences':       'bi-activity',
      'Mathématiques':  'bi-rulers',
      'Philosophie':    'bi-cpu',
    };
    return icons[category] ?? 'bi-journal-bookmark';
  }

  openBook(book: Book) {
    this.selectedBook = book;
    this.uploadMessage = '';
    this.uploadError = false;
  }

  closeModal(event: MouseEvent) { this.selectedBook = null; }

  openAddModal() {
    this.newBook = { category: 'Littérature', language: 'Français', genre: '' };
    this.showAddModal = true;
  }

  saveNewBook() {
    if (!this.newBook.title?.trim() || !this.newBook.author?.trim()) return;
    this.savingBook = true;
    this.bookService.createBook(this.newBook).subscribe({
      next: book => {
        this.allBooks.unshift(book);
        this.applyFilters();
        this.showAddModal = false;
        this.savingBook = false;
      },
      error: () => { this.savingBook = false; }
    });
  }

  // ── Discover ──────────────────────────────────────────────────────────────

  openDiscoverModal() {
    this.showDiscoverModal = true;
    this.discoverResults = [];
    this.discoverError = '';
    this.discoverQuery = '';
    this.importedIds = new Set();
  }

  quickSearch(query: string, lang: string) {
    this.discoverQuery = query;
    this.discoverLang = lang;
    this.searchExternalBooks();
  }

  searchExternalBooks() {
    if (!this.discoverQuery.trim()) return;
    this.discoverLoading = true;
    this.discoverError = '';
    this.discoverResults = [];

    const params: any = { q: this.discoverQuery, maxResults: 24 };
    if (this.discoverLang) params['lang'] = this.discoverLang;

    this.http.get<any>('/api/lookup/books/search', { params }).subscribe({
      next: data => {
        this.discoverLoading = false;
        if (data?.error) {
          this.discoverError = data.error;
          return;
        }
        const items: any[] = data?.docs ?? [];
        if (!items.length) {
          this.discoverError = 'Aucun résultat. Essayez d\'autres mots-clés.';
          return;
        }
        this.discoverResults = items.map(item => this.parseOpenLibraryBook(item));
      },
      error: (err: any) => {
        this.discoverLoading = false;
        if (err.status === 0) {
          this.discoverError = 'Impossible de joindre le serveur. Vérifiez que le backend est démarré sur le port 8080.';
        } else if (err.status === 401 || err.status === 403) {
          this.discoverError = 'Accès refusé (erreur ' + err.status + '). Reconnectez-vous et réessayez.';
        } else if (err.status === 502) {
          this.discoverError = 'Google Books est temporairement indisponible. Réessayez dans quelques instants.';
        } else {
          this.discoverError = 'Erreur ' + (err.status || '') + ' : ' + (err.error?.error || err.message || 'Erreur inconnue');
        }
      }
    });
  }

  private parseOpenLibraryBook(doc: any): DiscoveredBook {
    const langMap: Record<string, string> = { fre: 'Français', eng: 'Anglais', ara: 'Arabe', spa: 'Espagnol', ger: 'Allemand', por: 'Portugais' };
    const coverId = doc.cover_i;
    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '';
    const isbn = (doc.isbn ?? [])[0] ?? '';
    const langs: string[] = doc.language ?? [];
    const langLabel = langs.length ? (langMap[langs[0]] ?? langs[0]) : '';
    const subjects: string[] = doc.subject ?? [];
    const publisher = Array.isArray(doc.publisher) ? doc.publisher[0] : (doc.publisher ?? '');
    const iaId = Array.isArray(doc.ia) ? doc.ia[0] : (doc.ia ?? '');
    const isPublicDomain = !!doc.public_scan_b;
    const hasFullText = !!doc.has_fulltext;
    const lendingId = doc.lending_identifier_s || doc.lending_edition_s || '';
    // Lien lecture : domaine public ou emprunt Internet Archive (1h gratuit)
    let readUrl = '';
    if (isPublicDomain && iaId) {
      readUrl = `https://archive.org/details/${iaId}`;
    } else if (hasFullText && iaId) {
      readUrl = `https://archive.org/details/${iaId}`;
    } else if (lendingId) {
      readUrl = `https://archive.org/details/${lendingId}`;
    } else if (doc.key) {
      readUrl = `https://openlibrary.org${doc.key}`;
    }
    return {
      googleId: doc.key ?? (doc.title + Math.random()),
      title: doc.title ?? 'Titre inconnu',
      authors: (doc.author_name ?? []).join(', '),
      description: Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : (doc.first_sentence ?? ''),
      coverUrl,
      publisher,
      year: doc.first_publish_year ? String(doc.first_publish_year) : '',
      pages: doc.number_of_pages_median ?? 0,
      isbn,
      language: langLabel,
      categories: subjects.slice(0, 3).join(', '),
      previewLink: doc.key ? `https://openlibrary.org${doc.key}` : '',
      readUrl,
      isPublicDomain: isPublicDomain || hasFullText || !!lendingId,
    };
  }

  importBook(b: DiscoveredBook) {
    this.importingId = b.googleId;
    const category = this.guessCategory(b);
    const bookData: Partial<Book> = {
      title: b.title,
      author: b.authors,
      description: b.description,
      coverUrl: b.coverUrl,
      publisher: b.publisher,
      year: b.year ? +b.year : undefined,
      pages: b.pages || undefined,
      isbn: b.isbn,
      language: b.language || 'Français',
      category,
      genre: b.categories,
      available: true,
      externalReadUrl: b.readUrl || undefined,
    };
    this.bookService.createBook(bookData).subscribe({
      next: book => {
        this.allBooks.unshift(book);
        this.applyFilters();
        if (!this.categories.includes(book.category)) {
          this.categories = [...new Set(this.allBooks.map(b => b.category).filter(Boolean))].sort();
        }
        this.importedIds.add(b.googleId);
        this.importingId = '';
      },
      error: () => { this.importingId = ''; }
    });
  }

  private guessCategory(b: DiscoveredBook): string {
    const text = (b.title + ' ' + b.categories + ' ' + b.description).toLowerCase();
    if (/informatique|algorithm|programm|logiciel|code|données|réseau|java|python|sql|uml/.test(text)) return 'Informatique';
    if (/roman|poésie|littérat|fiction|conte|théâtre|novel|poem/.test(text)) return 'Littérature';
    if (/histoire|history|afrique|coloni|africa/.test(text)) return 'Histoire';
    if (/math|algèbre|calcul|géométrie|statistique/.test(text)) return 'Mathématiques';
    if (/science|physique|chimie|biolog|physic|chemi/.test(text)) return 'Sciences';
    if (/philosophi|éthique|moral|ontolog/.test(text)) return 'Philosophie';
    return 'Autre';
  }

  getDiscoverColor(b: DiscoveredBook): string {
    const cat = this.guessCategory(b);
    return this.coverPalette[cat] ?? '#475569';
  }

  getDiscoverIcon(b: DiscoveredBook): string {
    return this.getCategoryIcon(this.guessCategory(b));
  }

  onUploadPdf(event: Event, bookId: number) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadMessage = 'Téléversement en cours…';
    this.uploadError = false;
    this.bookService.uploadPdf(bookId, file).subscribe({
      next: () => { this.uploadMessage = 'PDF ajouté avec succès !'; this.loadBooks(); },
      error: () => { this.uploadMessage = 'Erreur lors du téléversement.'; this.uploadError = true; }
    });
  }

  onUploadCover(event: Event, bookId: number) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadMessage = 'Téléversement en cours…';
    this.uploadError = false;
    this.bookService.uploadCover(bookId, file).subscribe({
      next: () => { this.uploadMessage = 'Couverture ajoutée avec succès !'; this.loadBooks(); },
      error: () => { this.uploadMessage = 'Erreur lors du téléversement.'; this.uploadError = true; }
    });
  }

  async deleteBook(id: number) {
    if (!(await this.dialogs.confirmDelete('ce livre de la bibliothèque'))) return;
    this.bookService.deleteBook(id).subscribe({
      next: () => {
        this.allBooks = this.allBooks.filter(b => b.id !== id);
        this.applyFilters();
        this.selectedBook = null;
      }
    });
  }
}
