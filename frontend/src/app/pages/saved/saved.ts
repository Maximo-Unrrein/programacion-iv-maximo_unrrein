import { Component, inject, signal } from '@angular/core';
import { errorMessage } from '../../core/auth.service';
import { Post } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { InfiniteScroll } from '../../shared/directives';
import { Icon } from '../../shared/icon';
import { PostCard } from '../../shared/post-card/post-card';

const PAGE = 6;

/** Pantalla "Guardados": las publicaciones que guardé, para ver e interactuar con ellas. */
@Component({
  selector: 'ms-saved',
  imports: [PostCard, Icon, InfiniteScroll],
  template: `
    <div class="mx-auto grid w-full max-w-[880px] content-start gap-6">
      <header>
        <p class="font-display text-xs font-semibold tracking-[0.32em] text-muted uppercase">Tu colección</p>
        <h1 class="mt-1 text-3xl font-bold">Guardados</h1>
        <p class="text-sm text-faint">Las publicaciones que guardaste, las más recientes primero.</p>
      </header>

      @if (error()) {
        <p class="rounded-2xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{{ error() }}</p>
      }

      @for (post of posts(); track post.id) {
        <ms-post-card [post]="post" (removed)="drop(post.id)" (saveChanged)="!$event && drop(post.id)" class="animate-rise" />
      } @empty {
        @if (!loading() && !error()) {
          <div class="grid justify-items-center gap-3 py-20 text-center text-muted">
            <ms-icon name="bookmark" class="size-10 text-faint" />
            <p>Todavía no guardaste publicaciones.</p>
            <p class="text-sm text-faint">Tocá el ícono de guardar en cualquier publicación para tenerla acá.</p>
          </div>
        }
      }

      @if (loading()) {
        <div class="glass h-[360px] animate-shimmer bg-linear-90 from-surface via-surface-strong to-surface bg-size-[200%_100%]"></div>
      }
      <div (msInfiniteScroll)="loadMore()" aria-hidden="true"></div>
    </div>
  `,
})
export class Saved {
  private readonly api = inject(PostsService);
  protected readonly posts = signal<Post[]>([]);
  protected readonly loading = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.loadMore();
  }

  protected loadMore() {
    if (this.loading() || this.done()) return;
    this.loading.set(true);
    this.api.saved(this.posts().length, PAGE).subscribe({
      next: (page) => {
        this.posts.update((list) => [...list, ...page]);
        this.done.set(page.length < PAGE);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  /** Si se quita de guardados (o se da de baja), sale de la lista. */
  protected drop(id: string) {
    this.posts.update((list) => list.filter((p) => p.id !== id));
  }
}
