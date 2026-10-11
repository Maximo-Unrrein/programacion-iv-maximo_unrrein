import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../core/auth.service';
import { SharedItem } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { Avatar } from '../../shared/avatar';
import { InfiniteScroll } from '../../shared/directives';
import { Icon } from '../../shared/icon';
import { AgoPipe } from '../../shared/pipes';
import { PostCard } from '../../shared/post-card/post-card';

const PAGE = 6;

/** Pantalla "Compartidos conmigo": publicaciones que otros usuarios me compartieron y quién lo hizo. */
@Component({
  selector: 'ms-shared-with-me',
  imports: [RouterLink, PostCard, Avatar, Icon, AgoPipe, InfiniteScroll],
  template: `
    <div class="mx-auto grid w-full max-w-[880px] content-start gap-6">
      <header>
        <p class="font-display text-xs font-semibold tracking-[0.32em] text-muted uppercase">Bandeja</p>
        <h1 class="mt-1 text-3xl font-bold">Compartidos conmigo</h1>
        <p class="text-sm text-faint">Publicaciones que otros usuarios te compartieron.</p>
      </header>

      @if (error()) {
        <p class="rounded-2xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{{ error() }}</p>
      }

      @for (item of items(); track item.id) {
        <section class="grid animate-rise gap-2">
          <p class="flex items-center gap-2 px-1 text-sm text-muted">
            <ms-icon name="share" class="size-4 text-faint" />
            <a [routerLink]="['/u', item.sharedBy?.username]" class="inline-flex items-center gap-2 font-semibold text-fg hover:underline">
              <ms-avatar [user]="item.sharedBy" [size]="22" /> {{ item.sharedBy?.displayName }}
            </a>
            te compartió esta publicación · {{ item.sharedAt | ago }}
          </p>
          <ms-post-card [post]="item.post" (removed)="drop(item.id)" />
        </section>
      } @empty {
        @if (!loading() && !error()) {
          <div class="grid justify-items-center gap-3 py-20 text-center text-muted">
            <ms-icon name="inbox" class="size-10 text-faint" />
            <p>Todavía nadie te compartió publicaciones.</p>
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
export class SharedWithMe {
  private readonly api = inject(PostsService);
  protected readonly items = signal<SharedItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.loadMore();
  }

  protected loadMore() {
    if (this.loading() || this.done()) return;
    this.loading.set(true);
    this.api.shared(this.items().length, PAGE).subscribe({
      next: (page) => {
        this.items.update((list) => [...list, ...page]);
        this.done.set(page.length < PAGE);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected drop(id: string) {
    this.items.update((list) => list.filter((i) => i.id !== id));
  }
}
