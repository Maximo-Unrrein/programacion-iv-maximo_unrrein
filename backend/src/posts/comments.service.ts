import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { JwtPayload } from '../auth/auth.service';
import { ACTIVE, softDelete } from '../common/soft-delete';
import { AUTHOR_FIELDS, commentView, CommentView } from '../common/views';
import { Comment, CommentLike } from './comment.schema';
import { Post } from './post.schema';

/** Comentarios que llegan en la primera carga (y en cada "cargar más"). */
export const COMMENTS_PAGE = 5;

/** Comentarios principales de cada post: los primeros `n` y cuántos hay en total. */
export interface CommentPreview {
  items: CommentView[];
  total: number;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(CommentLike.name) private readonly likes: Model<CommentLike>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
  ) {}

  /** Comentarios principales de una publicación, los más recientes primero, paginados con offset/limit. */
  async list(postId: string, viewerId: string, offset = 0, limit = COMMENTS_PAGE) {
    await this.ensurePost(postId);
    const filter = { post: postId, parent: null, ...ACTIVE };
    const [rows, total] = await Promise.all([
      this.comments.find(filter).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit).populate('author', AUTHOR_FIELDS).lean(),
      this.comments.countDocuments(filter),
    ]);
    const items = await this.withLikes(rows, viewerId);
    return { items, total, offset, limit, hasMore: offset + rows.length < total };
  }

  /** Respuestas de un comentario principal, en orden de conversación (las más antiguas primero). */
  async replies(commentId: string, viewerId: string, offset = 0, limit = 20) {
    const parent = await this.findActive(commentId);
    await this.ensurePost(String(parent.post));
    const filter = { parent: parent._id, ...ACTIVE };
    const [rows, total] = await Promise.all([
      this.comments.find(filter).sort({ createdAt: 1, _id: 1 }).skip(offset).limit(limit).populate('author', AUTHOR_FIELDS).lean(),
      this.comments.countDocuments(filter),
    ]);
    const items = await this.withLikes(rows, viewerId);
    return { items, total, offset, limit, hasMore: offset + rows.length < total };
  }

  /** Comentario nuevo. Con `parentId` es una respuesta: siempre cuelga del comentario principal (un solo nivel). */
  async create(postId: string, authorId: string, content: string, parentId?: string) {
    await this.ensurePost(postId);
    let parent: Types.ObjectId | null = null;
    if (parentId) {
      const target = isValidObjectId(parentId) ? await this.comments.findOne({ _id: parentId, post: postId, ...ACTIVE }).lean() : null;
      if (!target) throw new NotFoundException('El comentario al que respondés ya no está disponible');
      parent = target.parent ?? target._id;
    }
    const comment = await this.comments.create({ post: postId, author: authorId, parent, content: content.trim() });
    await Promise.all([
      this.posts.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } }),
      parent ? this.comments.updateOne({ _id: parent }, { $inc: { repliesCount: 1 } }) : null,
    ]);
    const full = await this.comments.findById(comment._id).populate('author', AUTHOR_FIELDS).lean();
    return commentView(full);
  }

  /** Edita el mensaje: sólo el autor del comentario. Queda marcado como `modificado`. */
  async update(id: string, user: JwtPayload, content: string) {
    const comment = await this.findActive(id);
    await this.ensurePost(String(comment.post));
    if (String(comment.author) !== user.sub) throw new ForbiddenException('Sólo podés editar tus comentarios');
    await this.comments.updateOne({ _id: id }, { $set: { content: content.trim(), modificado: true, modifiedAt: new Date() } });
    const full = await this.comments.findById(id).populate('author', AUTHOR_FIELDS).lean();
    const [view] = await this.withLikes([full], user.sub);
    return view;
  }

  /**
   * Baja lógica. Puede hacerla el autor del comentario, el autor del post o un admin.
   * Si es un comentario principal, sus respuestas también se dan de baja. Devuelve cuántos se quitaron.
   */
  async remove(id: string, user: JwtPayload) {
    const comment = await this.findActive(id);
    const post = await this.posts.findById(comment.post, { author: 1 }).lean();
    const allowed =
      user.role === 'admin' || String(comment.author) === user.sub || String(post?.author) === user.sub;
    if (!allowed) throw new ForbiddenException('No podés borrar este comentario');

    await this.comments.updateOne({ _id: id }, softDelete(user.sub));
    let removed = 1;
    if (comment.parent) {
      await this.comments.updateOne({ _id: comment.parent, repliesCount: { $gt: 0 } }, { $inc: { repliesCount: -1 } });
    } else {
      const replies = await this.comments.updateMany({ parent: comment._id, ...ACTIVE }, softDelete(user.sub));
      removed += replies.modifiedCount;
    }
    await this.posts.updateOne({ _id: comment.post }, { $inc: { commentsCount: -removed } });
    await this.posts.updateOne({ _id: comment.post, commentsCount: { $lt: 0 } }, { $set: { commentsCount: 0 } });
    return { removed };
  }

  // ---------- me gusta en comentarios ----------

  async like(id: string, userId: string) {
    const comment = await this.findActive(id);
    await this.ensurePost(String(comment.post));
    try {
      await this.likes.create({ comment: id, user: userId });
      await this.comments.updateOne({ _id: id }, { $inc: { likesCount: 1 } });
    } catch (e: any) {
      if (e?.code !== 11000) throw e; // ya le había dado me gusta
    }
    return this.likeState(id, true);
  }

  async unlike(id: string, userId: string) {
    const comment = await this.findActive(id);
    await this.ensurePost(String(comment.post));
    const removed = await this.likes.findOneAndDelete({ comment: id, user: userId });
    if (removed) await this.comments.updateOne({ _id: id, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } });
    return this.likeState(id, false);
  }

  /** Primeros `n` comentarios principales de cada post (los más recientes) y el total, en una sola consulta. */
  async previews(postIds: Types.ObjectId[], n: number, viewerId: string): Promise<Map<string, CommentPreview>> {
    if (!postIds.length) return new Map();
    const rows: { _id: Types.ObjectId; total: number; items: unknown[] }[] = await this.comments.aggregate([
      { $match: { post: { $in: postIds }, parent: null, ...ACTIVE } },
      { $group: { _id: '$post', total: { $sum: 1 }, items: { $topN: { n, sortBy: { createdAt: -1 }, output: '$$ROOT' } } } },
    ]);
    const all = rows.flatMap((r) => r.items);
    await this.comments.populate(all, { path: 'author', select: AUTHOR_FIELDS });
    const liked = await this.likedIds(all as { _id: Types.ObjectId }[], viewerId);
    return new Map(
      rows.map((r) => [
        String(r._id),
        { total: r.total, items: r.items.map((c: any) => commentView(c, liked.has(String(c._id)))) },
      ]),
    );
  }

  /** Comentario activo por id (para moderación y validaciones). */
  async findActive(id: string) {
    const comment = isValidObjectId(id) ? await this.comments.findOne({ _id: id, ...ACTIVE }).lean() : null;
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    return comment;
  }

  private async withLikes(rows: any[], viewerId: string) {
    const liked = await this.likedIds(rows, viewerId);
    return rows.map((c) => commentView(c, liked.has(String(c._id))));
  }

  private async likedIds(rows: { _id: Types.ObjectId }[], viewerId: string) {
    if (!rows.length) return new Set<string>();
    const likes = await this.likes.find({ user: viewerId, comment: { $in: rows.map((c) => c._id) } }, { comment: 1 }).lean();
    return new Set(likes.map((l) => String(l.comment)));
  }

  private async likeState(id: string, liked: boolean) {
    const comment = await this.comments.findById(id, { likesCount: 1 }).lean();
    return { liked, likesCount: comment?.likesCount ?? 0 };
  }

  private async ensurePost(postId: string) {
    if (!isValidObjectId(postId) || !(await this.posts.exists({ _id: postId, ...ACTIVE }))) {
      throw new NotFoundException('Publicación no encontrada');
    }
  }
}
