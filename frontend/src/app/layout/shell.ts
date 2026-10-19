import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, interval, map } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { MessagesService } from '../core/messages.service';
import { ModerationService } from '../core/moderation.service';
import { UiService } from '../core/ui.service';
import { Avatar } from '../shared/avatar';
import { Composer } from '../shared/composer';
import { ReportDialog } from '../shared/report-dialog';
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
  /** Cantidad a destacar al lado (mensajes sin leer, denuncias pendientes). */
  badge?: number;
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
    ReportDialog,
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
  protected readonly messages = inject(MessagesService);
  private readonly moderation = inject(ModerationService);

  protected readonly nav = computed<NavItem[]>(() => [
    { label: 'Inicio', hint: 'Lo último de tu órbita', link: '/feed', icon: 'home', dock: true },
    { label: 'Buscar', hint: 'Personas y publicaciones', link: '/buscar', icon: 'search' },
    { label: 'Tendencias', hint: 'Lo más popular ahora', link: '/tendencias', icon: 'trend', dock: true },
    { label: 'Guardados', hint: 'Lo que guardaste', link: '/guardados', icon: 'bookmark', dock: true },
    { label: 'Mensajes', hint: 'Tus conversaciones', link: '/mensajes', icon: 'message', badge: this.messages.unread() },
    { label: 'Compartidos', hint: 'Lo que te compartieron', link: '/compartidos', icon: 'inbox' },
    { label: 'Mi perfil', hint: 'Tus publicaciones y datos', link: `/u/${this.auth.user()?.username}`, avatar: true, dock: true },
    ...(this.auth.isAdmin()
      ? [{ label: 'Administración', hint: 'Usuarios, moderación y estadísticas', link: '/admin', icon: 'shield' as IconName, dock: true, badge: this.moderation.pending() }]
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

  constructor() {
    // Indicadores de la navegación: al entrar, al navegar y cada 30 s (si la pestaña está visible)
    const refresh = () => {
      if (document.hidden) return;
      this.messages.refreshUnread().subscribe({ error: () => undefined });
      if (this.auth.isAdmin()) this.moderation.refresh();
    };
    refresh();
    interval(30_000).pipe(takeUntilDestroyed()).subscribe(refresh);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(refresh);
  }

  protected logout() {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
