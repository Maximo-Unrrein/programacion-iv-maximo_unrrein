import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { debounceTime, distinctUntilChanged, interval, of, switchMap } from 'rxjs';
import { AuthService, errorMessage } from '../../core/auth.service';
import { MessagesService } from '../../core/messages.service';
import { Author, Conversation, Message } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { UiService } from '../../core/ui.service';
import { Avatar } from '../../shared/avatar';
import { Autofocus, Autosize } from '../../shared/directives';
import { Icon } from '../../shared/icon';
import { AgoPipe, MediaPipe } from '../../shared/pipes';

/** Cada cuánto se buscan mensajes nuevos con la conversación abierta. */
const POLL_MS = 5000;

/**
 * Mensajes directos: lista de conversaciones y la conversación elegida (`/mensajes/:username`).
 * En pantallas angostas se ve una cosa por vez; en anchas, las dos lado a lado.
 */
@Component({
  selector: 'ms-messages',
  imports: [FormsModule, RouterLink, RouterLinkActive, Avatar, Autofocus, Autosize, Icon, AgoPipe, MediaPipe],
  template: `
    <div class="@container mx-auto w-full max-w-[880px]">
      <div class="glass grid h-[calc(100dvh-11.5rem)] min-h-80 overflow-hidden md:h-[calc(100dvh-7rem)] @2xl:grid-cols-[240px_minmax(0,1fr)]">
        <!-- ===== Conversaciones ===== -->
        <aside class="min-h-0 flex-col border-line @2xl:flex @2xl:border-r" [class]="username() ? 'hidden' : 'flex'" aria-label="Conversaciones">
          <header class="grid gap-3 border-b border-line p-4">
            <h1 class="text-xl font-bold">Mensajes</h1>
            <label class="relative block">
              <span class="sr-only">Buscar a alguien para escribirle</span>
              <ms-icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input
                class="min-h-10 w-full rounded-full border border-line bg-surface pr-3 pl-9 text-sm outline-none transition placeholder:text-faint focus:border-line-strong"
                placeholder="Nuevo mensaje a…"
                autocomplete="off"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </label>
          </header>

          <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
            @if (search().trim()) {
              @for (u of found(); track u.id) {
                <a [routerLink]="['/mensajes', u.username]" class="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-surface" (click)="search.set('')">
                  <ms-avatar [user]="u" [size]="36" />
                  <span class="grid min-w-0 leading-tight">
                    <span class="truncate text-sm font-medium">{{ u.displayName }}</span>
                    <span class="truncate text-xs text-faint">&#64;{{ u.username }}</span>
                  </span>
                </a>
              } @empty {
                <p class="p-4 text-center text-sm text-faint">Sin resultados.</p>
              }
            } @else {
              @for (c of conversations(); track c.user.id) {
                <a
                  [routerLink]="['/mensajes', c.user.username]"
                  routerLinkActive="bg-surface-strong"
                  class="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-surface"
                >
                  <ms-avatar [user]="c.user" [size]="40" />
                  <span class="grid min-w-0 flex-1 leading-tight">
                    <span class="flex items-baseline gap-2">
                      <span class="truncate text-sm" [class]="c.unread ? 'font-bold' : 'font-medium'">{{ c.user.displayName }}</span>
                      <span class="ml-auto shrink-0 text-[11px] text-faint">{{ c.last.createdAt | ago }}</span>
                    </span>
                    <span class="flex items-center gap-2">
                      <span class="truncate text-xs" [class]="c.unread ? 'text-fg' : 'text-faint'">
                        {{ c.last.fromMe ? 'Vos: ' : '' }}{{ c.last.content || (c.last.hasPost ? 'Compartió una publicación' : '') }}
                      </span>
                      @if (c.unread) {
                        <span class="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-brand">{{ c.unread }}</span>
                      }
                    </span>
                  </span>
                </a>
              } @empty {
                @if (!loadingList()) {
                  <div class="grid justify-items-center gap-2 px-4 py-12 text-center text-sm text-faint">
                    <ms-icon name="message" class="size-8" />
                    Todavía no tenés conversaciones.<br />Buscá a alguien arriba para escribirle.
                  </div>
                }
              }
            }
          </div>
        </aside>

        <!-- ===== Conversación ===== -->
        <section class="min-h-0 flex-col @2xl:flex" [class]="username() ? 'flex' : 'hidden'" aria-label="Conversación">
          @if (username()) {
            <header class="flex items-center gap-2 border-b border-line px-2 py-2.5 @2xl:px-4">
              <a routerLink="/mensajes" class="icon-btn size-10 @2xl:hidden" aria-label="Volver a las conversaciones">
                <ms-icon name="arrow-left" />
              </a>
              @if (other(); as u) {
                <a [routerLink]="['/u', u.username]" class="flex min-w-0 items-center gap-3">
                  <ms-avatar [user]="u" [size]="36" />
                  <span class="grid min-w-0 leading-tight">
                    <span class="truncate font-semibold">{{ u.displayName }}</span>
                    <span class="truncate text-xs text-faint">&#64;{{ u.username }}</span>
                  </span>
                </a>
              }
            </header>

            <div #scroller class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-4 @2xl:px-5">
              @if (hasOlder()) {
                <button type="button" class="mx-auto mb-4 block cursor-pointer text-xs font-semibold text-muted hover:text-fg" [disabled]="loadingOlder()" (click)="loadOlder()">
                  {{ loadingOlder() ? 'Cargando…' : 'Ver mensajes anteriores' }}
                </button>
              }
              @if (threadError()) {
                <p class="grid h-full place-items-center text-center text-sm text-faint">{{ threadError() }}</p>
              }
              <ol class="grid gap-1.5">
                @for (m of ordered(); track m.id; let i = $index) {
                  <li class="flex animate-fade-in flex-col" [class]="m.fromMe ? 'items-end' : 'items-start'">
                    <div
                      class="max-w-[82%] rounded-3xl px-4 py-2 text-[15px] leading-snug"
                      [class]="m.fromMe ? 'rounded-br-lg bg-primary text-on-brand' : 'rounded-bl-lg border border-line bg-surface-strong'"
                    >
                      @if (m.post) {
                        <a [routerLink]="['/p', m.post.id]" class="my-1 flex items-center gap-3 rounded-2xl bg-ink/20 p-2 transition hover:bg-ink/30">
                          @if (m.post.imageUrl) {
                            <img [src]="m.post.imageUrl | media" alt="" class="size-12 rounded-xl object-cover" />
                          } @else {
                            <span class="grid size-12 shrink-0 place-items-center rounded-xl bg-ink/30 font-display font-bold">Aa</span>
                          }
                          <span class="grid min-w-0 leading-tight">
                            <span class="text-[11px] opacity-70">Publicación de &#64;{{ m.post.author?.username }}</span>
                            <span class="truncate font-semibold">{{ m.post.title }}</span>
                          </span>
                        </a>
                      } @else if (m.postUnavailable) {
                        <span class="italic opacity-70">Publicación no disponible</span>
                      }
                      @if (m.content) {
                        <span class="whitespace-pre-wrap wrap-anywhere">{{ m.content }}</span>
                      }
                    </div>
                    <!-- Hora y "visto" sólo al final de cada tanda -->
                    @if (isLastOfRun(i)) {
                      <span class="mt-0.5 mb-1.5 px-2 text-[11px] text-faint">
                        {{ m.createdAt | ago }}{{ m.fromMe && m.readAt ? ' · visto' : '' }}
                      </span>
                    }
                  </li>
                } @empty {
                  @if (!loadingThread() && !threadError()) {
                    <li class="grid justify-items-center gap-2 py-16 text-center text-sm text-faint">
                      <ms-icon name="message" class="size-8" />
                      Empezá la conversación con &#64;{{ username() }}.
                    </li>
                  }
                }
              </ol>
            </div>

            <form class="flex items-end gap-2 border-t border-line p-2.5 @2xl:px-4" (ngSubmit)="send()">
              <label class="sr-only" for="dm-input">Escribí un mensaje</label>
              <textarea
                id="dm-input"
                name="message"
                rows="1"
                msAutosize
                [msAutosizeMax]="140"
                msAutofocus
                maxlength="1000"
                class="scrollbar-thin min-h-11 flex-1 resize-none rounded-3xl border border-line bg-surface px-4 py-2.5 text-[15px] outline-none transition placeholder:text-faint focus:border-line-strong"
                placeholder="Escribí un mensaje…"
                [ngModel]="draft()"
                (ngModelChange)="draft.set($event)"
                (keydown.enter)="onEnter($any($event))"
              ></textarea>
              <button type="submit" class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-primary text-on-brand transition active:scale-90 disabled:opacity-40" [disabled]="!draft().trim() || sending() || !!threadError()" aria-label="Enviar mensaje">
                <ms-icon name="send" class="size-5" />
              </button>
            </form>
          } @else {
            <div class="grid h-full place-items-center p-8 text-center text-sm text-faint">
              <span class="grid justify-items-center gap-2">
                <ms-icon name="message" class="size-10" />
                Elegí una conversación o buscá a alguien para escribirle.
              </span>
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class Messages {
  private readonly api = inject(MessagesService);
  private readonly posts = inject(PostsService);
  private readonly ui = inject(UiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Usuario de la conversación abierta (de la URL). */
  readonly username = input<string>();

  protected readonly conversations = signal<Conversation[]>([]);
  protected readonly loadingList = signal(true);
  protected readonly search = signal('');
  protected readonly found = signal<Author[]>([]);

  protected readonly other = signal<Author | null>(null);
  /** Mensajes de la conversación, los más nuevos primero (como los devuelve la API). */
  protected readonly items = signal<Message[]>([]);
  protected readonly ordered = computed(() => [...this.items()].reverse());
  protected readonly hasOlder = signal(false);
  protected readonly loadingThread = signal(false);
  protected readonly loadingOlder = signal(false);
  protected readonly threadError = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    this.loadConversations();

    // Al cambiar de conversación se carga de cero
    effect(() => {
      const username = this.username();
      untracked(() => this.openThread(username));
    });

    // Mensajes nuevos de la conversación abierta y de la lista
    interval(POLL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe((tick) => {
        if (document.hidden) return;
        this.pollThread();
        if (tick % 3 === 2) this.loadConversations();
      });

    // Buscar a quién escribirle
    toObservable(this.search)
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => (q.trim() ? this.posts.searchUsers(q.trim().replace(/^@/, '')) : of([]))),
        takeUntilDestroyed(),
      )
      .subscribe((list) => this.found.set(list));

    inject(DestroyRef).onDestroy(() => this.api.refreshUnread().subscribe());
  }

  /** La hora va sólo en el último mensaje de cada tanda seguida del mismo autor. */
  protected isLastOfRun(i: number) {
    const list = this.ordered();
    return i === list.length - 1 || list[i + 1].fromMe !== list[i].fromMe;
  }

  /** Enter envía; Shift+Enter hace un salto de línea. */
  protected onEnter(event: KeyboardEvent) {
    if (event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.send();
  }

  protected send() {
    const username = this.username();
    const content = this.draft().trim();
    if (!username || !content || this.sending()) return;
    this.sending.set(true);
    this.api.send(username, content).subscribe({
      next: (message) => {
        this.items.update((list) => [message, ...list]);
        this.draft.set('');
        this.sending.set(false);
        this.scrollToBottom();
        this.loadConversations();
      },
      error: (e) => {
        this.sending.set(false);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  protected loadOlder() {
    const username = this.username();
    const oldest = this.items().at(-1);
    if (!username || !oldest) return;
    this.loadingOlder.set(true);
    const el = this.scroller()?.nativeElement;
    const fromBottom = el ? el.scrollHeight - el.scrollTop : 0;
    this.api.thread(username, oldest.createdAt).subscribe({
      next: (page) => {
        this.items.update((list) => [...list, ...page.items]);
        this.hasOlder.set(page.hasMore);
        this.loadingOlder.set(false);
        // Mantiene a la vista el mismo mensaje después de agregar los anteriores arriba
        requestAnimationFrame(() => el && (el.scrollTop = el.scrollHeight - fromBottom));
      },
      error: () => this.loadingOlder.set(false),
    });
  }

  private loadConversations() {
    this.api.conversations().subscribe({
      next: (list) => {
        this.conversations.set(list);
        this.loadingList.set(false);
      },
      error: () => this.loadingList.set(false),
    });
  }

  private openThread(username: string | undefined) {
    this.items.set([]);
    this.other.set(null);
    this.threadError.set(null);
    this.hasOlder.set(false);
    this.draft.set('');
    if (!username) return;
    if (username === this.auth.user()?.username) {
      this.router.navigateByUrl('/mensajes');
      return;
    }
    this.loadingThread.set(true);
    this.api.thread(username).subscribe({
      next: (page) => {
        if (this.username() !== username) return;
        this.other.set(page.user);
        this.items.set(page.items);
        this.hasOlder.set(page.hasMore);
        this.loadingThread.set(false);
        this.scrollToBottom(false);
        // Al abrirla se marcaron como leídos: se actualizan la lista y el indicador
        this.conversations.update((list) => list.map((c) => (c.user.username === username ? { ...c, unread: 0 } : c)));
        this.api.refreshUnread().subscribe();
      },
      error: (e) => {
        this.loadingThread.set(false);
        this.threadError.set(errorMessage(e));
      },
    });
  }

  /** Trae lo último y agrega lo que no estaba (y actualiza el "visto" de los propios). */
  private pollThread() {
    const username = this.username();
    if (!username || this.threadError() || this.loadingThread()) return;
    this.api.thread(username, undefined, 20).subscribe((page) => {
      if (this.username() !== username) return;
      const byId = new Map(page.items.map((m) => [m.id, m]));
      const known = new Set(this.items().map((m) => m.id));
      const fresh = page.items.filter((m) => !known.has(m.id));
      this.items.update((list) => [...fresh, ...list.map((m) => byId.get(m.id) ?? m)]);
      if (fresh.length) {
        this.scrollToBottom();
        this.api.refreshUnread().subscribe();
      }
    });
  }

  private scrollToBottom(smooth = true) {
    requestAnimationFrame(() => {
      const el = this.scroller()?.nativeElement;
      el?.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }
}
