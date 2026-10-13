import { Component, inject } from '@angular/core';
import { ConfirmService } from '../core/confirm.service';
import { Autofocus } from './directives';
import { Modal } from './modal';

/** Modal de confirmación global (se monta una sola vez en la app). */
@Component({
  selector: 'ms-confirm-dialog',
  imports: [Modal, Autofocus],
  template: `
    <ms-modal [open]="!!confirm.request()" [label]="confirm.request()?.title ?? ''" (closed)="confirm.settle(false)" style="--modal-w: 420px">
      @if (confirm.request(); as r) {
        <div class="glass grid gap-5 bg-elevated p-6" role="alertdialog" [attr.aria-label]="r.title">
          <div class="grid gap-2 pr-6">
            <h2 class="text-xl font-bold">{{ r.title }}</h2>
            <p class="text-muted">{{ r.message }}</p>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn min-h-11 text-muted hover:text-fg" (click)="confirm.settle(false)">
              {{ r.cancelText ?? 'Cancelar' }}
            </button>
            <button
              type="button"
              class="btn min-h-11"
              [class]="r.danger ? 'bg-danger text-white hover:brightness-110' : 'btn-primary'"
              (click)="confirm.settle(true)"
              msAutofocus
            >
              {{ r.confirmText ?? 'Confirmar' }}
            </button>
          </div>
        </div>
      }
    </ms-modal>
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
}
