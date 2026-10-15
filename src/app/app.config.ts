import '@angular/common/locales/global/fr';
import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { offlineInterceptor } from './core/interceptors/offline.interceptor';
import { ChunkLoadErrorHandler } from './core/errors/chunk-load-error.handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor, offlineInterceptor])),
    provideAnimations(),
    { provide: ErrorHandler, useClass: ChunkLoadErrorHandler }
  ]
};
