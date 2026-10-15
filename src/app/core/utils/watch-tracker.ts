/**
 * Mesure de ce qui a réellement été regardé dans une vidéo : seules les avancées continues de la lecture
 * comptent (un saut avec la barre de lecture ne compte pas, ni une lecture accélérée au-delà de ×2).
 * Les plages vues sont envoyées au serveur, qui les fusionne avec les précédentes.
 */
export type Range = [number, number];

/** Vitesse maximale prise en compte. */
export const MAX_COUNTED_RATE = 2;

export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges.filter(r => r[1] - r[0] > 0.01).map(r => [r[0], r[1]] as Range).sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 0.5) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export function rangesTotal(ranges: Range[]): number {
  return ranges.reduce((n, r) => n + r[1] - r[0], 0);
}

export class WatchTracker {
  /** Plages vues pas encore envoyées au serveur. */
  private pending: Range[] = [];
  /** Toutes les plages vues dans cette session (pour l'affichage immédiat). */
  private session: Range[] = [];
  private last: number | null = null;

  /** À chaque « timeupdate » du lecteur. */
  onTime(time: number, rate: number, paused: boolean) {
    if (paused || rate > MAX_COUNTED_RATE) { this.last = paused ? null : time; return; }
    if (this.last !== null) {
      const delta = time - this.last;
      // Avancée normale entre deux mises à jour (≈ 0,25 s × vitesse) ; un saut est ignoré
      if (delta > 0 && delta <= 2.5 * Math.max(1, rate)) {
        this.pending = mergeRanges([...this.pending, [this.last, time]]);
        this.session = mergeRanges([...this.session, [this.last, time]]);
      }
    }
    this.last = time;
  }

  /** Saut dans la vidéo, pause ou fin : la prochaine avancée repart de la nouvelle position. */
  breakContinuity() { this.last = null; }

  hasPending(): boolean { return rangesTotal(this.pending) >= 0.5; }

  /** Plages à envoyer (vidées : le serveur les a, ou la file hors connexion les garde). */
  take(): Range[] {
    const r = this.pending.map(x => [Math.round(x[0] * 10) / 10, Math.round(x[1] * 10) / 10] as Range);
    this.pending = [];
    return r;
  }

  /** Part vue dans cette session (le serveur, qui connaît tout l'historique, donne le chiffre définitif). */
  sessionPercent(duration: number): number {
    return duration > 0 ? Math.min(100, rangesTotal(this.session) * 100 / duration) : 0;
  }
}
