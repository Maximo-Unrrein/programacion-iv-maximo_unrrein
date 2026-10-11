import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/** Diálogo modal nativo (<dialog>): foco atrapado, cierre con Esc o tocando el fondo. */
@Component({
  selector: 'ms-modal',
  template: `
    <dialog
      #dialog
      class="m-auto max-h-[94dvh] w-[min(var(--modal-w,1040px),94vw)] overflow-visible bg-transparent p-0 text-fg backdrop:bg-ink/75 backdrop:backdrop-blur-sm open:animate-rise"
      [attr.aria-label]="label()"
      (close)="closed.emit()"
      (click)="onClick($event)"
    >
      <button
        type="button"
        class="icon-btn absolute -top-12 right-0 z-10 text-white/80 hover:text-white"
        aria-label="Cerrar"
        (click)="dialog.close()"
      >
        <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      @if (open()) {
        <ng-content />
      }
    </dialog>
  `,
})
export class Modal {
  readonly open = input(false);
  readonly label = input('');
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected onClick(event: MouseEvent) {
    // Click en el fondo (fuera del contenido)
    if (event.target === this.dialog().nativeElement) this.dialog().nativeElement.close();
  }
}
