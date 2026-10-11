import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';
import { ConfirmDialog } from './shared/confirm-dialog';
import { Splash } from './shared/splash';

/** Tiempo mínimo de la pantalla de carga, para que no sea un parpadeo. */
const MIN_SPLASH_MS = 900;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialog, Splash],
  template: `
    @if (loading()) {
      <ms-splash />
    }
    <router-outlet />
    <ms-confirm-dialog />
  `,
})
export class App {
  // Instancia el servicio de tema al arrancar
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);

  constructor() {
    // Al iniciar: pantalla de carga mientras se valida el token contra la ruta `autorizar`.
    // Válido → publicaciones · vencido o inválido → login.
    const minimum = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));
    Promise.all([this.auth.ready, minimum]).then(async () => {
      const path = location.pathname;
      if (this.auth.isLoggedIn() && (path === '/' || path.startsWith('/ingresar'))) {
        await this.router.navigateByUrl('/feed');
      } else if (this.auth.sessionExpired()) {
        await this.router.navigate(['/ingresar'], { queryParams: { sesion: 'expirada' } });
      }
      this.loading.set(false);
    });
  }
}
