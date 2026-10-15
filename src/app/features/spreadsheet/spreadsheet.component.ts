import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CourseService } from '../../core/services/course.service';
import { ProgressService } from '../../core/services/progress.service';
import { Lesson } from '../../core/models/course.model';
import { DialogService } from '../../core/services/dialog.service';

type CellFormat = 'none' | 'number' | 'currency' | 'percent';

interface Cell {
  raw: string;
  bold?: boolean;
  format?: CellFormat;
}

interface TemplateDef {
  label: string;
  cells: Record<string, Partial<Cell>>;
}

type Token = { type: 'num' | 'ref' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'colon'; value: string };

@Component({
  selector: 'app-spreadsheet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="fade-in-up">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-bar-chart me-1"></i>Tableur</h1>
          <p class="text-muted small">Pratiquez vos calculs comptables avec un tableur intégré (formules type Excel)</p>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <select class="form-select form-select-sm" style="width:220px" [(ngModel)]="selectedTemplate" (change)="applyTemplate(selectedTemplate)">
            <option value="">— Charger un modèle —</option>
            <option *ngFor="let t of templateKeys" [value]="t">{{ templates[t].label }}</option>
          </select>
          <button class="btn btn-outline-secondary btn-sm" (click)="resetGridConfirm()">
            <i class="bi bi-trash me-1"></i>Effacer tout
          </button>
        </div>
      </div>

      <div class="d-flex gap-3">
        <!-- Exercise panel -->
        <div *ngIf="exercise" class="exercise-panel">
          <div class="card border-0 shadow-sm h-100" style="border-radius:12px">
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge bg-primary"><i class="bi bi-table me-1"></i>Exercice Excel</span>
                <span *ngIf="exercise.completed" class="badge bg-success">
                  <i class="bi bi-check-circle me-1"></i>Terminé
                </span>
              </div>
              <h5 class="fw-bold">{{ exercise.title }}</h5>
              <div class="text-muted small mb-3" style="white-space: pre-wrap;">{{ exercise.description }}</div>

              <div class="mt-auto d-flex flex-column gap-2">
                <button *ngIf="!exercise.completed" class="btn btn-success btn-sm" (click)="markComplete()" [disabled]="markingComplete">
                  <span *ngIf="markingComplete" class="spinner-border spinner-border-sm me-2"></span>
                  <i *ngIf="!markingComplete" class="bi bi-check-circle me-1"></i>Marquer comme terminé
                </button>
                <a *ngIf="exercise.courseId" [routerLink]="['/courses', exercise.courseId, 'learn']" class="btn btn-outline-secondary btn-sm">
                  <i class="bi bi-arrow-left me-1"></i>Retour au cours
                </a>
                <a *ngIf="!exercise.courseId" routerLink="/exercises" class="btn btn-outline-secondary btn-sm">
                  <i class="bi bi-arrow-left me-1"></i>Retour aux cas pratiques
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Spreadsheet -->
        <div class="flex-grow-1" style="min-width:0">
          <!-- Toolbar -->
          <div class="toolbar d-flex align-items-center gap-2 mb-2 p-2 rounded-3" style="background:#f1f5f9">
            <span class="badge bg-secondary" style="min-width:50px">{{ getCellLabel(selected.row, selected.col) }}</span>
            <input class="form-control form-control-sm" style="max-width:380px"
                   [value]="grid[selected.row][selected.col].raw"
                   (input)="onFormulaBarInput($event)"
                   placeholder="Valeur ou formule, ex: =SOMME(A1:A5)">
            <button class="btn btn-sm" [class.btn-primary]="grid[selected.row][selected.col].bold" [class.btn-outline-secondary]="!grid[selected.row][selected.col].bold"
                    (click)="toggleBold()" title="Gras">
              <i class="bi bi-type-bold"></i>
            </button>
            <select class="form-select form-select-sm" style="width:160px"
                    [ngModel]="grid[selected.row][selected.col].format || 'none'" (ngModelChange)="setFormat($event)">
              <option value="none">Standard</option>
              <option value="number">Nombre (2 déc.)</option>
              <option value="currency">Devise (€)</option>
              <option value="percent">Pourcentage</option>
            </select>
            <button class="btn btn-sm btn-outline-secondary" (click)="clearSelectedCell()" title="Effacer la cellule">
              <i class="bi bi-eraser"></i>
            </button>
            <div class="ms-auto d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" (click)="exportCSV()"><i class="bi bi-download me-1"></i>CSV</button>
              <button class="btn btn-sm btn-outline-secondary" (click)="exportJSON()"><i class="bi bi-cloud-arrow-up me-1"></i>Exporter</button>
              <button class="btn btn-sm btn-outline-secondary" (click)="importJSON()"><i class="bi bi-cloud-arrow-down me-1"></i>Importer</button>
            </div>
          </div>

          <!-- Grid -->
          <div class="sheet-wrapper">
            <table class="sheet-table">
              <thead>
                <tr>
                  <th class="corner"></th>
                  <th *ngFor="let col of colLabels; let c = index" [class.selected-header]="selected.col === c">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of grid; let r = index">
                  <th class="row-header" [class.selected-header]="selected.row === r">{{ r + 1 }}</th>
                  <td *ngFor="let cell of row; let c = index" [class.selected]="selected.row === r && selected.col === c">
                    <input
                      [id]="'cell_' + r + '_' + c"
                      class="cell-input"
                      [class.fw-bold]="cell.bold"
                      [class.text-end]="isNumericResult(r, c)"
                      [class.text-danger]="isErrorResult(r, c)"
                      [value]="getDisplayValue(r, c)"
                      (focus)="selectCell(r, c)"
                      (input)="onCellInput(r, c, $event)"
                      (keydown)="onCellKeydown(r, c, $event)"
                      spellcheck="false" autocomplete="off">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Help -->
          <div class="card border-0 bg-light mt-3" style="border-radius:12px">
            <div class="card-body p-3">
              <h6 class="fw-bold mb-2"><i class="bi bi-info-circle text-primary me-2"></i>Formules disponibles</h6>
              <div class="small text-muted">
                <div>Commencez une formule par <code>=</code>. Exemples : <code>=A1+B2</code>, <code>=A1*0.18</code>, <code>=SOMME(A1:A5)</code></div>
                <div>Utilisez le point <code>.</code> pour les décimales dans les formules (ex: <code>0.18</code>). La virgule reste possible pour saisir un nombre simple dans une cellule.</div>
                <div class="d-flex flex-wrap gap-3 mt-1">
                  <span><code>SOMME / SUM</code> : addition d'une plage</span>
                  <span><code>MOYENNE / AVERAGE</code> : moyenne</span>
                  <span><code>MIN</code> / <code>MAX</code></span>
                  <span><code>NB / COUNT</code> : nombre de valeurs</span>
                  <span><code>ARRONDI / ROUND</code> : arrondi (valeur, décimales)</span>
                  <span><code>ABS</code> : valeur absolue</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .exercise-panel { width: 320px; flex-shrink: 0; }
    .sheet-wrapper { overflow: auto; border: 1px solid #d1d5db; border-radius: 8px; max-height: calc(100vh - 380px); min-height: 350px; }
    .sheet-table { border-collapse: collapse; width: 100%; }
    .sheet-table th { background: #f1f5f9; border: 1px solid #d1d5db; padding: 4px; text-align: center; min-width: 130px; font-size: 0.8rem; font-weight: 600; color: #475569; position: sticky; top: 0; z-index: 1; }
    .sheet-table th.row-header { min-width: 40px; position: sticky; left: 0; z-index: 2; }
    .sheet-table th.corner { min-width: 40px; position: sticky; left: 0; top: 0; z-index: 3; }
    .sheet-table th.selected-header { background: #d5d9ef; color: #1e1b4b; }
    .sheet-table td { border: 1px solid #e2e8f0; padding: 0; min-width: 130px; }
    .sheet-table td.selected { outline: 2px solid #2b3ea8; outline-offset: -2px; }
    .cell-input { width: 100%; height: 30px; border: none; outline: none; padding: 2px 6px; font-size: 0.85rem; background: transparent; }
    .cell-input:focus { background: #eef0fb; }
    @media(max-width: 992px) { .d-flex.gap-3 { flex-direction: column; } .exercise-panel { width: 100%; } }
  `]
})
export class SpreadsheetComponent implements OnInit {
  readonly ROWS = 25;
  readonly COLS = 10;
  colLabels = Array.from({ length: this.COLS }, (_, i) => String.fromCharCode(65 + i));

  grid: Cell[][] = this.createEmptyGrid();
  computedGrid: (number | string)[][] = this.createEmptyComputed();
  selected = { row: 0, col: 0 };
  selectedTemplate = '';

  exercise: Lesson | null = null;
  markingComplete = false;

  private evaluating = new Set<string>();
  private tokens: Token[] = [];
  private pos = 0;

  templates: Record<string, TemplateDef> = {
    facture: {
      label: 'Facture',
      cells: {
        A1: { raw: 'FACTURE', bold: true },
        A3: { raw: 'Désignation', bold: true },
        B3: { raw: 'Quantité', bold: true },
        C3: { raw: 'Prix unitaire', bold: true },
        D3: { raw: 'Total', bold: true },
        A4: { raw: 'Ordinateur portable' }, B4: { raw: '2' }, C4: { raw: '450', format: 'currency' }, D4: { raw: '=B4*C4', format: 'currency' },
        A5: { raw: 'Souris sans fil' }, B5: { raw: '5' }, C5: { raw: '15', format: 'currency' }, D5: { raw: '=B5*C5', format: 'currency' },
        A6: { raw: 'Clavier' }, B6: { raw: '3' }, C6: { raw: '25', format: 'currency' }, D6: { raw: '=B6*C6', format: 'currency' },
        A9: { raw: 'Total HT', bold: true }, D9: { raw: '=SOMME(D4:D6)', bold: true, format: 'currency' },
        A10: { raw: 'TVA (18%)' }, D10: { raw: '=D9*0.18', format: 'currency' },
        A11: { raw: 'Total TTC', bold: true }, D11: { raw: '=D9+D10', bold: true, format: 'currency' }
      }
    },
    balance: {
      label: 'Balance de vérification',
      cells: {
        A1: { raw: 'N° Compte', bold: true }, B1: { raw: 'Intitulé du compte', bold: true }, C1: { raw: 'Débit', bold: true }, D1: { raw: 'Crédit', bold: true },
        A2: { raw: '601' }, B2: { raw: 'Achats de marchandises' }, C2: { raw: '150000', format: 'currency' },
        A3: { raw: '401' }, B3: { raw: 'Fournisseurs' }, D3: { raw: '150000', format: 'currency' },
        A4: { raw: '512' }, B4: { raw: 'Banque' }, C4: { raw: '500000', format: 'currency' },
        A5: { raw: '701' }, B5: { raw: 'Ventes de marchandises' }, D5: { raw: '500000', format: 'currency' },
        A7: { raw: 'TOTAL', bold: true }, C7: { raw: '=SOMME(C2:C6)', bold: true, format: 'currency' }, D7: { raw: '=SOMME(D2:D6)', bold: true, format: 'currency' }
      }
    },
    resultat: {
      label: 'Compte de résultat',
      cells: {
        A1: { raw: 'CHARGES', bold: true }, B1: { raw: 'Montant', bold: true }, D1: { raw: 'PRODUITS', bold: true }, E1: { raw: 'Montant', bold: true },
        A2: { raw: 'Achats consommés' }, B2: { raw: '200000', format: 'currency' },
        A3: { raw: 'Charges de personnel' }, B3: { raw: '150000', format: 'currency' },
        A4: { raw: 'Charges financières' }, B4: { raw: '10000', format: 'currency' },
        D2: { raw: 'Ventes de marchandises' }, E2: { raw: '500000', format: 'currency' },
        D3: { raw: 'Production vendue' }, E3: { raw: '50000', format: 'currency' },
        A6: { raw: 'Total des charges', bold: true }, B6: { raw: '=SOMME(B2:B5)', bold: true, format: 'currency' },
        D6: { raw: 'Total des produits', bold: true }, E6: { raw: '=SOMME(E2:E5)', bold: true, format: 'currency' },
        A8: { raw: 'Résultat net (Produits - Charges)', bold: true }, B8: { raw: '=E6-B6', bold: true, format: 'currency' }
      }
    },
    journal: {
      label: 'Journal comptable',
      cells: {
        A1: { raw: 'Date', bold: true }, B1: { raw: 'N° Compte', bold: true }, C1: { raw: 'Libellé', bold: true }, D1: { raw: 'Débit', bold: true }, E1: { raw: 'Crédit', bold: true },
        A2: { raw: '01/01/2026' }, B2: { raw: '512' }, C2: { raw: 'Apport en capital' }, D2: { raw: '1000000', format: 'currency' },
        A3: { raw: '01/01/2026' }, B3: { raw: '101' }, C3: { raw: 'Capital social' }, E3: { raw: '1000000', format: 'currency' },
        A5: { raw: 'Totaux', bold: true }, D5: { raw: '=SOMME(D2:D4)', bold: true, format: 'currency' }, E5: { raw: '=SOMME(E2:E4)', bold: true, format: 'currency' }
      }
    }
  };
  templateKeys = Object.keys(this.templates);

  constructor(private dialogs: DialogService, 
    private courseService: CourseService,
    private progressService: ProgressService,
    private route: ActivatedRoute
  ) {
    this.recompute();
  }

  ngOnInit() {
    const lessonId = this.route.snapshot.queryParamMap.get('lessonId');
    if (lessonId) {
      this.courseService.getLessonById(+lessonId).subscribe(lesson => {
        this.exercise = lesson;
        if (lesson.starterCode?.trim()) {
          this.loadGridFromData(lesson.starterCode);
        }
      });
    }
  }

  // ---------- Grid helpers ----------
  private createEmptyGrid(): Cell[][] {
    return Array.from({ length: this.ROWS }, () => Array.from({ length: this.COLS }, () => ({ raw: '' } as Cell)));
  }

  private createEmptyComputed(): (number | string)[][] {
    return Array.from({ length: this.ROWS }, () => Array.from({ length: this.COLS }, () => ''));
  }

  getCellLabel(r: number, c: number): string {
    return `${this.colLabels[c]}${r + 1}`;
  }

  selectCell(r: number, c: number) {
    this.selected = { row: r, col: c };
  }

  isNumericResult(r: number, c: number): boolean {
    return typeof this.computedGrid[r][c] === 'number';
  }

  isErrorResult(r: number, c: number): boolean {
    const v = this.computedGrid[r][c];
    return v === '#ERREUR' || v === '#CIRC';
  }

  getDisplayValue(r: number, c: number): string {
    if (this.selected.row === r && this.selected.col === c) {
      return this.grid[r][c].raw;
    }
    return this.formatCellValue(r, c);
  }

  private formatCellValue(r: number, c: number): string {
    const computed = this.computedGrid[r][c];
    if (typeof computed !== 'number') return String(computed ?? '');
    const format = this.grid[r][c].format;
    switch (format) {
      case 'currency': return computed.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
      case 'percent': return (computed * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' %';
      case 'number': return computed.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      default: return String(computed);
    }
  }

  // ---------- Editing ----------
  onCellInput(r: number, c: number, event: Event) {
    this.grid[r][c].raw = (event.target as HTMLInputElement).value;
    this.recompute();
  }

  onFormulaBarInput(event: Event) {
    this.grid[this.selected.row][this.selected.col].raw = (event.target as HTMLInputElement).value;
    this.recompute();
  }

  onCellKeydown(r: number, c: number, event: KeyboardEvent) {
    let target: { row: number; col: number } | null = null;
    if (event.key === 'Enter') target = { row: Math.min(r + 1, this.ROWS - 1), col: c };
    else if (event.key === 'Tab') { event.preventDefault(); target = { row: r, col: Math.min(c + 1, this.COLS - 1) }; }
    else if (event.key === 'ArrowDown') target = { row: Math.min(r + 1, this.ROWS - 1), col: c };
    else if (event.key === 'ArrowUp') target = { row: Math.max(r - 1, 0), col: c };
    else if (event.key === 'ArrowRight' && (event.target as HTMLInputElement).selectionStart === (event.target as HTMLInputElement).value.length) target = { row: r, col: Math.min(c + 1, this.COLS - 1) };
    else if (event.key === 'ArrowLeft' && (event.target as HTMLInputElement).selectionStart === 0) target = { row: r, col: Math.max(c - 1, 0) };

    if (target) {
      event.preventDefault();
      this.focusCell(target.row, target.col);
    }
  }

  private focusCell(r: number, c: number) {
    this.selectCell(r, c);
    setTimeout(() => {
      const el = document.getElementById(`cell_${r}_${c}`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  }

  toggleBold() {
    const cell = this.grid[this.selected.row][this.selected.col];
    cell.bold = !cell.bold;
  }

  setFormat(format: CellFormat) {
    this.grid[this.selected.row][this.selected.col].format = format;
  }

  clearSelectedCell() {
    this.grid[this.selected.row][this.selected.col] = { raw: '' };
    this.recompute();
  }

  async resetGridConfirm() {
    if (!(await this.dialogs.confirm({ title: 'Effacer toute la feuille ?', message: 'Toutes les cellules seront vidées.', icon: 'bi-eraser', tone: 'danger', confirmText: 'Effacer' }))) return;
    this.selectedTemplate = '';
    this.resetGrid();
  }

  resetGrid() {
    this.grid = this.createEmptyGrid();
    this.recompute();
  }

  applyTemplate(key: string) {
    if (!key) return;
    this.resetGrid();
    const tpl = this.templates[key];
    for (const [ref, data] of Object.entries(tpl.cells)) {
      const pos = this.parseRef(ref);
      this.grid[pos.row][pos.col] = { raw: data.raw ?? '', bold: data.bold, format: data.format };
    }
    this.recompute();
  }

  // ---------- Import / Export ----------
  exportGridToJSON(): string {
    const cells: Record<string, Cell> = {};
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const cell = this.grid[r][c];
        if (cell.raw || cell.bold || (cell.format && cell.format !== 'none')) {
          const entry: Cell = { raw: cell.raw };
          if (cell.bold) entry.bold = true;
          if (cell.format && cell.format !== 'none') entry.format = cell.format;
          cells[this.getCellLabel(r, c)] = entry;
        }
      }
    }
    return JSON.stringify({ cells });
  }

  loadGridFromData(json: string) {
    try {
      const parsed = JSON.parse(json);
      const cells = parsed.cells ?? parsed;
      this.grid = this.createEmptyGrid();
      for (const [ref, data] of Object.entries(cells as Record<string, Partial<Cell>>)) {
        const pos = this.parseRef(ref);
        this.grid[pos.row][pos.col] = { raw: (data as any).raw ?? '', bold: (data as any).bold, format: (data as any).format };
      }
      this.recompute();
    } catch {
      // invalid JSON, ignore and keep current grid
    }
  }

  exportJSON() {
    this.dialogs.prompt({ title: 'Exporter la feuille', message: 'Copiez ce JSON dans le champ « Code/Données de départ » de la leçon pour le réutiliser.', icon: 'bi-box-arrow-up', value: this.exportGridToJSON(), readonly: true });
  }

  async importJSON() {
    const json = await this.dialogs.prompt({ title: 'Importer une feuille', message: 'Collez le JSON exporté précédemment.', icon: 'bi-box-arrow-in-down', multiline: true, confirmText: 'Importer' });
    if (json) this.loadGridFromData(json);
  }

  exportCSV() {
    const lines: string[] = [];
    for (let r = 0; r < this.ROWS; r++) {
      const cells: string[] = [];
      for (let c = 0; c < this.COLS; c++) {
        const v = this.computedGrid[r][c];
        cells.push(typeof v === 'number' ? String(v) : `"${String(v ?? '').replace(/"/g, '""')}"`);
      }
      lines.push(cells.join(';'));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tableur.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Progress ----------
  markComplete() {
    if (!this.exercise) return;
    this.markingComplete = true;
    this.progressService.completeLesson(this.exercise.id).subscribe({
      next: () => {
        this.exercise!.completed = true;
        this.markingComplete = false;
      },
      error: () => { this.markingComplete = false; }
    });
  }

  // ---------- Formula engine ----------
  recompute() {
    this.computedGrid = this.createEmptyComputed();
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        this.getComputed(r, c);
      }
    }
  }

  private getComputed(r: number, c: number): number | string {
    const existing = this.computedGrid[r][c];
    if (existing !== '' || this.grid[r][c].raw.trim() === '') {
      if (this.grid[r][c].raw.trim() === '') return '';
      if (existing !== '') return existing;
    }

    const key = `${r}:${c}`;
    if (this.evaluating.has(key)) {
      this.computedGrid[r][c] = '#CIRC';
      return '#CIRC';
    }

    const raw = this.grid[r][c].raw.trim();
    if (!raw) {
      this.computedGrid[r][c] = '';
      return '';
    }

    if (raw.startsWith('=')) {
      this.evaluating.add(key);
      try {
        this.computedGrid[r][c] = this.evaluateFormula(raw.slice(1), r, c);
      } catch {
        this.computedGrid[r][c] = '#ERREUR';
      }
      this.evaluating.delete(key);
      return this.computedGrid[r][c];
    }

    const normalized = raw.replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(normalized)) {
      this.computedGrid[r][c] = parseFloat(normalized);
    } else {
      this.computedGrid[r][c] = raw;
    }
    return this.computedGrid[r][c];
  }

  private evaluateFormula(expr: string, r: number, c: number): number {
    this.tokens = this.tokenize(expr);
    this.pos = 0;
    const value = this.parseExpression(r, c);
    if (this.pos < this.tokens.length) throw new Error('Expression invalide');
    return value;
  }

  private tokenize(expr: string): Token[] {
    const s = expr.toUpperCase().replace(/\s+/g, '');
    const tokens: Token[] = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1] || ''))) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        tokens.push({ type: 'num', value: s.slice(i, j) });
        i = j;
      } else if (/[A-Z]/.test(ch)) {
        let j = i;
        while (j < s.length && /[A-Z]/.test(s[j])) j++;
        let k = j;
        while (k < s.length && /[0-9]/.test(s[k])) k++;
        if (k > j) {
          tokens.push({ type: 'ref', value: s.slice(i, k) });
          i = k;
        } else {
          tokens.push({ type: 'ident', value: s.slice(i, j) });
          i = j;
        }
      } else if ('+-*/'.includes(ch)) {
        tokens.push({ type: 'op', value: ch });
        i++;
      } else if (ch === '(') { tokens.push({ type: 'lparen', value: ch }); i++; }
      else if (ch === ')') { tokens.push({ type: 'rparen', value: ch }); i++; }
      else if (ch === ',') { tokens.push({ type: 'comma', value: ch }); i++; }
      else if (ch === ':') { tokens.push({ type: 'colon', value: ch }); i++; }
      else { throw new Error(`Caractère invalide: ${ch}`); }
    }
    return tokens;
  }

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private next(): Token { return this.tokens[this.pos++]; }

  private parseExpression(r: number, c: number): number {
    let value = this.parseTerm(r, c);
    while (this.peek()?.type === 'op' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.next().value;
      const rhs = this.parseTerm(r, c);
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(r: number, c: number): number {
    let value = this.parseFactor(r, c);
    while (this.peek()?.type === 'op' && (this.peek()!.value === '*' || this.peek()!.value === '/')) {
      const op = this.next().value;
      const rhs = this.parseFactor(r, c);
      if (op === '/') {
        if (rhs === 0) throw new Error('Division par zéro');
        value = value / rhs;
      } else {
        value = value * rhs;
      }
    }
    return value;
  }

  private parseFactor(r: number, c: number): number {
    const tok = this.peek();
    if (!tok) throw new Error('Expression incomplète');

    if (tok.type === 'op' && tok.value === '-') { this.next(); return -this.parseFactor(r, c); }
    if (tok.type === 'op' && tok.value === '+') { this.next(); return this.parseFactor(r, c); }
    if (tok.type === 'num') { this.next(); return parseFloat(tok.value); }

    if (tok.type === 'lparen') {
      this.next();
      const value = this.parseExpression(r, c);
      if (this.peek()?.type !== 'rparen') throw new Error('Parenthèse manquante');
      this.next();
      return value;
    }

    if (tok.type === 'ref') {
      this.next();
      return this.refToNumber(tok.value);
    }

    if (tok.type === 'ident') {
      this.next();
      if (this.peek()?.type !== 'lparen') throw new Error('Fonction invalide');
      this.next();
      const values = this.parseFunctionArgs(r, c);
      if (this.peek()?.type !== 'rparen') throw new Error('Parenthèse manquante');
      this.next();
      return this.applyFunction(tok.value, values);
    }

    throw new Error('Token inattendu');
  }

  private parseFunctionArgs(r: number, c: number): number[] {
    const values: number[] = [];
    if (this.peek()?.type === 'rparen') return values;
    while (true) {
      if (this.peek()?.type === 'ref' && this.tokens[this.pos + 1]?.type === 'colon') {
        const start = this.next().value;
        this.next();
        const endTok = this.next();
        if (endTok.type !== 'ref') throw new Error('Plage invalide');
        values.push(...this.rangeToNumbers(start, endTok.value));
      } else {
        values.push(this.parseExpression(r, c));
      }
      if (this.peek()?.type === 'comma') { this.next(); continue; }
      break;
    }
    return values;
  }

  private parseRef(ref: string): { row: number; col: number } {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (!m) throw new Error(`Référence invalide: ${ref}`);
    let col = 0;
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    col -= 1;
    const row = parseInt(m[2], 10) - 1;
    if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) throw new Error(`Référence hors limites: ${ref}`);
    return { row, col };
  }

  private refToNumber(ref: string): number {
    const pos = this.parseRef(ref);
    const val = this.getComputed(pos.row, pos.col);
    if (val === '#ERREUR' || val === '#CIRC') throw new Error('Référence en erreur');
    if (val === '') return 0;
    const num = typeof val === 'number' ? val : Number(val);
    return isNaN(num) ? 0 : num;
  }

  private rangeToNumbers(startRef: string, endRef: string): number[] {
    const start = this.parseRef(startRef);
    const end = this.parseRef(endRef);
    const r1 = Math.min(start.row, end.row), r2 = Math.max(start.row, end.row);
    const c1 = Math.min(start.col, end.col), c2 = Math.max(start.col, end.col);
    const values: number[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const val = this.getComputed(r, c);
        if (val === '#ERREUR' || val === '#CIRC' || val === '') continue;
        const num = typeof val === 'number' ? val : Number(val);
        if (!isNaN(num)) values.push(num);
      }
    }
    return values;
  }

  private applyFunction(name: string, values: number[]): number {
    switch (name) {
      case 'SUM': case 'SOMME': return values.reduce((a, b) => a + b, 0);
      case 'AVERAGE': case 'MOYENNE': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'MIN': return values.length ? Math.min(...values) : 0;
      case 'MAX': return values.length ? Math.max(...values) : 0;
      case 'COUNT': case 'NB': return values.length;
      case 'ABS': return Math.abs(values[0] ?? 0);
      case 'ROUND': case 'ARRONDI': {
        if (!values.length) throw new Error('ARRONDI nécessite des arguments');
        const decimals = values.length > 1 ? values[1] : 0;
        const factor = Math.pow(10, decimals);
        return Math.round(values[0] * factor) / factor;
      }
      default: throw new Error(`Fonction inconnue: ${name}`);
    }
  }
}
