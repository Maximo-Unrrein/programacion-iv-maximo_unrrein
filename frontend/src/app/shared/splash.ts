import { Component } from '@angular/core';
import { Logo } from './logo';

/** Pantalla de carga que se muestra al iniciar la app mientras se valida el token guardado. */
@Component({
  selector: 'ms-splash',
  imports: [Logo],
  template: `
    <div class="grid justify-items-center gap-8">
      <ms-logo [size]="72" class="animate-float drop-shadow-[0_0_24px_rgb(var(--glow-rgb)/0.4)]" />
      <div class="relative size-10" role="progressbar" aria-label="Cargando">
        <span class="absolute inset-0 rounded-full border-2 border-line-strong"></span>
        <span class="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-fg"></span>
      </div>
      <p class="font-display text-xs tracking-[0.4em] text-muted uppercase">Cargando</p>
    </div>
  `,
  host: { class: 'fixed inset-0 z-[100] grid place-items-center bg-bg', role: 'status', 'aria-live': 'polite' },
})
export class Splash {}
