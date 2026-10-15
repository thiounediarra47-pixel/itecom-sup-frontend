import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BarDatum { label: string; value: number; }

/**
 * Graphique à barres simple (une seule série), horizontal ou vertical,
 * avec infobulle au survol/focus et vue tableau.
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bc" [class.bc-empty]="!data.length">
      <div *ngIf="!data.length" class="bc-empty-msg">{{ emptyText }}</div>

      <ng-container *ngIf="data.length && !showTable">
        <!-- Horizontal -->
        <div *ngIf="orientation === 'horizontal'" class="bc-h">
          <div *ngFor="let d of data; let i = index" class="bc-h-row"
               tabindex="0" (mouseenter)="hover = i" (mouseleave)="hover = -1"
               (focus)="hover = i" (blur)="hover = -1">
            <div class="bc-h-label" [title]="d.label">{{ d.label }}</div>
            <div class="bc-h-track">
              <div class="bc-h-bar" [class.bc-active]="hover === i"
                   [style.width.%]="pct(d.value)"></div>
              <span class="bc-h-value">{{ format(d.value) }}</span>
              <div *ngIf="hover === i" class="bc-tip" [style.left.%]="Math.min(pct(d.value), 70)">
                <strong>{{ format(d.value) }}</strong><span>{{ d.label }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Vertical -->
        <div *ngIf="orientation === 'vertical'" class="bc-v">
          <div class="bc-v-axis">
            <span *ngFor="let t of ticksDesc">{{ format(t) }}</span>
          </div>
          <div class="bc-v-plot">
            <div class="bc-v-grid">
              <div *ngFor="let t of ticksDesc" class="bc-v-gridline"></div>
            </div>
            <div class="bc-v-bars">
              <div *ngFor="let d of data; let i = index" class="bc-v-col"
                   tabindex="0" (mouseenter)="hover = i" (mouseleave)="hover = -1"
                   (focus)="hover = i" (blur)="hover = -1">
                <div class="bc-v-bar" [class.bc-active]="hover === i"
                     [style.height.%]="pct(d.value)"></div>
                <div *ngIf="hover === i" class="bc-tip bc-tip-v" [style.bottom.%]="Math.min(pct(d.value), 80)">
                  <strong>{{ format(d.value) }}</strong><span>{{ d.label }}</span>
                </div>
              </div>
            </div>
            <div class="bc-v-labels">
              <span *ngFor="let d of data" [title]="d.label">{{ d.label }}</span>
            </div>
          </div>
        </div>
      </ng-container>

      <table *ngIf="data.length && showTable" class="table table-sm mb-0 bc-table">
        <thead><tr><th>{{ labelHeader }}</th><th class="text-end">{{ valueHeader }}</th></tr></thead>
        <tbody>
          <tr *ngFor="let d of data"><td>{{ d.label }}</td><td class="text-end">{{ format(d.value) }}</td></tr>
        </tbody>
      </table>

      <button *ngIf="data.length" type="button" class="bc-toggle" (click)="showTable = !showTable">
        <i class="bi" [ngClass]="showTable ? 'bi-bar-chart' : 'bi-table'"></i>
        {{ showTable ? 'Voir le graphique' : 'Voir le tableau' }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; --bc-bar: #3b4fb8; --bc-bar-hover: #5567cc; --bc-ink: #1f2a5c; --bc-muted: #6b7280; --bc-grid: #eceef3; }
    .bc { position: relative; }
    .bc-empty-msg { color: var(--bc-muted); text-align: center; padding: 2.5rem 0; font-size: .9rem; }

    .bc-h { display: flex; flex-direction: column; gap: 10px; }
    .bc-h-row { display: grid; grid-template-columns: minmax(90px, 34%) 1fr; align-items: center; gap: 12px; outline: none; }
    .bc-h-row:focus-visible .bc-h-bar { outline: 2px solid var(--bc-ink); outline-offset: 2px; }
    .bc-h-label { font-size: .85rem; color: var(--bc-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
    .bc-h-track { position: relative; display: flex; align-items: center; gap: 8px; height: 26px; }
    .bc-h-bar { height: 22px; min-width: 2px; background: var(--bc-bar); border-radius: 0 4px 4px 0; transition: width .4s ease, background .15s; }
    .bc-h-value { font-size: .82rem; font-weight: 600; color: var(--bc-ink); font-variant-numeric: tabular-nums; }

    .bc-v { display: grid; grid-template-columns: auto 1fr; gap: 8px; }
    .bc-v-axis { display: flex; flex-direction: column; justify-content: space-between; height: 200px; font-size: .75rem; color: var(--bc-muted); text-align: right; font-variant-numeric: tabular-nums; transform: translateY(-.45em); }
    .bc-v-plot { position: relative; min-width: 0; }
    .bc-v-grid { position: absolute; inset: 0 0 auto 0; height: 200px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
    .bc-v-gridline { border-top: 1px solid var(--bc-grid); }
    .bc-v-gridline:last-child { border-top-color: #c9cdd8; }
    .bc-v-bars { position: relative; height: 200px; display: flex; align-items: flex-end; gap: 2px; }
    .bc-v-col { position: relative; flex: 1; height: 100%; display: flex; align-items: flex-end; justify-content: center; outline: none; cursor: default; }
    .bc-v-col:focus-visible .bc-v-bar { outline: 2px solid var(--bc-ink); outline-offset: 2px; }
    .bc-v-bar { width: min(64%, 72px); min-height: 2px; background: var(--bc-bar); border-radius: 4px 4px 0 0; transition: height .4s ease, background .15s; }
    .bc-v-labels { display: flex; gap: 2px; margin-top: 8px; }
    .bc-v-labels span { flex: 1; min-width: 0; text-align: center; font-size: .75rem; color: var(--bc-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px; }

    .bc-active { background: var(--bc-bar-hover); }
    .bc-tip { position: absolute; top: -38px; z-index: 5; background: #1f2a5c; color: #fff; border-radius: 6px; padding: 4px 8px; font-size: .75rem; white-space: nowrap; pointer-events: none; display: flex; gap: 6px; align-items: baseline; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
    .bc-tip strong { font-size: .85rem; }
    .bc-tip span { opacity: .8; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
    .bc-tip-v { top: auto; left: 50%; transform: translate(-50%, -8px); margin-bottom: 0; }

    .bc-table th { font-size: .78rem; color: var(--bc-muted); font-weight: 600; }
    .bc-table td { font-size: .85rem; font-variant-numeric: tabular-nums; }
    .bc-toggle { margin-top: 12px; border: 0; background: none; padding: 0; font-size: .78rem; color: var(--bc-muted); }
    .bc-toggle:hover { color: var(--bc-ink); text-decoration: underline; }
  `]
})
export class BarChartComponent {
  @Input() data: BarDatum[] = [];
  @Input() orientation: 'horizontal' | 'vertical' = 'horizontal';
  @Input() unit = '';
  @Input() emptyText = 'Aucune donnée pour cette période';
  @Input() labelHeader = 'Libellé';
  @Input() valueHeader = 'Valeur';
  /** Maximum fixe de l'échelle (ex. 100 pour des pourcentages) */
  @Input() maxValue: number | null = null;

  hover = -1;
  showTable = false;
  readonly Math = Math;

  get scaleMax(): number {
    if (this.maxValue) return this.maxValue;
    const max = Math.max(0, ...this.data.map(d => d.value));
    return this.orientation === 'vertical' ? niceMax(max) : (max || 1);
  }

  get ticksDesc(): number[] {
    const max = this.scaleMax;
    return [4, 3, 2, 1, 0].map(i => Math.round((max * i / 4) * 100) / 100);
  }

  pct(value: number): number {
    return Math.max(0, Math.min(100, (value / this.scaleMax) * 100));
  }

  format(value: number): string {
    const n = Number.isInteger(value) ? value.toString() : value.toFixed(1).replace('.', ',');
    return this.unit ? `${n}${this.unit}` : n;
  }
}

function niceMax(max: number): number {
  if (max <= 0) return 4;
  const step = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(step)));
  const nice = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step) || 10 * mag;
  return Math.max(nice * 4, 4);
}
