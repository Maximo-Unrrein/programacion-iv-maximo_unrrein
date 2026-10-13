import { Component, DestroyRef, computed, ElementRef, afterNextRender, effect, inject, input, signal, viewChild } from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { AsciiMode, AsciiScene } from './ascii-scene';

/**
 * Fondo de arte ASCII a pantalla completa.
 * - `hero`: landing e ingreso, a plena opacidad.
 * - `ambient`: detrás del feed, translúcido y más lento para no competir con las publicaciones.
 */
@Component({
  selector: 'ms-ascii-background',
  template: `
    <!-- En modo hero se atenúa el centro para que el texto sobre el fondo se lea bien -->
    <canvas
      #canvas
      class="absolute inset-0 size-full"
      [style.mask-image]="mask()"
      [style.-webkit-mask-image]="mask()"
    ></canvas>
  `,
  host: {
    class: 'pointer-events-none fixed inset-0 -z-10 block select-none',
    '[style.opacity]': 'opacity()',
    'aria-hidden': 'true',
  },
})
export class AsciiBackground {
  readonly mode = input<AsciiMode>('hero');

  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly scene = signal<AsciiScene | null>(null);
  /** En modo ambiente queda muy translúcido (un poco más visible sobre el fondo claro). */
  protected readonly opacity = computed(() =>
    this.mode() === 'ambient' ? (this.theme.theme() === 'dark' ? 0.12 : 0.16) : 1,
  );

  protected readonly mask = computed(() =>
    this.mode() === 'hero' ? 'radial-gradient(ellipse 34% 30% at 50% 52%, rgb(0 0 0 / 0.3), #000)' : null,
  );

  constructor() {
    afterNextRender(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try {
        this.scene.set(new AsciiScene(this.canvas().nativeElement, this.theme.theme(), this.mode(), reduced));
      } catch (e) {
        console.warn('WebGL no disponible, se omite el fondo ASCII', e);
      }
    });
    effect(() => this.scene()?.setTheme(this.theme.theme()));
    inject(DestroyRef).onDestroy(() => this.scene()?.dispose());
  }
}
