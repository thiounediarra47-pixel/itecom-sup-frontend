import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstallService } from '../../core/services/install.service';
import { DialogService } from '../../core/services/dialog.service';

/** Proposition d'installer ITECOM sur l'écran d'accueil du téléphone (au-dessus de la barre d'onglets). */
@Component({
  selector: 'app-install-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="install-banner d-md-none" role="dialog" aria-label="Installer l'application">
      <img src="assets/icons/icon-192.png" alt="" width="40" height="40">
      <div class="flex-grow-1 small">
        <div class="fw-bold">Installer ITECOM</div>
        <div class="text-muted">Accès rapide depuis l'écran d'accueil, cours disponibles sans internet.</div>
      </div>
      <button type="button" class="btn btn-sm btn-primary" (click)="install()">Installer</button>
      <button type="button" class="btn-close" aria-label="Plus tard" (click)="close()"></button>
    </div>
  `,
  styles: [`
    .install-banner {
      position: fixed; left: 10px; right: 10px; z-index: 99;
      bottom: calc(var(--tabbar-height) + var(--safe-bottom) + 10px);
      display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 16px;
      background: var(--surface-raised); border: 1px solid var(--surface-border); box-shadow: 0 10px 30px rgba(15, 23, 42, .18);
      animation: up .25s ease-out;
    }
    .install-banner img { border-radius: 10px; }
    @keyframes up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  `]
})
export class InstallBannerComponent {
  private closed = false;

  constructor(public installer: InstallService, private dialogs: DialogService) {}

  get visible(): boolean { return !this.closed && this.installer.shouldOffer; }

  async install() {
    if (this.installer.canPrompt) {
      if (await this.installer.install()) this.closed = true;
      return;
    }
    // iPhone : pas d'installation automatique dans Safari
    await this.dialogs.alert({
      title: 'Installer ITECOM sur l\'iPhone', icon: 'bi-phone', tone: 'primary', confirmText: 'Compris',
      message: '1. Dans Safari, touchez le bouton Partager (carré avec une flèche vers le haut).\n'
        + '2. Choisissez « Sur l\'écran d\'accueil ».\n3. Touchez « Ajouter ».\n\n'
        + 'ITECOM s\'ouvrira alors en plein écran, comme une application, même sans internet.'
    });
  }

  close() {
    this.closed = true;
    this.installer.dismiss();
  }
}
