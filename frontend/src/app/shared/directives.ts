import { AfterViewInit, Directive, ElementRef, OnDestroy, afterNextRender, inject, input, output } from '@angular/core';

/**
 * Scroll infinito: emite `msInfiniteScroll` cuando el elemento se acerca a la pantalla.
 * Uso: `<div (msInfiniteScroll)="cargarMas()"></div>` al final de una lista.
 */
@Directive({ selector: '[msInfiniteScroll]' })
export class InfiniteScroll implements OnDestroy {
  /** Distancia (px) antes de llegar al final en la que ya se pide la siguiente página. */
  readonly msInfiniteScrollMargin = input(600);
  readonly msInfiniteScroll = output<void>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      this.observer = new IntersectionObserver(
        (entries) => entries[0]?.isIntersecting && this.msInfiniteScroll.emit(),
        { rootMargin: `${this.msInfiniteScrollMargin()}px` },
      );
      this.observer.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}

/** Textarea que crece con el contenido (hasta `msAutosizeMax` px) en lugar de mostrar scroll. */
@Directive({
  selector: 'textarea[msAutosize]',
  host: { '(input)': 'resize()', style: 'overflow-y: auto' },
})
export class Autosize implements AfterViewInit {
  readonly msAutosizeMax = input(320);
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);

  ngAfterViewInit() {
    queueMicrotask(() => this.resize());
  }

  protected resize() {
    const area = this.el.nativeElement;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight + 2, this.msAutosizeMax())}px`;
  }
}

/** Da foco al elemento apenas aparece (p. ej. al abrir un editor o un modal). */
@Directive({ selector: '[msAutofocus]' })
export class Autofocus {
  /** Además de enfocar, selecciona el texto (útil para editar). */
  readonly msAutofocusSelect = input(false);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const el = this.el.nativeElement as HTMLInputElement;
      el.focus({ preventScroll: true });
      if (this.msAutofocusSelect() && typeof el.select === 'function') el.select();
    });
  }
}
