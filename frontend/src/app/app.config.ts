import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeEs);

/** Ruta completa (sin query params) de una navegación; las conversaciones cuentan como una sola pantalla. */
const section = (route: ActivatedRouteSnapshot) => {
  while (route.firstChild) route = route.firstChild;
  const path = route.pathFromRoot.flatMap((r) => r.url.map((s) => s.path)).join('/');
  return path.startsWith('mensajes') ? 'mensajes' : path;
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'top' }),
      // Las pantallas se descargan de antemano: al navegar no queda un cuadro vacío mientras carga
      withPreloading(PreloadAllModules),
      // Fundido suave entre pantallas (sólo el contenido central, ver styles.css)
      withViewTransitions({
        skipInitialTransition: true,
        // Si sólo cambian los query params (búsqueda, filtros) no hay fundido
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (section(from) === section(to)) transition.skipTransition();
        },
      }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'es' },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
