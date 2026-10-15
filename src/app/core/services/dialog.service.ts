import { Injectable, InjectionToken, Type } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Données transmises à un écran ouvert dans une popup (ex. identifiant du devoir à modifier). */
export const DIALOG_DATA = new InjectionToken<any>('DIALOG_DATA');

export type DialogTone = 'primary' | 'danger' | 'success' | 'warning' | 'info';
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DialogOptions {
  title: string;
  message?: string;
  icon?: string;              // classe Bootstrap Icons, ex. 'bi-trash'
  tone?: DialogTone;
  confirmText?: string;
  cancelText?: string;
}

export interface PromptOptions extends DialogOptions {
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  readonly?: boolean;         // affichage d'un texte à copier
}

export interface ComponentDialogOptions {
  title?: string;
  icon?: string;
  size?: DialogSize;
  data?: unknown;
}

/** Référence vers une popup ouverte : l'écran hébergé l'utilise pour se fermer. */
export class DialogRef<R = unknown> {
  private resolve!: (value: R | undefined) => void;
  readonly afterClosed = new Promise<R | undefined>(r => (this.resolve = r));

  constructor(private readonly service: DialogService, readonly id: number) {}

  close(result?: R) {
    this.service.remove(this.id);
    this.resolve(result);
  }
}

export interface DialogState {
  id: number;
  kind: 'confirm' | 'alert' | 'prompt' | 'component';
  options: DialogOptions & Partial<PromptOptions> & ComponentDialogOptions;
  component?: Type<unknown>;
  ref: DialogRef<any>;
  value?: string;
}

export interface Toast {
  id: number;
  message: string;
  tone: DialogTone;
}

/**
 * Popups de l'application : confirmations, messages, saisies et écrans complets ouverts
 * sans quitter la page (remplace alert(), confirm() et prompt() du navigateur).
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly dialogs$ = new BehaviorSubject<DialogState[]>([]);
  readonly toasts$ = new BehaviorSubject<Toast[]>([]);
  private nextId = 1;

  confirm(options: DialogOptions): Promise<boolean> {
    const ref = this.push('confirm', { tone: 'primary', confirmText: 'Confirmer', cancelText: 'Annuler', ...options });
    return ref.afterClosed.then(r => r === true);
  }

  /** Confirmation de suppression, avec le style « danger ». */
  confirmDelete(what: string, message = 'Cette action est définitive.'): Promise<boolean> {
    return this.confirm({ title: `Supprimer ${what} ?`, message, icon: 'bi-trash3', tone: 'danger', confirmText: 'Supprimer' });
  }

  alert(options: DialogOptions | string): Promise<void> {
    const opts = typeof options === 'string' ? { title: options } : options;
    const ref = this.push('alert', { tone: 'info', confirmText: 'OK', ...opts });
    return ref.afterClosed.then(() => undefined);
  }

  prompt(options: PromptOptions): Promise<string | null> {
    const ref = this.push('prompt', { tone: 'primary', confirmText: 'Valider', cancelText: 'Annuler', ...options }, options.value ?? '');
    return ref.afterClosed.then(r => (typeof r === 'string' ? r : null));
  }

  /** Ouvre un écran complet (création, modification, détail) dans une popup. */
  open<R = unknown>(component: Type<unknown>, options: ComponentDialogOptions = {}): DialogRef<R> {
    const ref = new DialogRef<R>(this, this.nextId++);
    this.dialogs$.next([...this.dialogs$.value, { id: ref.id, kind: 'component', options: { size: 'lg', ...options } as any, component, ref }]);
    return ref;
  }

  /** Notification discrète en haut à droite, fermée automatiquement. */
  toast(message: string, tone: DialogTone = 'success', durationMs = 3500) {
    const toast = { id: this.nextId++, message, tone };
    this.toasts$.next([...this.toasts$.value, toast]);
    setTimeout(() => this.dismissToast(toast.id), durationMs);
  }

  dismissToast(id: number) {
    this.toasts$.next(this.toasts$.value.filter(t => t.id !== id));
  }

  remove(id: number) {
    this.dialogs$.next(this.dialogs$.value.filter(d => d.id !== id));
  }

  private push(kind: DialogState['kind'], options: DialogState['options'], value?: string): DialogRef<any> {
    const ref = new DialogRef<any>(this, this.nextId++);
    this.dialogs$.next([...this.dialogs$.value, { id: ref.id, kind, options, ref, value }]);
    return ref;
  }
}
