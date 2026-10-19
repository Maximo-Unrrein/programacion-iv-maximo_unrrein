import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/auth.service';
import { REPORT_REASONS, ReportReason } from '../core/models';
import { PostsService } from '../core/posts.service';
import { ReportService } from '../core/report.service';
import { UiService } from '../core/ui.service';
import { Icon } from './icon';
import { Modal } from './modal';

/** Diálogo para denunciar una publicación o un comentario: motivo + detalle opcional. */
@Component({
  selector: 'ms-report-dialog',
  imports: [FormsModule, Modal, Icon],
  template: `
    <ms-modal [open]="!!reports.request()" label="Reportar" (closed)="reports.close()" style="--modal-w: 460px">
      @if (reports.request(); as r) {
        <form class="glass grid gap-5 bg-elevated p-6" (ngSubmit)="send()">
          <header class="flex items-start gap-3 pr-6">
            <span class="grid size-11 shrink-0 place-items-center rounded-full bg-surface-strong"><ms-icon name="flag" /></span>
            <div class="min-w-0">
              <h2 class="text-xl font-bold">Reportar {{ r.type === 'post' ? 'publicación' : 'comentario' }}</h2>
              <p class="truncate text-sm text-muted">“{{ r.preview }}”</p>
            </div>
          </header>

          <fieldset class="grid gap-1.5">
            <legend class="mb-2 text-sm font-medium text-muted">¿Qué pasa con este contenido?</legend>
            @for (option of reasons; track option.id) {
              <label
                class="flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-2.5 transition"
                [class]="reason() === option.id ? 'border-line-strong bg-surface-strong' : 'border-transparent hover:bg-surface'"
              >
                <input type="radio" name="reason" class="mt-1 accent-[var(--fg)]" [value]="option.id" [checked]="reason() === option.id" (change)="reason.set(option.id)" />
                <span class="grid leading-tight">
                  <span class="font-medium">{{ option.label }}</span>
                  <span class="text-xs text-faint">{{ option.hint }}</span>
                </span>
              </label>
            }
          </fieldset>

          <label class="grid gap-1.5">
            <span class="text-sm font-medium text-muted">Detalle {{ reason() === 'otro' ? '' : '(opcional)' }}</span>
            <textarea
              name="detail"
              rows="2"
              maxlength="300"
              class="input-field resize-none"
              placeholder="Contanos un poco más para que podamos revisarlo"
              [ngModel]="detail()"
              (ngModelChange)="detail.set($event)"
            ></textarea>
          </label>

          @if (error()) {
            <p class="text-sm text-danger" role="alert">{{ error() }}</p>
          }
          <div class="flex justify-end gap-2">
            <button type="button" class="btn min-h-11 text-muted hover:text-fg" (click)="reports.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary min-h-11" [disabled]="!canSend()">
              {{ sending() ? 'Enviando…' : 'Enviar reporte' }}
            </button>
          </div>
        </form>
      }
    </ms-modal>
  `,
})
export class ReportDialog {
  protected readonly reports = inject(ReportService);
  private readonly api = inject(PostsService);
  private readonly ui = inject(UiService);

  protected readonly reasons = REPORT_REASONS;
  protected readonly reason = signal<ReportReason | null>(null);
  protected readonly detail = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Cada vez que se abre, el formulario arranca vacío
    effect(() => {
      if (this.reports.request()) {
        this.reason.set(null);
        this.detail.set('');
        this.error.set(null);
      }
    });
  }

  /** "Otro motivo" necesita un detalle. */
  protected canSend() {
    const reason = this.reason();
    return !this.sending() && !!reason && (reason !== 'otro' || !!this.detail().trim());
  }

  protected send() {
    const request = this.reports.request();
    const reason = this.reason();
    if (!request || !reason || !this.canSend()) return;
    this.sending.set(true);
    this.api.report(request.type, request.targetId, reason, this.detail().trim()).subscribe({
      next: () => {
        this.sending.set(false);
        this.reports.close();
        this.ui.toast('Gracias. Un administrador va a revisar el reporte.');
      },
      error: (e) => {
        this.sending.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
