import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

/** Comentarios que llegan en la primera carga (y en cada "cargar más"). */
export const COMMENTS_PAGE = 5;
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { JwtPayload } from '../auth/auth.service';
import { ACTIVE, softDelete } from '../common/soft-delete';
import { AUTHOR_FIELDS, commentView, CommentView } from '../common/views';
import { Comment } from './comment.schema';
import { Post } from './post.schema';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
  ) {}

  /** Comentarios de una publicación, los más recientes primero, paginados con offset/limit. */
  async list(postId: string, offset = 0, limit = COMMENTS_PAGE) {
    await this.ensurePost(postId);
    const filter = { post: postId, ...ACTIVE };
    const [rows, total] = await Promise.all([
      this.comments.find(filter).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit).populate('author', AUTHOR_FIELDS).lean(),
      this.comments.countDocuments(filter),
    ]);
    return { items: rows.map(commentView), total, offset, limit, hasMore: offset + rows.length < total };
  }

  async create(postId: string, authorId: string, content: string) {
    await this.ensurePost(postId);
    const comment = await this.comments.create({ post: postId, author: authorId, content: content.trim() });
    await this.posts.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } });
    const full = await this.comments.findById(comment._id).populate('author', AUTHOR_FIELDS).lean();
    return commentView(full);
  }

  /** Edita el mensaje: sólo el autor del comentario. Queda marcado como `modificado`. */
  async update(id: string, user: JwtPayload, content: string) {
    const comment = isValidObjectId(id) ? await this.comments.findOne({ _id: id, ...ACTIVE }).lean() : null;
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    await this.ensurePost(String(comment.post));
    if (String(comment.author) !== user.sub) throw new ForbiddenException('Sólo podés editar tus comentarios');
    await this.comments.updateOne({ _id: id }, { $set: { content: content.trim(), modificado: true, modifiedAt: new Date() } });
    const full = await this.comments.findById(id).populate('author', AUTHOR_FIELDS).lean();
    return commentView(full);
  }

  /** Baja lógica. Puede hacerla el autor del comentario, el autor del post o un admin. */
  async remove(id: string, user: JwtPayload) {
    const comment = isValidObjectId(id) ? await this.comments.findOne({ _id: id, ...ACTIVE }).lean() : null;
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    const post = await this.posts.findById(comment.post, { author: 1 }).lean();
    const allowed =
      user.role === 'admin' || String(comment.author) === user.sub || String(post?.author) === user.sub;
    if (!allowed) throw new ForbiddenException('No podés borrar este comentario');
    await this.comments.updateOne({ _id: id }, softDelete(user.sub));
    await this.posts.updateOne({ _id: comment.post, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } });
  }

  /** Últimos `n` comentarios de cada post (los más recientes primero), en una sola consulta. */
  async previews(postIds: Types.ObjectId[], n: number): Promise<Map<string, CommentView[]>> {
    if (!postIds.length) return new Map();
    const rows: { _id: Types.ObjectId; items: unknown[] }[] = await this.comments.aggregate([
      { $match: { post: { $in: postIds }, ...ACTIVE } },
      { $group: { _id: '$post', items: { $topN: { n, sortBy: { createdAt: -1 }, output: '$$ROOT' } } } },
    ]);
    await this.comments.populate(
      rows.flatMap((r) => r.items),
      { path: 'author', select: AUTHOR_FIELDS },
    );
    return new Map(rows.map((r) => [String(r._id), r.items.map(commentView)]));
  }

  private async ensurePost(postId: string) {
    if (!isValidObjectId(postId) || !(await this.posts.exists({ _id: postId, ...ACTIVE }))) {
      throw new NotFoundException('Publicación no encontrada');
    }
  }
}
