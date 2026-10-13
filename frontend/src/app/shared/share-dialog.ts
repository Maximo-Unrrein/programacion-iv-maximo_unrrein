import { Component, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, switchMap } from 'rxjs';
import { errorMessage } from '../core/auth.service';
import { Author, Post } from '../core/models';
import { PostsService } from '../core/posts.service';
import { UiService } from '../core/ui.service';
import { Avatar } from './avatar';
import { Autofocus } from './directives';
import { Icon } from './icon';
import { Modal } from './modal';

/** Modal para elegir a qué usuario compartirle una publicación. */
@Component({
  selector: 'ms-share-dialog',
  imports: [Modal, Avatar, Icon, Autofocus],
  template: `
    <ms-modal [open]="open()" label="Compartir publicación" (closed)="closed.emit()" style="--modal-w: 440px">
      <section class="glass grid gap-4 bg-elevated p-6">
        <header class="pr-6">
          <h2 class="text-xl font-bold">Compartir</h2>
          <p class="truncate text-sm text-muted">“{{ post().title }}” · elegí a quién se la querés compartir</p>
        </header>

        <label class="relative block">
          <span class="sr-only">Buscar usuario</span>
          <ms-icon name="search" class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
          <input
            class="input-field min-h-11 pl-10"
            placeholder="Buscar por nombre o usuario"
            autocomplete="off"
            msAutofocus
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </label>

        <ul class="scrollbar-thin grid max-h-72 gap-1 overflow-y-auto" aria-label="Usuarios">
          @for (user of results(); track user.id) {
            <li>
              <button
                type="button"
                class="flex w-full cursor-pointer items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-surface-strong disabled:opacity-50"
                [disabled]="sending() !== null"
                (click)="shareWith(user)"
              >
                <ms-avatar [user]="user" [size]="36" />
                <span class="min-w-0 flex-1 leading-tight">
                  <span class="block truncate font-semibold">{{ user.displayName }}</span>
                  <span class="text-sm text-faint">&#64;{{ user.username }}</span>
                </span>
                @if (sending() === user.id) {
                  <span class="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true"></span>
                } @else {
                  <ms-icon name="send" class="size-4 text-faint" />
                }
              </button>
            </li>
          } @empty {
            <li class="py-6 text-center text-sm text-faint">No encontramos usuarios.</li>
          }
        </ul>
      </section>
    </ms-modal>
  `,
})
export class ShareDialog {
  private readonly api = inject(PostsService);
  private readonly ui = inject(UiService);

  readonly post = input.required<Post>();
  readonly open = input(false);
  readonly closed = output<void>();
  readonly shared = output<number>();

  protected readonly query = signal('');
  protected readonly sending = signal<string | null>(null);

  /** Resultados de la búsqueda (con una pequeña espera mientras se escribe). */
  protected readonly results = toSignal(
    toObservable(this.query).pipe(
      debounceTime(250),
      switchMap((q) => this.api.searchUsers(q).pipe(catchError(() => of([] as Author[])))),
    ),
    { initialValue: [] as Author[] },
  );

  protected shareWith(user: Author) {
    this.sending.set(user.id);
    this.api.share(this.post().id, user.id).subscribe({
      next: (r) => {
        this.sending.set(null);
        this.ui.toast(r.alreadyShared ? `Ya se la habías compartido a @${r.sharedWith}: la volvimos a enviar` : `Compartida con @${r.sharedWith}`);
        this.shared.emit(r.sharesCount);
        this.closed.emit();
      },
      error: (e) => {
        this.sending.set(null);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }
}
