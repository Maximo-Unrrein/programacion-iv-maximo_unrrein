import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth.guard';

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
