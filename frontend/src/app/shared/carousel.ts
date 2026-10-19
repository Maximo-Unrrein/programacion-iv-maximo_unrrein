import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { Icon } from './icon';
import { MediaPipe } from './pipes';

/**
 * Carrusel de imágenes con scroll-snap: se desliza con el dedo, con las flechas (al pasar el mouse)
 * o con el teclado. Cada imagen lleva detrás una copia desenfocada que rellena los bordes.
 */
@Component({
  selector: 'ms-carousel',
  imports: [Icon, MediaPipe],
  template: `
    <div
      #track
      class="scrollbar-none flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
      tabindex="0"
      role="group"
      aria-roledescription="carrusel"
      [attr.aria-label]="alt()"
      (scroll)="onScroll()"
      (keydown.arrowleft)="go(index() - 1); $event.preventDefault()"
      (keydown.arrowright)="go(index() + 1); $event.preventDefault()"
    >
      @for (url of urls(); track url; let i = $index) {
        <div class="relative size-full shrink-0 snap-center overflow-hidden" [attr.aria-label]="'Imagen ' + (i + 1) + ' de ' + urls().length" role="group">
          <img [src]="url | media" alt="" aria-hidden="true" class="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl" />
          <img [src]="url | media" [alt]="alt() + (urls().length > 1 ? ' (' + (i + 1) + ' de ' + urls().length + ')' : '')" class="relative size-full object-contain" loading="lazy" draggable="false" />
        </div>
      }
    </div>

    @if (urls().length > 1) {
      <!-- Flechas: aparecen al pasar el mouse (en táctil se desliza) -->
      @if (index() > 0) {
        <button
          type="button"
          class="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-ink/45 text-white opacity-0 backdrop-blur-md transition duration-300 group-hover/carousel:opacity-100 hover:bg-ink/65 focus-visible:opacity-100 active:scale-90"
          aria-label="Imagen anterior"
          (click)="go(index() - 1)"
        >
          <ms-icon name="chevron-left" class="size-5" />
        </button>
      }
      @if (index() < urls().length - 1) {
        <button
          type="button"
          class="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-ink/45 text-white opacity-0 backdrop-blur-md transition duration-300 group-hover/carousel:opacity-100 hover:bg-ink/65 focus-visible:opacity-100 active:scale-90"
          aria-label="Imagen siguiente"
          (click)="go(index() + 1)"
        >
          <ms-icon name="chevron-right" class="size-5" />
        </button>
      }
      <!-- Contador y puntos -->
      <span class="absolute top-3 right-3 rounded-full bg-ink/45 px-2.5 py-0.5 text-xs font-medium text-white tabular-nums backdrop-blur-md">
        {{ index() + 1 }}/{{ urls().length }}
      </span>
      <div class="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden="true">
        @for (url of urls(); track url; let i = $index) {
          <span class="h-1.5 rounded-full bg-white transition-all duration-300" [class]="i === index() ? 'w-4 opacity-100' : 'w-1.5 opacity-50'"></span>
        }
      </div>
    }
  `,
  host: { class: 'group/carousel relative block' },
})
export class Carousel {
  readonly urls = input.required<string[]>();
  readonly alt = input('');

  protected readonly index = signal(0);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected onScroll() {
    const el = this.track().nativeElement;
    this.index.set(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }

  protected go(i: number) {
    const el = this.track().nativeElement;
    const target = Math.max(0, Math.min(this.urls().length - 1, i));
    el.scrollTo({ left: target * el.clientWidth });
  }
}
