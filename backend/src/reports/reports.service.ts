import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { JwtPayload } from '../auth/auth.service';
import { ACTIVE } from '../common/soft-delete';
import { mediaUrl } from '../common/uploads';
import { AUTHOR_FIELDS, authorView } from '../common/views';
import { Comment } from '../posts/comment.schema';
import { CommentsService } from '../posts/comments.service';
import { Post } from '../posts/post.schema';
import { PostsService } from '../posts/posts.service';
import { User } from '../users/user.schema';
import { Report, ReportStatus } from './report.schema';
import { CreateReportDto } from './reports.dto';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private readonly reports: Model<Report>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
  ) {}

  /** Registra la denuncia. Si el usuario ya tenía una pendiente sobre lo mismo, la actualiza (no se duplica). */
  async create(reporterId: string, dto: CreateReportDto) {
    let postId: Types.ObjectId;
    let authorId: Types.ObjectId;
    if (dto.type === 'post') {
      const post = await this.posts.findOne({ _id: dto.targetId, ...ACTIVE }, { author: 1 }).lean();
      if (!post) throw new NotFoundException('Publicación no encontrada');
      postId = post._id;
      authorId = post.author;
    } else {
      const comment = await this.commentsService.findActive(dto.targetId);
      postId = comment.post;
      authorId = comment.author;
    }
    if (String(authorId) === reporterId) throw new BadRequestException('No podés reportar tu propio contenido');

    await this.reports.updateOne(
      { target: dto.targetId, reporter: reporterId, status: 'pendiente' },
      { $set: { type: dto.type, post: postId, reason: dto.reason, detail: dto.detail?.trim() ?? '' } },
      { upsert: true },
    );
    return { reported: true };
  }

  /** Cantidad de contenidos con denuncias pendientes (indicador del panel). */
  async pendingCount() {
    const targets = await this.reports.distinct('target', { status: 'pendiente' });
    return { count: targets.length };
  }

  /**
   * Cola de moderación: las denuncias agrupadas por contenido (el más denunciado y reciente primero),
   * con el contenido, su autor y quiénes lo reportaron.
   */
  async queue(status: ReportStatus = 'pendiente') {
    const groups = await this.reports.aggregate<any>([
      { $match: { status } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$target',
          type: { $first: '$type' },
          post: { $first: '$post' },
          count: { $sum: 1 },
          lastAt: { $max: '$createdAt' },
          resolvedAt: { $max: '$resolvedAt' },
          reports: { $push: { reporter: '$reporter', reason: '$reason', detail: '$detail', createdAt: '$createdAt' } },
        },
      },
      { $sort: status === 'pendiente' ? { count: -1, lastAt: -1 } : { resolvedAt: -1 } },
      { $limit: 100 },
    ]);

    const postIds = groups.filter((g) => g.type === 'post').map((g) => g._id);
    const commentIds = groups.filter((g) => g.type === 'comment').map((g) => g._id);
    const reporterIds = groups.flatMap((g) => g.reports.map((r: any) => r.reporter));
    // Se buscan también los dados de baja: la cola muestra qué se eliminó
    const [posts, comments, reporters] = await Promise.all([
      this.posts.find({ _id: { $in: postIds } }).populate('author', AUTHOR_FIELDS).lean(),
      this.comments.find({ _id: { $in: commentIds } }).populate('author', AUTHOR_FIELDS).lean(),
      this.users.find({ _id: { $in: reporterIds } }, AUTHOR_FIELDS).lean(),
    ]);
    const postsById = new Map(posts.map((p: any) => [String(p._id), p]));
    const commentsById = new Map(comments.map((c: any) => [String(c._id), c]));
    const reportersById = new Map(reporters.map((u) => [String(u._id), u]));

    return groups.map((g) => {
      const doc: any = g.type === 'post' ? postsById.get(String(g._id)) : commentsById.get(String(g._id));
      const reasons: Record<string, number> = {};
      for (const r of g.reports) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
      return {
        targetId: String(g._id),
        type: g.type,
        postId: String(g.post),
        count: g.count,
        reasons,
        lastAt: g.lastAt,
        resolvedAt: g.resolvedAt ?? null,
        target: doc
          ? {
              title: doc.title ?? null,
              content: doc.content ?? '',
              imageUrl: g.type === 'post' ? mediaUrl(doc.images?.[0] ?? doc.image) : null,
              author: authorView(doc.author),
              deleted: !!doc.deleted,
              createdAt: doc.createdAt,
            }
          : null,
        reports: g.reports.map((r: any) => ({
          reporter: authorView(reportersById.get(String(r.reporter))),
          reason: r.reason,
          detail: r.detail,
          createdAt: r.createdAt,
        })),
      };
    });
  }

  /**
   * Resuelve todas las denuncias pendientes de un contenido:
   * - `eliminar`: baja lógica del contenido (y de sus comentarios o respuestas) → quedan "resueltas".
   * - `descartar`: el contenido sigue publicado → quedan "descartadas".
   */
  async resolve(targetId: string, action: 'eliminar' | 'descartar', admin: JwtPayload) {
    const pending = isValidObjectId(targetId) ? await this.reports.findOne({ target: targetId, status: 'pendiente' }).lean() : null;
    if (!pending) throw new NotFoundException('No hay denuncias pendientes para ese contenido');

    if (action === 'eliminar') {
      try {
        if (pending.type === 'post') await this.postsService.remove(targetId, admin);
        else await this.commentsService.remove(targetId, admin);
      } catch (e) {
        // Si ya lo había borrado su autor, igual se cierran las denuncias
        if (!(e instanceof NotFoundException)) throw e;
      }
    }
    const result = await this.reports.updateMany(
      { target: targetId, status: 'pendiente' },
      { $set: { status: action === 'eliminar' ? 'resuelto' : 'descartado', resolvedBy: admin.sub, resolvedAt: new Date() } },
    );
    return { resolved: result.modifiedCount, action };
  }
}
