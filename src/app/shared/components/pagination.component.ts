import { Component, ElementRef, Input, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';

/** État d'une liste paginée : page courante (à partir de 1) et taille de page. */
export class Pager {
  page = 1;
  /** Taille choisie pour cette liste (ex. 9 pour une grille de 3 colonnes), toujours proposée. */
  readonly initial: number;
  constructor(public size = 10) { this.initial = size; }

  /** Page effective : ramenée dans les bornes quand la liste rétrécit (recherche, filtre). */
  current(total: number): number {
    return Math.min(Math.max(1, this.page), Math.max(1, Math.ceil(total / this.size)));
  }

  /** À appeler quand la recherche ou les filtres changent : retour à la première page. */
  reset() { this.page = 1; }
}

/** Pagers par clé (ex. une liste par groupe de niveau), créés à la demande. */
export class PagerMap {
  private readonly pagers = new Map<string, Pager>();
  constructor(private size = 10) {}
  get(key: string): Pager {
    let p = this.pagers.get(key);
    if (!p) { p = new Pager(this.size); this.pagers.set(key, p); }
    return p;
  }
  resetAll() { this.pagers.forEach(p => p.reset()); }
}

/** Éléments de la page courante : « *ngFor="let x of liste | paginate: pager.page : pager.size" ». */
@Pipe({ name: 'paginate', standalone: true })
export class PaginatePipe implements PipeTransform {
  transform<T>(items: T[] | null | undefined, page: number, size: number): T[] {
    if (!items?.length) return [];
    const pages = Math.max(1, Math.ceil(items.length / size));
    const p = Math.min(Math.max(1, page), pages);
    return items.slice((p - 1) * size, p * size);
  }
}

/**
 * Pagination commune à toutes les listes : « 11–20 sur 57 », pages avec raccourcis, taille de page.
 * Masquée quand tout tient sur une page de la plus petite taille.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav *ngIf="total > options[0]" class="pager" aria-label="Pagination">
      <span class="pager-info">{{ from }}–{{ to }} sur {{ total }}</span>
      <div class="pager-pages">
        <button type="button" class="pager-btn" [disabled]="current === 1" (click)="go(current - 1)" aria-label="Page précédente">
          <i class="bi bi-chevron-left"></i></button>
        <ng-container *ngFor="let p of pages">
          <span *ngIf="p === 0" class="pager-gap">…</span>
          <button *ngIf="p > 0" type="button" class="pager-btn" [class.active]="p === current" (click)="go(p)"
                  [attr.aria-current]="p === current ? 'page' : null" [attr.aria-label]="'Page ' + p">{{ p }}</button>
        </ng-container>
        <button type="button" class="pager-btn" [disabled]="current === pageCount" (click)="go(current + 1)" aria-label="Page suivante">
          <i class="bi bi-chevron-right"></i></button>
      </div>
      <label class="pager-size">
        <span class="visually-hidden">Éléments par page</span>
        <select class="form-select form-select-sm" [value]="pager.size" (change)="resize($event)">
          <option *ngFor="let s of options" [value]="s" [selected]="s === pager.size">{{ s }} / page</option>
        </select>
      </label>
    </nav>
  `,
  styles: [`
    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; padding: .75rem .25rem; }
    .pager-info { font-size: .85rem; color: var(--muted); }
    .pager-pages { display: flex; align-items: center; gap: .3rem; flex-wrap: wrap; }
    .pager-btn {
      min-width: 36px; height: 36px; padding: 0 .5rem; border-radius: 10px; border: 1px solid var(--surface-border);
      background: var(--surface-raised); color: var(--dark); font-weight: 600; font-size: .85rem;
    }
    .pager-btn:hover:not(:disabled) { background: var(--primary-soft); }
    .pager-btn.active { background: var(--primary); border-color: var(--primary); color: #fff; }
    .pager-btn:disabled { opacity: .4; }
    .pager-gap { color: var(--muted); padding: 0 .2rem; }
    .pager-size select { width: auto; min-height: 36px; }
    @media (max-width: 575.98px) {
      .pager { justify-content: center; }
      .pager-info { width: 100%; text-align: center; }
      .pager-btn { min-width: 40px; height: 40px; }
    }
  `]
})
export class PaginationComponent {
  @Input({ required: true }) pager!: Pager;
  @Input() total = 0;
  @Input() sizes = [10, 20, 50];

  constructor(private host: ElementRef<HTMLElement>) {}

  /** Tailles proposées : celle de la liste et les tailles courantes, sans doublon. */
  get options(): number[] {
    return [...new Set([this.pager.initial, ...this.sizes])].sort((a, b) => a - b);
  }

  get pageCount(): number { return Math.max(1, Math.ceil(this.total / this.pager.size)); }
  get current(): number { return this.pager.current(this.total); }
  get from(): number { return this.total ? (this.current - 1) * this.pager.size + 1 : 0; }
  get to(): number { return Math.min(this.total, this.current * this.pager.size); }

  /** Numéros affichés : premières, autour de la page courante, dernières (0 = « … »). */
  get pages(): number[] {
    const n = this.pageCount, c = this.current;
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const set = new Set([1, n, c - 1, c, c + 1].filter(p => p >= 1 && p <= n));
    if (c <= 3) [2, 3, 4].forEach(p => set.add(p));
    if (c >= n - 2) [n - 3, n - 2, n - 1].forEach(p => set.add(p));
    const sorted = [...set].sort((a, b) => a - b);
    const out: number[] = [];
    sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push(0); out.push(p); });
    return out;
  }

  go(page: number) {
    this.pager.page = Math.min(Math.max(1, page), this.pageCount);
    this.revealListTop();
  }

  resize(e: Event) {
    const first = this.from;
    this.pager.size = Number((e.target as HTMLSelectElement).value);
    this.pager.page = Math.max(1, Math.ceil(first / this.pager.size));   // garder le même premier élément visible
  }

  /** Nouvelle page : on remonte au début de la liste si elle est hors de l'écran. */
  private revealListTop() {
    const list = this.host.nativeElement.parentElement;
    if (!list) return;
    setTimeout(() => {
      const top = list.getBoundingClientRect().top;
      if (top < 70) window.scrollBy({ top: top - 80, behavior: 'smooth' });
    });
  }
}
