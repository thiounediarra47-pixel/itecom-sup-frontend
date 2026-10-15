import { ErrorHandler, Injectable } from '@angular/core';

const RELOAD_KEY = 'chunk-reload-at';
const RELOAD_GUARD_MS = 10000;

/**
 * Après un déploiement, un onglet resté ouvert référence encore les anciens fichiers JS
 * (noms hashés) qui n'existent plus sur le serveur. On recharge alors la page une fois
 * pour récupérer la nouvelle version, au lieu de laisser la navigation échouer.
 */
@Injectable()
export class ChunkLoadErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    if (this.isChunkLoadError(error) && this.canReload()) {
      try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {}
      window.location.reload();
      return;
    }
    super.handleError(error);
  }

  private isChunkLoadError(error: unknown): boolean {
    const message = String((error as any)?.message ?? (error as any)?.rejection?.message ?? error ?? '');
    return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i
      .test(message);
  }

  /** Évite une boucle de rechargements si le fichier manque vraiment sur le serveur. */
  private canReload(): boolean {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      return Date.now() - last > RELOAD_GUARD_MS;
    } catch {
      return true;
    }
  }
}
