import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagTrend, TrendItem } from '../core/models';
import { PostsService } from '../core/posts.service';
import { Icon } from './icon';
import { MediaPipe } from './pipes';

/** Columna lateral (sin caja) con hashtags de la semana y lo que más me gusta recibió en 24 h. */
@Component({
  selector: 'ms-trends-panel',
  imports: [RouterLink, Icon, MediaPipe],
  template: `
    <section class="grid gap-3">
      <header>
        <h2 class="flex items-center gap-2 font-display text-sm font-semibold">
          <ms-icon name="hash" class="size-4 text-faint" /> En órbita
        </h2>
        <p class="mt-0.5 text-xs text-faint">Los hashtags más usados esta semana</p>
      </header>
      <div class="flex flex-wrap gap-2">
        @for (t of tags(); track t.tag) {
          <a routerLink="/tendencias" [queryParams]="{ tag: t.tag }" class="tag-chip">#{{ t.tag }} <span class="text-faint">{{ t.count }}</span></a>
        } @empty {
          <p class="text-sm text-faint">Sin hashtags esta semana.</p>
        }
      </div>
    </section>

    <section class="grid gap-3">
      <header>
        <h2 class="flex items-center gap-2 font-display text-sm font-semibold">
          <ms-icon name="flame" class="size-4 text-faint" /> Me gusta · 24 h
        </h2>
        <p class="mt-0.5 text-xs text-faint">Lo que más me gusta recibió hoy</p>
      </header>
      @for (item of hot(); track item.post.id; let i = $index) {
        <a routerLink="/tendencias" [queryParams]="{ orden: 'recientes', periodo: '24h' }" class="group flex items-center gap-3">
          <span class="w-6 font-display text-2xl font-bold" [class]="i === 0 ? 'brand-text' : 'text-outline'">{{ i + 1 }}</span>
          @if (item.post.imageUrl) {
            <img [src]="item.post.imageUrl | media" alt="" class="size-12 rounded-xl object-cover" />
          }
          <span class="min-w-0 flex-1">
            <span class="line-clamp-2 text-sm text-muted transition group-hover:text-fg">{{ item.post.title }}</span>
            <span class="text-xs text-faint">{{ item.metric }} me gusta</span>
          </span>
        </a>
      } @empty {
        <p class="text-sm text-faint">Nada por acá todavía.</p>
      }
      <a routerLink="/tendencias" class="inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-fg">
        Ver tendencias <ms-icon name="arrow-right" class="size-4" />
      </a>
    </section>
  `,
  // Sin caja ni bordes: sólo títulos con su descripción, alineado con la navegación
  host: { class: 'grid gap-10 pt-[4.75rem]' },
})
export class TrendsPanel {
  private readonly api = inject(PostsService);
  protected readonly tags = signal<TagTrend[]>([]);
  protected readonly hot = signal<TrendItem[]>([]);

  constructor() {
    this.api.trendingTags('7d').subscribe((t) => this.tags.set(t.slice(0, 8)));
    this.api.trending('recent', '24h').subscribe((t) => this.hot.set(t.slice(0, 3)));
  }
}
