import { Component, HostListener, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef, DialogService, DialogState } from '../../core/services/dialog.service';
import { ScrollService } from '../../core/services/scroll.service';

/** Affiche les popups et notifications de l'application (une seule instance, dans AppComponent). */
@Component({
  selector: 'app-dialog-host',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngFor="let d of dialogs$ | async; let last = last" class="dlg-backdrop" (mousedown)="onBackdrop($event, d)">
      <div class="dlg" [ngClass]="'dlg-' + (d.options.size || (d.kind === 'component' ? 'lg' : 'sm'))"
           role="dialog" aria-modal="true" [attr.aria-labelledby]="'dlg-title-' + d.id" (mousedown)="$event.stopPropagation()">

        <!-- Écran complet hébergé -->
        <ng-container *ngIf="d.kind === 'component'">
          <div class="dlg-head">
            <h5 class="dlg-title" [id]="'dlg-title-' + d.id">
              <i *ngIf="d.options.icon" class="bi me-2" [ngClass]="d.options.icon"></i>{{ d.options.title }}
            </h5>
            <button type="button" class="btn-close" (click)="d.ref.close()" aria-label="Fermer"></button>
          </div>
          <div class="dlg-body dlg-scroll">
            <ng-container *ngComponentOutlet="d.component!; injector: injectorFor(d)"></ng-container>
          </div>
        </ng-container>

        <!-- Confirmation, message, saisie -->
        <ng-container *ngIf="d.kind !== 'component'">
          <div class="dlg-body text-center pt-4">
            <div class="dlg-icon" [ngClass]="'tone-' + d.options.tone">
              <i class="bi" [ngClass]="d.options.icon || defaultIcon(d)"></i>
            </div>
            <h5 class="dlg-title mt-3" [id]="'dlg-title-' + d.id">{{ d.options.title }}</h5>
            <p *ngIf="d.options.message" class="dlg-message">{{ d.options.message }}</p>

            <ng-container *ngIf="d.kind === 'prompt'">
              <textarea *ngIf="d.options.multiline || d.options.readonly" class="form-control font-monospace small text-start mt-2"
                        rows="8" [(ngModel)]="d.value" [readonly]="d.options.readonly" [placeholder]="d.options.placeholder || ''"
                        ></textarea>
              <input *ngIf="!d.options.multiline && !d.options.readonly" class="form-control mt-2" [(ngModel)]="d.value"
                     [placeholder]="d.options.placeholder || ''" (keydown.enter)="d.ref.close(d.value)">
            </ng-container>
          </div>
          <div class="dlg-foot">
            <button *ngIf="d.kind !== 'alert' && !d.options.readonly" type="button" class="btn btn-light" (click)="d.ref.close(d.kind === 'confirm' ? false : null)">
              {{ d.options.cancelText }}
            </button>
            <button *ngIf="d.options.readonly" type="button" class="btn btn-light" (click)="copy(d.value)">
              <i class="bi bi-clipboard me-1"></i>Copier
            </button>
            <button type="button" class="btn" [ngClass]="'btn-' + (d.options.tone === 'danger' ? 'danger' : 'primary')"
                    (click)="d.ref.close(d.kind === 'confirm' ? true : d.kind === 'prompt' ? d.value : undefined)">
              {{ d.options.readonly ? 'Fermer' : d.options.confirmText }}
            </button>
          </div>
        </ng-container>
      </div>
    </div>

    <!-- Notifications -->
    <div class="toast-stack" aria-live="polite">
      <div *ngFor="let t of toasts$ | async" class="toast-item" [ngClass]="'tone-' + t.tone">
        <i class="bi" [ngClass]="t.tone === 'danger' ? 'bi-x-circle-fill' : t.tone === 'warning' ? 'bi-exclamation-triangle-fill' : t.tone === 'info' ? 'bi-info-circle-fill' : 'bi-check-circle-fill'"></i>
        <span>{{ t.message }}</span>
        <button type="button" class="btn-close btn-close-sm ms-auto" (click)="dialogs.dismissToast(t.id)" aria-label="Fermer"></button>
      </div>
    </div>
  `,
  styles: [`
    .dlg-backdrop {
      position: fixed; inset: 0; z-index: 2500; background: rgba(6, 22, 61, .55); backdrop-filter: blur(3px);
      display: flex; align-items: flex-start; justify-content: center; padding: 6vh 16px; overflow-y: auto;
      animation: fade .15s ease-out;
    }
    .dlg {
      width: 100%; background: var(--surface); border-radius: 20px; box-shadow: 0 30px 70px rgba(6, 22, 61, .35);
      animation: pop .2s cubic-bezier(.2, .8, .2, 1); display: flex; flex-direction: column; max-height: 88vh;
    }
    .dlg-sm { max-width: 440px; }
    .dlg-md { max-width: 620px; }
    .dlg-lg { max-width: 920px; }
    .dlg-xl { max-width: 1180px; }
    .dlg-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 16px 22px; border-bottom: 1px solid #e5e7eb;
    }
    .dlg-title { font-weight: 800; margin: 0; color: #0f172a; font-size: 1.1rem; }
    .dlg-body { padding: 20px 22px; }
    .dlg-scroll { overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
    .dlg-backdrop { overscroll-behavior: contain; }
    .dlg-message { color: #64748b; margin: 8px 0 0; white-space: pre-line; }
    .dlg-foot { display: flex; justify-content: center; gap: 10px; padding: 0 22px 22px; }
    .dlg-foot .btn { min-width: 120px; border-radius: 12px; font-weight: 600; }
    .dlg-icon {
      width: 60px; height: 60px; border-radius: 18px; margin: 0 auto; display: flex; align-items: center; justify-content: center;
      font-size: 1.7rem;
    }
    .tone-primary { background: #eef0fb; color: #2b3ea8; }
    .tone-info { background: #e0f2fe; color: #0284c7; }
    .tone-success { background: #dcfce7; color: #16a34a; }
    .tone-warning { background: #fef3c7; color: #d97706; }
    .tone-danger { background: #fee2e2; color: #dc2626; }
    .toast-stack { position: fixed; top: 16px; right: 16px; z-index: 2600; display: flex; flex-direction: column; gap: 8px; max-width: min(380px, calc(100vw - 32px)); }
    .toast-item {
      display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; font-size: .9rem; font-weight: 500;
      box-shadow: 0 12px 30px rgba(15, 23, 42, .18); animation: slide .2s ease-out; color: #0f172a;
    }
    .toast-item.tone-success { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .toast-item.tone-danger { background: #fef2f2; border: 1px solid #fecaca; }
    .toast-item.tone-warning { background: #fffbeb; border: 1px solid #fde68a; }
    .toast-item.tone-info, .toast-item.tone-primary { background: #eef0fb; border: 1px solid #d5d9ef; }
    .toast-item > i { font-size: 1.1rem; }
    .toast-item.tone-success > i { color: #16a34a; }
    .toast-item.tone-danger > i { color: #dc2626; }
    .toast-item.tone-warning > i { color: #d97706; }
    .toast-item.tone-info > i, .toast-item.tone-primary > i { color: #2b3ea8; }
    /* Téléphone : feuille qui monte du bas, poignée, boutons pleine largeur ; messages en haut, sous l'encoche */
    @media (max-width: 767.98px) {
      .dlg-backdrop { align-items: flex-end; padding: 0; }
      .dlg, .dlg-sm, .dlg-md, .dlg-lg, .dlg-xl {
        max-width: none; border-radius: 22px 22px 0 0; max-height: calc(94dvh - env(safe-area-inset-top, 0px));
        padding-bottom: env(safe-area-inset-bottom, 0px); animation: sheet .28s cubic-bezier(.2, .8, .2, 1);
      }
      .dlg::before { content: ''; display: block; width: 40px; height: 5px; border-radius: 3px; background: #cbd5e1; margin: 8px auto 0; flex-shrink: 0; }
      .dlg-head { padding: 10px 16px 12px; }
      .dlg-body { padding: 16px; }
      .dlg-foot { flex-direction: column-reverse; padding: 0 16px 16px; }
      .dlg-foot .btn { width: 100%; min-height: 48px; }
      .toast-stack { top: calc(env(safe-area-inset-top, 0px) + 64px); left: 12px; right: 12px; max-width: none; }
    }
    @keyframes sheet { from { transform: translateY(100%); } to { transform: none; } }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pop { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
    @keyframes slide { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: none; } }
  `]
})
export class DialogHostComponent {
  readonly dialogs$ = this.dialogs.dialogs$;
  readonly toasts$ = this.dialogs.toasts$;
  private injectors = new Map<number, Injector>();

  private locked = false;

  constructor(public dialogs: DialogService, private injector: Injector, scroll: ScrollService) {
    // Popup ouverte : la page derrière ne défile plus ; fermée : on retrouve la même position
    this.dialogs.dialogs$.subscribe(list => {
      if (list.length && !this.locked) { scroll.lock(); this.locked = true; }
      else if (!list.length && this.locked) { scroll.unlock(); this.locked = false; }
    });
  }

  injectorFor(d: DialogState): Injector {
    let inj = this.injectors.get(d.id);
    if (!inj) {
      inj = Injector.create({
        providers: [
          { provide: DIALOG_DATA, useValue: d.options.data ?? null },
          { provide: DialogRef, useValue: d.ref }
        ],
        parent: this.injector
      });
      this.injectors.set(d.id, inj);
      d.ref.afterClosed.then(() => this.injectors.delete(d.id));
    }
    return inj;
  }

  defaultIcon(d: DialogState): string {
    switch (d.options.tone) {
      case 'danger': return 'bi-exclamation-octagon';
      case 'warning': return 'bi-exclamation-triangle';
      case 'success': return 'bi-check2-circle';
      case 'info': return 'bi-info-circle';
      default: return d.kind === 'prompt' ? 'bi-pencil-square' : 'bi-question-circle';
    }
  }

  onBackdrop(event: MouseEvent, d: DialogState) {
    // Les écrans complets ne se ferment pas au clic extérieur (saisie en cours)
    if (d.kind === 'alert') d.ref.close();
    else if (d.kind === 'confirm') d.ref.close(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    const list = this.dialogs$.value;
    const top = list[list.length - 1];
    if (!top) return;
    if (top.kind === 'confirm') top.ref.close(false);
    else if (top.kind === 'prompt') top.ref.close(null);
    else top.ref.close();
  }

  copy(value?: string) {
    navigator.clipboard?.writeText(value || '').then(() => this.dialogs.toast('Copié dans le presse-papiers'));
  }
}
