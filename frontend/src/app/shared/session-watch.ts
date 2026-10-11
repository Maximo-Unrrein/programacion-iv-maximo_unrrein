import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, errorMessage } from '../core/auth.service';
import { UiService } from '../core/ui.service';
import { Autofocus } from './directives';
import { Icon } from './icon';
import { Modal } from './modal';

/** El aviso aparece cuando faltan 5 minutos (a los 10 minutos de un token de 15). */
const WARN_BEFORE_MS = 5 * 60_000;

/**
 * Controla el vencimiento de la sesión:
 * 10 minutos después de obtener el token abre un modal con la cuenta regresiva y ofrece extenderla
 * (refresca el token). Si se agota, cierra la sesión y lleva al login.
 */
@Component({
  selector: 'ms-session-watch',
  imports: [Modal, Icon, Autofocus],
  template: `
    <ms-modal [open]="open()" label="Tu sesión está por vencer" (closed)="open.set(false)" style="--modal-w: 440px">
      <div class="glass grid gap-5 bg-elevated p-6" role="alertdialog" aria-labelledby="session-title">
        <div class="flex items-start gap-4">
          <span class="grid size-12 shrink-0 place-items-center rounded-full bg-surface-strong"><ms-icon name="clock" class="size-6" /></span>
          <div class="grid gap-1">
            <h2 id="session-title" class="text-xl font-bold">Tu sesión está por vencer</h2>
            <p class="text-muted">
              Te quedan <strong class="font-display text-fg tabular-nums">{{ remainingText() }}</strong> de sesión. ¿Querés extenderla?
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn min-h-11 text-muted hover:text-fg" (click)="logout()">Cerrar sesión</button>
          <button type="button" class="btn btn-primary min-h-11" [disabled]="extending()" (click)="extend()" msAutofocus>
            {{ extending() ? 'Extendiendo…' : 'Extender sesión' }}
          </button>
        </div>
      </div>
    </ms-modal>
  `,
})
export class SessionWatch {
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  protected readonly open = signal(false);
  protected readonly extending = signal(false);
  private readonly now = signal(Date.now());

  protected readonly remainingText = computed(() => {
    const ms = Math.max(0, (this.auth.expiresAt() ?? 0) - this.now());
    const total = Math.ceil(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  private warnTimer?: ReturnType<typeof setTimeout>;
  private expireTimer?: ReturnType<typeof setTimeout>;
  private ticker?: ReturnType<typeof setInterval>;

  constructor() {
    // Cada vez que cambia el token (login o refresco) se reprograman los avisos
    effect(() => this.schedule(this.auth.expiresAt()));
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  private schedule(expiresAt: number | null) {
    this.clear();
    this.open.set(false);
    if (!expiresAt) return;
    const untilWarn = expiresAt - WARN_BEFORE_MS - Date.now();
    const untilExpire = expiresAt - Date.now();
    this.warnTimer = setTimeout(() => this.warn(), Math.max(0, untilWarn));
    this.expireTimer = setTimeout(() => this.expire(), Math.max(0, untilExpire));
  }

  private warn() {
    this.now.set(Date.now());
    this.ticker = setInterval(() => this.now.set(Date.now()), 1000);
    this.open.set(true);
  }

  protected async extend() {
    this.extending.set(true);
    try {
      await this.auth.refresh(); // dispara schedule() con el nuevo vencimiento
      this.ui.toast('Sesión extendida 15 minutos');
    } catch (e) {
      this.ui.toast(errorMessage(e), 'error');
    } finally {
      this.extending.set(false);
    }
  }

  protected logout() {
    this.clear();
    this.open.set(false);
    this.auth.logout();
    this.router.navigateByUrl('/ingresar');
  }

  private expire() {
    this.clear();
    this.open.set(false);
    this.auth.logout();
    this.router.navigate(['/ingresar'], { queryParams: { sesion: 'expirada' } });
  }

  private clear() {
    clearTimeout(this.warnTimer);
    clearTimeout(this.expireTimer);
    clearInterval(this.ticker);
  }
}
