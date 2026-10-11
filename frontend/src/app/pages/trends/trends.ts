import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Post, TrendSort, TrendWindow } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { AgoPipe, MediaPipe } from '../../shared/pipes';
import { PostCard } from '../../shared/post-card/post-card';

const SORTS: { id: 'populares' | 'recientes'; value: TrendSort; label: string; hint: string }[] = [
  { id: 'populares', value: 'popular', label: 'Popularidad', hint: 'Me gusta + comentarios de lo publicado en el período' },
  { id: 'recientes', value: 'recent', label: 'Me gusta recientes', hint: 'Lo que más me gusta recibió en el período, sin importar cuándo se publicó' },
];
const WINDOWS: { value: TrendWindow; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
];

/** Ranking de publicaciones con filtros en la URL: ?orden=populares|recientes&periodo=24h|7d|30d&tag=x */
@Component({
  selector: 'ms-trends',
  imports: [Icon, Modal, PostCard, MediaPipe, AgoPipe],
  templateUrl: './trends.html',
})
export class Trends {
  private readonly api = inject(PostsService);
  private readonly router = inject(Router);

  // Query params
  readonly orden = input<string>();
  readonly periodo = input<string>();
  readonly tag = input<string>();

  protected readonly sorts = SORTS;
  protected readonly windows = WINDOWS;
  protected readonly sort = computed(() => SORTS.find((s) => s.id === this.orden()) ?? SORTS[0]);
  protected readonly window = computed(() => WINDOWS.find((w) => w.value === this.periodo())?.value ?? '7d');

  protected readonly ranking = rxResource({
    params: () => ({ sort: this.sort().value, window: this.window(), tag: this.tag() || undefined }),
    stream: ({ params }) => this.api.trending(params.sort, params.window, params.tag),
  });
  protected readonly tags = rxResource({
    params: () => this.window(),
    stream: ({ params }) => this.api.trendingTags(params),
  });

  protected readonly selected = signal<Post | null>(null);

  protected setFilter(params: Record<string, string | null>) {
    this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected onRemoved(id: string) {
    this.selected.set(null);
    this.ranking.update((list) => list?.filter((i) => i.post.id !== id));
  }

  protected rank(i: number) {
    return String(i + 1).padStart(2, '0');
  }
}
