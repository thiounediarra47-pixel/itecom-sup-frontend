/**
 * Qualité vidéo : « légère » (360p, ~300 kbit/s) pour les connexions faibles ou l'économie de données,
 * « normale » (720p) sinon. Le choix de l'utilisateur est retenu sur l'appareil.
 */
export type VideoQuality = 'auto' | 'hd' | 'light';

const KEY = 'itecom-offline-video-quality';

export function getVideoQuality(): VideoQuality {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'hd' || v === 'light' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function setVideoQuality(q: VideoQuality) {
  try { localStorage.setItem(KEY, q); } catch { /* stockage indisponible */ }
}

/** Connexion lente ou « économie de données » activée sur le téléphone. */
export function isSlowConnection(): boolean {
  const c = (navigator as any).connection;
  if (!c) return false;
  return !!c.saveData || ['slow-2g', '2g', '3g'].includes(c.effectiveType);
}

/** Adresse à lire selon la qualité choisie (ou automatique) et les versions disponibles. */
export function pickVideoUrl(hdUrl: string | null | undefined, lightUrl: string | null | undefined): string | null {
  if (!lightUrl) return hdUrl ?? null;
  if (!hdUrl) return lightUrl;
  const q = getVideoQuality();
  if (q === 'light') return lightUrl;
  if (q === 'hd') return hdUrl;
  return isSlowConnection() || !navigator.onLine ? lightUrl : hdUrl;
}
