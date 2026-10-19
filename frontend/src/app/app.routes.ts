import { Routes, UrlMatcher, UrlSegment } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth.guard';

/**
 * `/mensajes` y `/mensajes/:username` usan la misma ruta: al cambiar de conversación
 * el componente se reutiliza (no se vuelve a cargar la lista).
 */
const messagesMatcher: UrlMatcher = (segments: UrlSegment[]) => {
  if (segments[0]?.path !== 'mensajes' || segments.length > 2) return null;
  const posParams: Record<string, UrlSegment> = segments[1] ? { username: segments[1] } : {};
  return { consumed: segments, posParams };
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'MaxSend · Conectá sin límites',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'ingresar',
    title: 'Ingresar · MaxSend',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/auth').then((m) => m.Auth),
  },
  // Vistas con sesión, dentro del layout con navegación
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'feed',
        title: 'Inicio · MaxSend',
        loadComponent: () => import('./pages/feed/feed').then((m) => m.Feed),
      },
      {
        path: 'p/:id',
        title: 'Publicación · MaxSend',
        loadComponent: () => import('./pages/post/post-page').then((m) => m.PostPage),
      },
      {
        path: 'buscar',
        title: 'Buscar · MaxSend',
        loadComponent: () => import('./pages/search/search').then((m) => m.Search),
      },
      {
        matcher: messagesMatcher,
        title: 'Mensajes · MaxSend',
        loadComponent: () => import('./pages/messages/messages').then((m) => m.Messages),
      },
      {
        path: 'guardados',
        title: 'Guardados · MaxSend',
        loadComponent: () => import('./pages/saved/saved').then((m) => m.Saved),
      },
      {
        path: 'compartidos',
        title: 'Compartidos conmigo · MaxSend',
        loadComponent: () => import('./pages/shared-with-me/shared-with-me').then((m) => m.SharedWithMe),
      },
      {
        path: 'tendencias',
        title: 'Tendencias · MaxSend',
        loadComponent: () => import('./pages/trends/trends').then((m) => m.Trends),
      },
      {
        path: 'u/:username',
        title: 'Perfil · MaxSend',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
      },
      // Dashboard: sólo perfil administrador
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/admin/admin-layout').then((m) => m.AdminLayout),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'usuarios' },
          {
            path: 'usuarios',
            title: 'Usuarios · Admin · MaxSend',
            loadComponent: () => import('./pages/admin/admin-users').then((m) => m.AdminUsers),
          },
          {
            path: 'moderacion',
            title: 'Moderación · Admin · MaxSend',
            loadComponent: () => import('./pages/admin/admin-moderation').then((m) => m.AdminModeration),
          },
          {
            path: 'estadisticas',
            title: 'Estadísticas · Admin · MaxSend',
            loadComponent: () => import('./pages/admin/admin-stats').then((m) => m.AdminStats),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
