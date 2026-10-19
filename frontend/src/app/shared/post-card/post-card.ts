import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, errorMessage } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ReportService } from '../../core/report.service';
import { Comment, Post } from '../../core/models';
import { PostsService } from '../../core/posts.service';
import { UiService } from '../../core/ui.service';
import { Avatar } from '../avatar';
import { Carousel } from '../carousel';
import { Autofocus } from '../directives';
import { Icon } from '../icon';
import { AgoPipe } from '../pipes';
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
  imports: [NgTemplateOutlet, FormsModule, RouterLink, Avatar, Autofocus, Carousel, Icon, RichText, ShareDialog, AgoPipe],
  templateUrl: './post-card.html',
  host: { class: '@container block' },
})
export class PostCard {
  private readonly api = inject(PostsService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);
  private readonly confirm = inject(ConfirmService);
  private readonly reports = inject(ReportService);

  readonly post = input.required<Post>();
  /** Vista grande en su propia página (/p/:id): más alta y sin el botón de "ver publicación". */
  readonly standalone = input(false);
  readonly removed = output<string>();
  /** Se guardó (`true`) o se quitó de guardados (`false`). */
  readonly saveChanged = output<boolean>();

  /** Copia local que se actualiza con me gusta y comentarios. */
  protected readonly state = linkedSignal(() => ({ ...this.post() }));
  /** Comentarios principales mostrados (las respuestas van aparte, por hilo). */
  protected readonly comments = linkedSignal<Comment[]>(() => this.post().comments);
  /** Cantidad de comentarios principales (`commentsCount` también cuenta las respuestas). */
  protected readonly topCount = linkedSignal(() => this.post().topCommentsCount ?? this.post().comments.length);
  protected readonly hasMore = computed(() => this.comments().length < this.topCount());

  /** Respuestas ya cargadas de cada hilo y cuáles están abiertos. */
  protected readonly replies = signal<Record<string, Comment[]>>({});
  protected readonly openThreads = signal<ReadonlySet<string>>(new Set());
  protected readonly loadingReplies = signal<string | null>(null);
  /** A qué comentario se está respondiendo (`rootId` es el principal del hilo). */
  protected readonly replyTo = signal<{ author: Comment['author']; id: string; rootId: string } | null>(null);

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
  protected readonly isAdmin = this.auth.isAdmin;
  /** Los administradores no reportan: moderan directamente. */
  protected readonly canReport = computed(() => !this.isOwn() && !this.auth.isAdmin());

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
        this.topCount.set(page.total);
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
    const reply = this.replyTo();
    this.sending.set(true);
    this.api.addComment(this.state().id, content, reply?.id).subscribe({
      next: (comment) => {
        if (comment.parentId) {
          // Respuesta: va al final de su hilo, que queda abierto
          const rootId = comment.parentId;
          this.replies.update((map) => ({ ...map, [rootId]: [...(map[rootId] ?? []), comment] }));
          this.patchComment(rootId, (c) => ({ ...c, repliesCount: c.repliesCount + 1 }));
          this.openThreads.update((set) => new Set(set).add(rootId));
          this.replyTo.set(null);
        } else {
          // El nuevo queda primero: la lista va de más reciente a más antiguo
          this.comments.update((list) => [comment, ...list]);
          this.topCount.update((n) => n + 1);
          requestAnimationFrame(() => this.list()?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' }));
        }
        this.state.update((s) => ({ ...s, commentsCount: s.commentsCount + 1 }));
        this.draft.set('');
        this.sending.set(false);
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
        this.patchComment(updated.id, () => updated);
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

  /** Borra un comentario; si es principal, se van también sus respuestas. */
  protected async removeComment(comment: Comment) {
    if (!comment.parentId && comment.repliesCount) {
      const n = comment.repliesCount;
      const accepted = await this.confirm.ask({
        title: '¿Borrar el comentario?',
        message: n === 1 ? 'También se va a borrar su respuesta.' : `También se van a borrar sus ${n} respuestas.`,
        confirmText: 'Borrar',
        danger: true,
      });
      if (!accepted) return;
    }
    this.api.removeComment(comment.id).subscribe({
      next: ({ removed }) => {
        if (comment.parentId) {
          const rootId = comment.parentId;
          this.replies.update((map) => ({ ...map, [rootId]: (map[rootId] ?? []).filter((r) => r.id !== comment.id) }));
          this.patchComment(rootId, (c) => ({ ...c, repliesCount: Math.max(0, c.repliesCount - 1) }));
        } else {
          this.comments.update((list) => list.filter((c) => c.id !== comment.id));
          this.topCount.update((n) => Math.max(0, n - 1));
        }
        if (this.replyTo()?.rootId === (comment.parentId ?? comment.id)) this.replyTo.set(null);
        this.state.update((s) => ({ ...s, commentsCount: Math.max(0, s.commentsCount - removed) }));
      },
      error: (e) => this.ui.toast(errorMessage(e), 'error'),
    });
  }

  // ---------- respuestas (hilos de un nivel) ----------

  protected isOpen(id: string) {
    return this.openThreads().has(id);
  }

  /** Abre o cierra el hilo; la primera vez trae las respuestas. */
  protected toggleReplies(root: Comment) {
    if (this.isOpen(root.id)) {
      this.openThreads.update((set) => {
        const next = new Set(set);
        next.delete(root.id);
        return next;
      });
      return;
    }
    const loaded = this.replies()[root.id];
    if (loaded && loaded.length >= root.repliesCount) {
      this.openThreads.update((set) => new Set(set).add(root.id));
      return;
    }
    this.loadingReplies.set(root.id);
    this.api.replies(root.id, 0, 50).subscribe({
      next: (page) => {
        this.replies.update((map) => ({ ...map, [root.id]: page.items }));
        this.patchComment(root.id, (c) => ({ ...c, repliesCount: page.total }));
        this.openThreads.update((set) => new Set(set).add(root.id));
        this.loadingReplies.set(null);
      },
      error: (e) => {
        this.loadingReplies.set(null);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  /** Prepara el campo de arriba para responder (a una respuesta se le antepone la mención). */
  protected startReply(comment: Comment, root: Comment) {
    this.replyTo.set({ author: comment.author, id: comment.id, rootId: root.id });
    if (comment.id !== root.id && comment.author && comment.author.id !== this.me()?.id) {
      const mention = `@${comment.author.username} `;
      if (!this.draft().startsWith(mention)) this.draft.set(mention + this.draft());
    }
    this.showComments();
    this.list()?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => this.input()?.nativeElement.focus({ preventScroll: true }), 50);
  }

  protected cancelReply() {
    this.replyTo.set(null);
  }

  // ---------- me gusta en comentarios ----------

  protected toggleCommentLike(comment: Comment) {
    const liked = !comment.likedByMe;
    this.patchComment(comment.id, (c) => ({ ...c, likedByMe: liked, likesCount: Math.max(0, c.likesCount + (liked ? 1 : -1)) }));
    (liked ? this.api.likeComment(comment.id) : this.api.unlikeComment(comment.id)).subscribe({
      next: (r) => this.patchComment(comment.id, (c) => ({ ...c, likedByMe: r.liked, likesCount: r.likesCount })),
      error: (e) => {
        this.patchComment(comment.id, () => comment);
        this.ui.toast(errorMessage(e), 'error');
      },
    });
  }

  /** Actualiza un comentario esté donde esté (lista principal o algún hilo). */
  private patchComment(id: string, fn: (c: Comment) => Comment) {
    this.comments.update((list) => list.map((c) => (c.id === id ? fn(c) : c)));
    this.replies.update((map) => {
      const next: Record<string, Comment[]> = {};
      for (const [root, list] of Object.entries(map)) next[root] = list.map((c) => (c.id === id ? fn(c) : c));
      return next;
    });
  }

  // ---------- reportes ----------

  protected reportPost() {
    this.reports.open({ type: 'post', targetId: this.state().id, preview: this.state().title });
  }

  protected reportComment(comment: Comment) {
    const preview = comment.content.length > 60 ? comment.content.slice(0, 59) + '…' : comment.content;
    this.reports.open({ type: 'comment', targetId: comment.id, preview });
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
