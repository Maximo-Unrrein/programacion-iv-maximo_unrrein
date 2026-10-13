import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { UiService } from '../core/ui.service';
import { Avatar } from '../shared/avatar';
import { Composer } from '../shared/composer';
import { Icon, IconName } from '../shared/icon';
import { Logo } from '../shared/logo';
import { AsciiBackground } from '../shared/space/ascii-background';
import { ThemeToggle } from '../shared/theme-toggle';
import { SessionWatch } from '../shared/session-watch';
import { Toasts } from '../shared/toasts';
import { TrendsPanel } from '../shared/trends-panel';

interface NavItem {
  label: string;
  link: string;
  /** Descripción breve debajo del nombre (navegación de PC). */
  hint: string;
  icon?: IconName;
  avatar?: boolean;
  /** Se muestra en el dock del celular (los demás quedan en la barra superior o en el menú de PC). */
  dock?: boolean;
}

/**
 * Layout de las vistas con sesión:
 * - PC (≥1024 px): todo centrado con márgenes — navegación con texto, contenido y tendencias.
 * - Tablet: rail compacto de íconos.
 * - Celular: dock flotante.
 */
@Component({
  selector: 'ms-shell',
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Logo,
    Icon,
    Avatar,
    ThemeToggle,
    Composer,
    Toasts,
    TrendsPanel,
    AsciiBackground,
    SessionWatch,
  ],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiService);
  private readonly router = inject(Router);

  protected readonly nav = computed<NavItem[]>(() => [
    { label: 'Inicio', hint: 'Lo último de tu órbita', link: '/feed', icon: 'home', dock: true },
    { label: 'Buscar', hint: 'Personas y publicaciones', link: '/buscar', icon: 'search' },
    { label: 'Tendencias', hint: 'Lo más popular ahora', link: '/tendencias', icon: 'trend', dock: true },
    { label: 'Guardados', hint: 'Lo que guardaste', link: '/guardados', icon: 'bookmark', dock: true },
    { label: 'Compartidos', hint: 'Lo que te compartieron', link: '/compartidos', icon: 'inbox' },
    { label: 'Mi perfil', hint: 'Tus publicaciones y datos', link: `/u/${this.auth.user()?.username}`, avatar: true, dock: true },
    ...(this.auth.isAdmin()
      ? [{ label: 'Administración', hint: 'Usuarios y estadísticas', link: '/admin', icon: 'shield' as IconName, dock: true }]
      : []),
  ]);

  protected readonly dockNav = computed(() => this.nav().filter((item) => item.dock));

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** El panel de tendencias no se repite en la propia página de tendencias ni en el panel de admin. */
  protected readonly showTrends = computed(() => !/^\/(tendencias|admin)/.test(this.url()));

  protected logout() {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
