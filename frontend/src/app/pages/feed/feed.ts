import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService, errorMessage } from '../../core/auth.service';
import { FeedSort, Post } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { UiService } from '../../core/ui.service';
import { Avatar } from '../../shared/avatar';
import { InfiniteScroll } from '../../shared/directives';
import { Icon } from '../../shared/icon';
import { PostCard } from '../../shared/post-card/post-card';

const PAGE = 8;

@Component({
  selector: 'ms-feed',
  imports: [PostCard, Avatar, Icon, InfiniteScroll],
  templateUrl: './feed.html',
})
export class Feed {
  private readonly api = inject(PostsService);
  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiService);

  protected readonly posts = signal<Post[]>([]);
  protected readonly loading = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Orden del listado: más recientes (por defecto) o más me gusta. */
  protected readonly sort = signal<FeedSort>('fecha');
  protected readonly sorts: { id: FeedSort; label: string }[] = [
    { id: 'fecha', label: 'Más recientes' },
    { id: 'likes', label: 'Más me gusta' },
    { id: 'guardados', label: 'Más guardadas' },
    { id: 'compartidos', label: 'Más compartidas' },
  ];

  constructor() {
    this.loadMore();

    this.ui.postCreated.pipe(takeUntilDestroyed()).subscribe((post) => this.posts.update((list) => [post, ...list]));

  }

  protected loadMore() {
    if (this.loading() || this.done()) return;
    this.loading.set(true);
    this.api.feed({ sort: this.sort(), offset: this.posts().length, limit: PAGE }).subscribe({
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

  protected setSort(sort: FeedSort) {
    if (sort === this.sort()) return;
    this.sort.set(sort);
    this.posts.set([]);
    this.done.set(false);
    this.error.set(null);
    this.loadMore();
  }

  protected onRemoved(id: string) {
    this.posts.update((list) => list.filter((p) => p.id !== id));
  }
}
