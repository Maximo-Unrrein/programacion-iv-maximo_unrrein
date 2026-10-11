import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, errorMessage } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { Comment, Post } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { UiService } from '../../core/ui.service';
import { Avatar } from '../avatar';
import { Autofocus } from '../directives';
import { Icon } from '../icon';
import { AgoPipe, MediaPipe } from '../pipes';
import { RichText } from '../rich-text';
import { ShareDialog } from '../share-dialog';

/** Comentarios por página al presionar "cargar más". */
const COMMENTS_PAGE = 5;

/**
 * Publicación en dos paneles: el contenido (imagen o texto) a la izquierda y la conversación a la derecha.
 * En celular los paneles se deslizan horizontalmente en lugar de apilarse.
 */
@Component({
  selector: 'ms-post-card',
  imports: [NgTemplateOutlet, FormsModule, RouterLink, Avatar, Autofocus, Icon, RichText, ShareDialog, AgoPipe, MediaPipe],
  templateUrl: './post-card.html',
  host: { class: '@container block' },
})
export class PostCard {
  private readonly api = inject(PostsService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);
  private readonly confirm = inject(ConfirmService);

  readonly post = input.required<Post>();
  /** Vista grande en su propia página (/p/:id): más alta y sin el botón de "ver publicación". */
  readonly standalone = input(false);
  readonly removed = output<string>();
  /** Se guardó (`true`) o se quitó de guardados (`false`). */
  readonly saveChanged = output<boolean>();

  /** Copia local que se actualiza con me gusta y comentarios. */
  protected readonly state = linkedSignal(() => ({ ...this.post() }));
  protected readonly comments = linkedSignal<Comment[]>(() => this.post().comments);
  protected readonly hasMore = computed(() => this.comments().length < this.state().commentsCount);

  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly loadingComments = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editDraft = signal('');
  protected readonly savingEdit = signal(false);
  protected readonly burst = signal(false);
  protected readonly shareOpen = signal(false);
  protected readonly popKey = signal(0);

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('commentInput');

  protected readonly me = this.auth.user;
  protected readonly isOwn = computed(() => this.state().author?.id === this.auth.user()?.id);
  protected readonly canDelete = computed(() => this.isOwn() || this.auth.isAdmin());

  protected canDeleteComment(c: Comment) {
    return this.canDelete() || c.author?.id === this.auth.user()?.id;
  }

  // ---------- me gusta ----------

  protected toggleLike() {
    const before = this.state();
    const liked = !before.likedByMe;
    this.state.set({ ...before, likedByMe: liked, likesCount: before.likesCount + (liked ? 1 : -1) });
    if (liked) this.popKey.update((k) => k + 1);
    (liked ? this.api.like(before.id) : this.api.unlike(before.id)).subscribe({
      next: (r) => this.state.update((s) => ({ ...s, likedByMe: r.liked, likesCount: r.likesCount })),
      error: (e) => {
        this.state.set(before);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  // ---------- guardar y compartir ----------

  protected toggleSave() {
    const before = this.state();
    const saved = !before.savedByMe;
    this.state.set({ ...before, savedByMe: saved, savesCount: before.savesCount + (saved ? 1 : -1) });
    (saved ? this.api.save(before.id) : this.api.unsave(before.id)).subscribe({
      next: (r) => {
        this.state.update((s) => ({ ...s, savedByMe: r.saved, savesCount: r.savesCount }));
        this.ui.toast(r.saved ? 'Guardada en tus guardados' : 'Quitada de tus guardados');
        this.saveChanged.emit(r.saved);
      },
      error: (e) => {
        this.state.set(before);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  protected onShared(sharesCount: number) {
    this.state.update((s) => ({ ...s, sharesCount }));
  }

  /** Doble toque sobre el contenido: da me gusta (nunca lo quita). */
  protected likeFromMedia() {
    this.burst.set(false);
    requestAnimationFrame(() => this.burst.set(true));
    if (!this.state().likedByMe) this.toggleLike();
  }

  // ---------- comentarios ----------

  /** Trae los siguientes comentarios (más antiguos) y los agrega debajo de los ya mostrados. */
  protected loadMoreComments() {
    this.loadingComments.set(true);
    this.api.comments(this.state().id, this.comments().length, COMMENTS_PAGE).subscribe({
      next: (page) => {
        this.comments.update((list) => {
          const known = new Set(list.map((c) => c.id));
          return [...list, ...page.items.filter((c) => !known.has(c.id))];
        });
        this.state.update((s) => ({ ...s, commentsCount: page.total }));
        this.loadingComments.set(false);
      },
      error: (e) => {
        this.loadingComments.set(false);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  protected sendComment() {
    const content = this.draft().trim();
    if (!content || this.sending()) return;
    this.sending.set(true);
    this.api.addComment(this.state().id, content).subscribe({
      next: (comment) => {
        // El nuevo queda primero: la lista va de más reciente a más antiguo
        this.comments.update((list) => [comment, ...list]);
        this.state.update((s) => ({ ...s, commentsCount: s.commentsCount + 1 }));
        this.draft.set('');
        this.sending.set(false);
        requestAnimationFrame(() => this.list()?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' }));
      },
      error: (e) => {
        this.sending.set(false);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  protected startEdit(comment: Comment) {
    this.editingId.set(comment.id);
    this.editDraft.set(comment.content);
  }

  protected cancelEdit() {
    this.editingId.set(null);
  }

  protected saveEdit(comment: Comment) {
    const content = this.editDraft().trim();
    if (!content || this.savingEdit()) return;
    if (content === comment.content) return this.cancelEdit();
    this.savingEdit.set(true);
    this.api.updateComment(comment.id, content).subscribe({
      next: (updated) => {
        this.comments.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        this.editingId.set(null);
        this.savingEdit.set(false);
        this.ui.toast('Comentario editado');
      },
      error: (e) => {
        this.savingEdit.set(false);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  protected removeComment(comment: Comment) {
    this.api.removeComment(comment.id).subscribe({
      next: () => {
        this.comments.update((list) => list.filter((c) => c.id !== comment.id));
        this.state.update((s) => ({ ...s, commentsCount: Math.max(0, s.commentsCount - 1) }));
      },
      error: (e) => this.ui.toast(errorMessage(e), 'error'),
    });
  }

  // ---------- post ----------

  protected async deletePost() {
    const post = this.state();
    const accepted = await this.confirm.ask({
      title: this.isOwn() ? '¿Eliminar tu publicación?' : '¿Dar de baja esta publicación?',
      message: this.isOwn()
        ? `"${post.title}" y sus comentarios dejarán de estar disponibles.`
        : `La publicación "${post.title}" de @${post.author?.username} y sus comentarios dejarán de estar disponibles.`,
      confirmText: this.isOwn() ? 'Eliminar' : 'Dar de baja',
      danger: true,
    });
    if (!accepted) return;
    this.api.remove(post.id).subscribe({
      next: () => {
        this.ui.toast('Publicación eliminada');
        this.removed.emit(post.id);
      },
      error: (e) => this.ui.toast(errorMessage(e), 'error'),
    });
  }

  // ---------- navegación entre paneles (celular) ----------

  protected showComments(focus = false) {
    const track = this.track().nativeElement;
    if (track.scrollWidth > track.clientWidth) {
      track.scrollTo({ left: track.clientWidth, behavior: 'smooth' });
    }
    if (focus) setTimeout(() => this.input()?.nativeElement.focus({ preventScroll: true }), 350);
  }

  protected showContent() {
    this.track().nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
  }
}
