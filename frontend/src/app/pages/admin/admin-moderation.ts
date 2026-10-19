import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/admin.service';
import { errorMessage } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ModerationService } from '../../core/moderation.service';
import { REPORT_REASONS, ReportGroup, ReportReason, ReportStatus } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { AgoPipe, MediaPipe } from '../../shared/pipes';

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label])) as Record<ReportReason, string>;

/** Cola de moderación: contenidos denunciados, agrupados, para dar de baja o descartar. */
@Component({
  selector: 'ms-admin-moderation',
  imports: [RouterLink, Avatar, Icon, AgoPipe, MediaPipe],
  template: `
    <div class="grid gap-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-1" role="radiogroup" aria-label="Estado">
          @for (s of statuses; track s.id) {
            <button
              type="button"
              role="radio"
              class="min-h-9 cursor-pointer rounded-full px-3 text-sm font-medium transition"
              [class]="status() === s.id ? 'bg-surface-strong text-fg' : 'text-muted hover:text-fg'"
              [attr.aria-checked]="status() === s.id"
              (click)="status.set(s.id)"
            >
              {{ s.label }}
            </button>
          }
        </div>
        <p class="text-sm text-faint">Agrupadas por contenido · los más reportados primero</p>
      </div>

      @if (queue.error()) {
        <p class="rounded-xl border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{{ error(queue.error()) }}</p>
      }

      @if (queue.isLoading() && !queue.value()) {
        @for (i of [1, 2]; track i) {
          <div class="glass h-40 animate-pulse"></div>
        }
      }

      @for (g of queue.value() ?? []; track g.targetId) {
        <article class="glass grid animate-rise gap-4 p-5" [class.opacity-60]="busy() === g.targetId">
          <header class="flex flex-wrap items-center gap-2 text-sm">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold">
              <ms-icon [name]="g.type === 'post' ? 'image' : 'comment'" class="size-3.5" />
              {{ g.type === 'post' ? 'Publicación' : 'Comentario' }}
            </span>
            <span class="font-semibold">{{ g.count }} {{ g.count === 1 ? 'reporte' : 'reportes' }}</span>
            @for (r of reasonList(g); track r.id) {
              <span class="tag-chip py-0.5 text-xs">{{ r.label }} · {{ r.count }}</span>
            }
            <span class="ml-auto text-xs text-faint">{{ (g.resolvedAt ?? g.lastAt) | ago }}</span>
          </header>

          <!-- Contenido denunciado -->
          @if (g.target; as t) {
            <div class="flex gap-3 rounded-2xl border border-line bg-surface p-3">
              @if (t.imageUrl) {
                <img [src]="t.imageUrl | media" alt="" class="size-16 shrink-0 rounded-xl object-cover" />
              }
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 text-sm">
                  <ms-avatar [user]="t.author" [size]="22" />
                  <a [routerLink]="['/u', t.author?.username]" class="font-semibold hover:underline">{{ t.author?.displayName }}</a>
                  <span class="text-faint">&#64;{{ t.author?.username }} · {{ t.createdAt | ago }}</span>
                  @if (t.deleted) {
                    <span class="ml-auto rounded-full bg-danger/15 px-2 text-xs font-semibold text-danger">dado de baja</span>
                  }
                </div>
                @if (t.title) {
                  <p class="mt-1 font-semibold">{{ t.title }}</p>
                }
                <p class="line-clamp-3 text-sm text-muted">{{ t.content }}</p>
                @if (!t.deleted) {
                  <a [routerLink]="['/p', g.postId]" class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg">
                    Ver {{ g.type === 'post' ? 'publicación' : 'en su publicación' }} <ms-icon name="arrow-right" class="size-3.5" />
                  </a>
                }
              </div>
            </div>
          } @else {
            <p class="text-sm text-faint">El contenido ya no existe.</p>
          }

          <!-- Quiénes lo reportaron -->
          <ul class="grid gap-2 text-sm">
            @for (r of g.reports; track $index) {
              <li class="flex gap-2">
                <ms-avatar [user]="r.reporter" [size]="22" />
                <span class="min-w-0">
                  <span class="font-medium">&#64;{{ r.reporter?.username }}</span>
                  <span class="text-faint"> · {{ label(r.reason) }} · {{ r.createdAt | ago }}</span>
                  @if (r.detail) {
                    <span class="block text-muted">“{{ r.detail }}”</span>
                  }
                </span>
              </li>
            }
          </ul>

          @if (status() === 'pendiente') {
            <div class="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              <button type="button" class="btn min-h-10 px-4 text-sm text-muted hover:text-fg" [disabled]="!!busy()" (click)="resolve(g, 'descartar')">
                <ms-icon name="check" class="size-4" /> Descartar
              </button>
              <button type="button" class="btn min-h-10 bg-danger px-4 text-sm text-white hover:brightness-110" [disabled]="!!busy()" (click)="resolve(g, 'eliminar')">
                <ms-icon name="ban" class="size-4" /> Dar de baja
              </button>
            </div>
          }
        </article>
      } @empty {
        @if (!queue.isLoading()) {
          <div class="grid justify-items-center gap-3 py-16 text-center text-muted">
            <ms-icon name="flag" class="size-10 text-faint" />
            <p>{{ status() === 'pendiente' ? 'No hay reportes pendientes. Todo en orden ✦' : 'No hay reportes en este estado.' }}</p>
          </div>
        }
      }
    </div>
  `,
})
export class AdminModeration {
  private readonly api = inject(AdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly ui = inject(UiService);
  private readonly moderation = inject(ModerationService);

  protected readonly statuses: { id: ReportStatus; label: string }[] = [
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'resuelto', label: 'Dados de baja' },
    { id: 'descartado', label: 'Descartados' },
  ];
  protected readonly status = signal<ReportStatus>('pendiente');
  protected readonly busy = signal<string | null>(null);

  protected readonly queue = rxResource({ params: () => this.status(), stream: ({ params }) => this.api.reports(params) });

  protected readonly error = errorMessage;
  protected label = (reason: ReportReason) => REASON_LABEL[reason] ?? reason;

  protected reasonList(g: ReportGroup) {
    return Object.entries(g.reasons).map(([id, count]) => ({ id, label: this.label(id as ReportReason), count }));
  }

  protected async resolve(g: ReportGroup, action: 'eliminar' | 'descartar') {
    const what = g.type === 'post' ? 'la publicación' : 'el comentario';
    if (action === 'eliminar') {
      const accepted = await this.confirm.ask({
        title: `¿Dar de baja ${what}?`,
        message:
          g.type === 'post'
            ? 'La publicación y sus comentarios dejan de estar disponibles. Los reportes quedan resueltos.'
            : 'El comentario (y sus respuestas, si tiene) deja de estar disponible. Los reportes quedan resueltos.',
        confirmText: 'Dar de baja',
        danger: true,
      });
      if (!accepted) return;
    }
    this.busy.set(g.targetId);
    this.api.resolveReport(g.targetId, action).subscribe({
      next: () => {
        this.busy.set(null);
        this.queue.update((list) => list?.filter((x) => x.targetId !== g.targetId));
        this.moderation.refresh();
        this.ui.toast(action === 'eliminar' ? `Se dio de baja ${what}` : 'Reportes descartados');
      },
      error: (e) => {
        this.busy.set(null);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }
}
