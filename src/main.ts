import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .then(appRef => {
    // Service worker : application et cours téléchargés disponibles hors connexion (pas en développement avec « ng serve »)
    if ('serviceWorker' in navigator && !isDevMode()) registerServiceWorker(appRef.injector.get(Router));
  })
  .catch(err => console.error(err));

/** Vérification d'une nouvelle version : à l'ouverture, au retour sur l'application et toutes les 30 minutes. */
const UPDATE_CHECK_MS = 30 * 60 * 1000;

function registerServiceWorker(router: Router) {
  const start = () => navigator.serviceWorker.register('/sw.js').then(reg => {
    const check = () => reg.update().catch(() => {});
    setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(err => console.warn('Service worker non installé', err));
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);

  // Nouvelle version déployée : le nouveau service worker prend la main. Sans rechargement, un onglet ouvert
  // (ou l'application installée) garderait l'ancienne version. On ne recharge pas tout de suite (un devoir
  // ou une classe virtuelle en cours serait interrompu) : la nouvelle version s'ouvre au prochain changement de page.
  let hadController = !!navigator.serviceWorker.controller;
  let updateReady = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) updateReady = true;
    hadController = true;
  });
  router.events.pipe(filter((e): e is NavigationStart => e instanceof NavigationStart)).subscribe(e => {
    if (updateReady) window.location.assign(e.url);
  });
}
