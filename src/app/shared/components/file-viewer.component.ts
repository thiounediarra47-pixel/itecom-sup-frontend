import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DIALOG_DATA } from '../../core/services/dialog.service';

export interface FileViewerData {
  url: string;
  name?: string;
  kind?: 'image' | 'pdf';   // pour une adresse sans extension (ex. blob: d'un PDF protégé)
}

/** Visionneuse de fichier (image, PDF) ouverte dans une popup, sans quitter la page. */
@Component({
  selector: 'app-file-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="viewer-bar">
      <span class="text-muted small text-truncate"><i class="bi me-1" [ngClass]="kind === 'pdf' ? 'bi-file-earmark-pdf' : kind === 'image' ? 'bi-file-earmark-image' : 'bi-file-earmark'"></i>{{ name }}</span>
      <div class="d-flex gap-2">
        <ng-container *ngIf="kind === 'image'">
          <button type="button" class="btn btn-sm btn-light" (click)="zoom = Math.max(0.5, zoom - 0.25)" aria-label="Zoom arrière"><i class="bi bi-zoom-out"></i></button>
          <button type="button" class="btn btn-sm btn-light" (click)="zoom = 1" aria-label="Taille réelle">{{ (zoom * 100) | number:'1.0-0' }} %</button>
          <button type="button" class="btn btn-sm btn-light" (click)="zoom = Math.min(4, zoom + 0.25)" aria-label="Zoom avant"><i class="bi bi-zoom-in"></i></button>
          <button type="button" class="btn btn-sm btn-light" (click)="rotation = (rotation + 90) % 360" aria-label="Pivoter"><i class="bi bi-arrow-clockwise"></i></button>
        </ng-container>
        <a class="btn btn-sm btn-outline-secondary" [href]="data.url" [attr.download]="name">
          <i class="bi bi-download me-1"></i>Télécharger
        </a>
      </div>
    </div>

    <div class="viewer-body" [class.dark]="kind === 'image'">
      <img *ngIf="kind === 'image'" [src]="data.url" [alt]="name"
           [style.transform]="'scale(' + zoom + ') rotate(' + rotation + 'deg)'">
      <iframe *ngIf="kind === 'pdf'" [src]="safeUrl" [title]="name"></iframe>
      <div *ngIf="kind === 'other'" class="text-center text-muted py-5">
        <i class="bi bi-file-earmark" style="font-size:3rem"></i>
        <p class="mt-2 mb-3">Aperçu indisponible pour ce type de fichier.</p>
        <a class="btn btn-primary" [href]="data.url" [attr.download]="name"><i class="bi bi-download me-1"></i>Télécharger le fichier</a>
      </div>
    </div>
  `,
  styles: [`
    .viewer-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
    .viewer-body { border-radius: 12px; overflow: auto; background: var(--surface-muted); height: 70vh; display: flex; align-items: flex-start; justify-content: center; }
    .viewer-body.dark { background: #1f2937; align-items: center; }
    .viewer-body img { max-width: 100%; max-height: 100%; object-fit: contain; transition: transform .2s ease; transform-origin: center; }
    .viewer-body iframe { width: 100%; height: 100%; border: 0; background: var(--surface); }
  `]
})
export class FileViewerComponent {
  readonly Math = Math;
  readonly kind: 'image' | 'pdf' | 'other';
  readonly name: string;
  readonly safeUrl: SafeResourceUrl;
  zoom = 1;
  rotation = 0;

  constructor(@Inject(DIALOG_DATA) public data: FileViewerData, sanitizer: DomSanitizer) {
    const path = (data.url || '').split('?')[0].toLowerCase();
    this.kind = data.kind ?? (/\.(png|jpe?g|gif|webp|bmp|heic)$/.test(path) ? 'image' : path.endsWith('.pdf') ? 'pdf' : 'other');
    this.name = data.name || decodeURIComponent(path.substring(path.lastIndexOf('/') + 1)) || 'Fichier';
    this.safeUrl = sanitizer.bypassSecurityTrustResourceUrl(data.url);
  }
}
