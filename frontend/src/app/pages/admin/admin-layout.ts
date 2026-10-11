import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Icon } from '../../shared/icon';

/** Dashboard de administración (sólo perfil administrador): pestañas Usuarios y Estadísticas. */
@Component({
  selector: 'ms-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  template: `
    <div class="mx-auto grid max-w-5xl gap-6">
      <header class="grid gap-4">
        <div>
          <p class="font-display text-xs font-semibold tracking-[0.32em] text-muted uppercase">Panel de administración</p>
          <h1 class="mt-1 text-3xl font-bold">Hola, <span class="brand-text">{{ auth.user()?.firstName || auth.user()?.displayName }}</span></h1>
        </div>
        <nav class="flex gap-1 border-b border-line" aria-label="Secciones del panel">
          @for (tab of tabs; track tab.link) {
            <a
              [routerLink]="tab.link"
              routerLinkActive
              #rla="routerLinkActive"
              class="relative -mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition"
              [class]="rla.isActive ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg'"
              [attr.aria-current]="rla.isActive ? 'page' : null"
            >
              <ms-icon [name]="tab.icon" class="size-4" /> {{ tab.label }}
            </a>
          }
        </nav>
      </header>
      <router-outlet />
    </div>
  `,
})
export class AdminLayout {
  protected readonly auth = inject(AuthService);
  protected readonly tabs = [
    { link: 'usuarios', label: 'Usuarios', icon: 'user' as const },
    { link: 'estadisticas', label: 'Estadísticas', icon: 'trend' as const },
  ];
}
