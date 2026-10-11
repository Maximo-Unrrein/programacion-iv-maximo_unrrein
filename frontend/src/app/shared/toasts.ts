import { Component, inject } from '@angular/core';
import { UiService } from '../core/ui.service';

@Component({
  selector: 'ms-toasts',
  template: `
    @for (t of ui.toasts(); track t.id) {
      <button
        type="button"
        class="glass pointer-events-auto animate-rise cursor-pointer bg-elevated/90 px-5 py-3 text-sm font-medium shadow-lg"
        [class.text-danger]="t.kind === 'error'"
        (click)="ui.dismiss(t.id)"
      >
        {{ t.message }}
      </button>
    }
  `,
  host: {
    class: 'pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4 md:bottom-8',
    role: 'status',
    'aria-live': 'polite',
  },
})
export class Toasts {
  protected readonly ui = inject(UiService);
}
