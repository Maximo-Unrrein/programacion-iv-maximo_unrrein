import { Location } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { errorMessage } from '../../core/auth.service';
import { Post } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { Icon } from '../../shared/icon';
import { PostCard } from '../../shared/post-card/post-card';

/** Página de una publicación: se ve en grande junto con sus comentarios. */
@Component({
  selector: 'ms-post-page',
  imports: [PostCard, Icon],
  template: `
    <div class="mx-auto grid max-w-[1100px] gap-4">
      <button type="button" class="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm text-muted transition hover:text-fg" (click)="back()">
        <ms-icon name="arrow-left" class="size-5" /> Volver
      </button>

      @if (post(); as p) {
        <ms-post-card [post]="p" [standalone]="true" (removed)="onRemoved()" class="animate-rise" />
      } @else if (error()) {
        <div class="grid justify-items-center gap-3 py-24 text-center text-muted">
          <ms-icon name="comment" class="size-10 text-faint" />
          <p>{{ error() }}</p>
        </div>
      } @else {
        <div class="glass h-[min(80dvh,760px)] animate-shimmer bg-linear-90 from-surface via-surface-strong to-surface bg-size-[200%_100%]"></div>
      }
    </div>
  `,
})
export class PostPage {
  private readonly api = inject(PostsService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Parámetro de ruta /p/:id */
  readonly id = input.required<string>();

  protected readonly post = signal<Post | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      this.post.set(null);
      this.error.set(null);
      this.api.findOne(id).subscribe({
        next: (p) => this.post.set(p),
        error: (e) => this.error.set(errorMessage(e)),
      });
    });
  }

  protected back() {
    if (history.length > 1) this.location.back();
    else this.router.navigateByUrl('/feed');
  }

  protected onRemoved() {
    this.router.navigateByUrl('/feed');
  }
}
