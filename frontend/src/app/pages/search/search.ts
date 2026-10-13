import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { errorMessage } from '../../core/auth.service';
import { Author, Post } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { Avatar } from '../../shared/avatar';
import { Autofocus, InfiniteScroll } from '../../shared/directives';
import { Icon } from '../../shared/icon';
import { PostCard } from '../../shared/post-card/post-card';

const PAGE = 6;

/** Búsqueda por texto: personas (usuario o nombre) y publicaciones (título o mensaje). */
@Component({
  selector: 'ms-search',
  imports: [PostCard, Avatar, Icon, InfiniteScroll, Autofocus, RouterLink],
  template: `
    <div class="mx-auto grid w-full max-w-[880px] content-start gap-6">
      <header>
        <p class="font-display text-xs font-semibold tracking-[0.32em] text-muted uppercase">Explorar</p>
        <h1 class="mt-1 text-3xl font-bold">Buscar</h1>
      </header>

      <label class="group relative block">
        <span class="sr-only">Buscar en MaxSend</span>
        <ms-icon name="search" class="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-faint transition group-focus-within:text-fg" />
        <input
          msAutofocus
          type="search"
          maxlength="60"
          class="min-h-14 w-full rounded-full border border-line bg-surface pr-12 pl-13 text-base backdrop-blur-xl outline-none transition duration-300 placeholder:text-faint focus:border-line-strong focus:bg-surface-strong/60"
          placeholder="Personas, títulos, mensajes o #hashtags"
          autocomplete="off"
          [value]="term()"
          (input)="term.set($any($event.target).value)"
        />
        @if (term()) {
          <button type="button" class="icon-btn absolute top-1/2 right-1.5 size-10 -translate-y-1/2" aria-label="Borrar búsqueda" (click)="term.set('')">
            <ms-icon name="close" class="size-4" />
          </button>
        }
      </label>

      @if (!query()) {
        <div class="grid justify-items-center gap-3 py-16 text-center text-muted">
          <ms-icon name="search" class="size-10 text-faint" />
          <p>Escribí algo para empezar a explorar.</p>
        </div>
      } @else {
        @if (error()) {
          <p class="rounded-2xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{{ error() }}</p>
        }

        @if (users().length) {
          <section class="grid gap-3" aria-label="Personas">
            <h2 class="text-sm font-semibold text-muted">Personas</h2>
            <div class="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
              @for (u of users(); track u.id) {
                <a
                  [routerLink]="['/u', u.username]"
                  class="flex shrink-0 items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pr-4 pl-1.5 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-line-strong"
                >
                  <ms-avatar [user]="u" [size]="32" />
                  <span class="grid leading-tight">
                    <span class="text-sm font-medium">{{ u.displayName }}</span>
                    <span class="text-xs text-faint">&#64;{{ u.username }}</span>
                  </span>
                </a>
              }
            </div>
          </section>
        }

        <section class="grid gap-6" aria-label="Publicaciones">
          <h2 class="text-sm font-semibold text-muted">Publicaciones</h2>
          @for (post of posts(); track post.id) {
            <ms-post-card [post]="post" (removed)="drop(post.id)" class="animate-rise" />
          } @empty {
            @if (!loading() && !error()) {
              <p class="py-10 text-center text-muted">No encontramos publicaciones para “{{ query() }}”.</p>
            }
          }
          @if (loading()) {
            <div class="glass h-[360px] animate-shimmer bg-linear-90 from-surface via-surface-strong to-surface bg-size-[200%_100%]"></div>
          }
          <div (msInfiniteScroll)="loadMore()" aria-hidden="true"></div>
        </section>
      }
    </div>
  `,
})
export class Search {
  private readonly api = inject(PostsService);
  private readonly router = inject(Router);

  /** Texto de la URL (`/buscar?q=`), así la búsqueda se puede compartir o recargar. */
  readonly q = input('', { transform: (value: string | undefined) => value ?? '' });
  /** Lo que el usuario está escribiendo. */
  protected readonly term = linkedSignal(() => this.q());
  /** Búsqueda en curso (el texto después del debounce). */
  protected readonly query = signal('');

  protected readonly users = signal<Author[]>([]);
  protected readonly posts = signal<Post[]>([]);
  protected readonly loading = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    toObservable(this.term)
      .pipe(
        map((t) => t.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((text) => this.run(text));
  }

  private run(text: string) {
    this.query.set(text);
    this.posts.set([]);
    this.users.set([]);
    this.done.set(false);
    this.loading.set(false);
    this.error.set(null);
    this.router.navigate([], { queryParams: { q: text || null }, replaceUrl: true });
    if (!text) return;
    // Para personas se ignora el @ o # inicial
    this.api.searchUsers(text.replace(/^[@#]/, '')).subscribe((list) => this.query() === text && this.users.set(list));
    this.loadMore();
  }

  protected loadMore() {
    const text = this.query();
    if (!text || this.loading() || this.done()) return;
    this.loading.set(true);
    this.api.feed({ q: text, offset: this.posts().length, limit: PAGE }).subscribe({
      next: (page) => {
        if (this.query() !== text) return; // llegó tarde: ya se busca otra cosa
        this.posts.update((list) => [...list, ...page]);
        this.done.set(page.length < PAGE);
        this.loading.set(false);
      },
      error: (e) => {
        if (this.query() !== text) return;
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected drop(id: string) {
    this.posts.update((list) => list.filter((p) => p.id !== id));
  }
}
