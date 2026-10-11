import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, QueryFilter, Types } from 'mongoose';
import type { JwtPayload } from '../auth/auth.service';
import { ACTIVE, softDelete } from '../common/soft-delete';
import { mediaUrl } from '../common/uploads';
import { MediaService } from '../media/media.service';
import { AUTHOR_FIELDS, authorView, CommentView, extractTags } from '../common/views';
import { UsersService } from '../users/users.service';
import { Comment } from './comment.schema';
import { CommentsService } from './comments.service';
import { Like } from './like.schema';
import { Post } from './post.schema';
import { Save, Share } from './save-share.schemas';
import { CreatePostDto, FeedQueryDto, FeedSort } from './posts.dto';

const PREVIEW_COMMENTS = 3;

/** Orden de cada criterio del listado (desempata por fecha). */
const ORDERS: Record<FeedSort, Record<string, 1 | -1>> = {
  fecha: { createdAt: -1, _id: -1 },
  likes: { likesCount: -1, createdAt: -1, _id: -1 },
  guardados: { savesCount: -1, createdAt: -1, _id: -1 },
  compartidos: { sharesCount: -1, createdAt: -1, _id: -1 },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(Like.name) private readonly likes: Model<Like>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(Save.name) private readonly saves: Model<Save>,
    @InjectModel(Share.name) private readonly shares: Model<Share>,
    private readonly commentsService: CommentsService,
    private readonly users: UsersService,
    private readonly media: MediaService,
  ) {}

  async feed(viewerId: string, q: FeedQueryDto) {
    const filter: QueryFilter<Post> = { ...ACTIVE };
    if (q.author) {
      const author = await this.users.findByUsername(q.author);
      if (!author) throw new NotFoundException('Usuario no encontrado');
      filter.author = author._id;
    }
    if (q.tag) filter.tags = q.tag.toLowerCase();
    if (q.before) filter.createdAt = { $lt: new Date(q.before) };

    const posts = await this.posts
      .find(filter)
      .sort(ORDERS[q.sort ?? 'fecha'])
      .skip(q.offset ?? 0)
      .limit(q.limit ?? 12)
      .populate('author', AUTHOR_FIELDS)
      .lean();
    return this.views(posts, viewerId);
  }

  async findOne(id: string, viewerId: string) {
    const post = isValidObjectId(id) ? await this.posts.findOne({ _id: id, ...ACTIVE }).populate('author', AUTHOR_FIELDS).lean() : null;
    if (!post) throw new NotFoundException('Publicación no encontrada');
    const [view] = await this.views([post], viewerId);
    return view;
  }

  async create(authorId: string, dto: CreatePostDto, image?: Express.Multer.File) {
    const title = dto.title.trim();
    const content = dto.content.trim();
    if (!title || !content) throw new BadRequestException('La publicación necesita título y mensaje');
    const imageId = image ? await this.media.save(image, authorId) : undefined;
    try {
      const post = await this.posts.create({ author: authorId, title, content, image: imageId, tags: extractTags(`${title} ${content}`) });
      return await this.findOne(post.id as string, authorId);
    } catch (e) {
      await this.media.remove(imageId);
      throw e;
    }
  }

  /**
   * Baja lógica de una publicación (autor o admin): deja de estar disponible junto con sus comentarios.
   * Los datos quedan en la base (imagen y me gusta incluidos).
   */
  async remove(id: string, user: JwtPayload) {
    const post = isValidObjectId(id) ? await this.posts.findOne({ _id: id, ...ACTIVE }).lean() : null;
    if (!post) throw new NotFoundException('Publicación no encontrada');
    if (String(post.author) !== user.sub && user.role !== 'admin') {
      throw new ForbiddenException('Sólo podés borrar tus publicaciones');
    }
    await Promise.all([
      this.posts.updateOne({ _id: id }, softDelete(user.sub)),
      this.comments.updateMany({ post: id, ...ACTIVE }, softDelete(user.sub)),
    ]);
  }

  async like(id: string, userId: string) {
    await this.ensurePost(id);
    try {
      await this.likes.create({ post: id, user: userId });
      await this.posts.updateOne({ _id: id }, { $inc: { likesCount: 1 } });
    } catch (e: any) {
      if (e?.code !== 11000) throw e; // ya le había dado me gusta
    }
    return this.likeState(id, true);
  }

  async unlike(id: string, userId: string) {
    await this.ensurePost(id);
    const removed = await this.likes.findOneAndDelete({ post: id, user: userId });
    if (removed) await this.posts.updateOne({ _id: id, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } });
    return this.likeState(id, false);
  }

  // ---------- guardados ----------

  /** Guarda la publicación en los guardados del usuario (una sola vez). */
  async save(id: string, userId: string) {
    await this.ensurePost(id);
    try {
      await this.saves.create({ post: id, user: userId });
      await this.posts.updateOne({ _id: id }, { $inc: { savesCount: 1 } });
    } catch (e: any) {
      if (e?.code !== 11000) throw e; // ya estaba guardada
    }
    return this.saveState(id, true);
  }

  /** Quita la publicación de los guardados del usuario. */
  async unsave(id: string, userId: string) {
    await this.ensurePost(id);
    const removed = await this.saves.findOneAndDelete({ post: id, user: userId });
    if (removed) await this.posts.updateOne({ _id: id, savesCount: { $gt: 0 } }, { $inc: { savesCount: -1 } });
    return this.saveState(id, false);
  }

  /** Publicaciones guardadas por el usuario, las últimas guardadas primero. */
  async saved(userId: string, offset = 0, limit = 12) {
    const rows = await this.saves.find({ user: userId }).sort({ createdAt: -1 }).lean();
    const posts = await this.posts
      .find({ _id: { $in: rows.map((r) => r.post) }, ...ACTIVE })
      .populate('author', AUTHOR_FIELDS)
      .lean();
    const byId = new Map(posts.map((p) => [String(p._id), p]));
    const ordered = rows.map((r) => byId.get(String(r.post))).filter(Boolean);
    return this.views(ordered.slice(offset, offset + limit), userId);
  }

  // ---------- compartidos ----------

  /** Registra que `fromId` le comparte la publicación a `toId`. Repetirlo sólo actualiza la fecha. */
  async share(id: string, fromId: string, toId: string) {
    await this.ensurePost(id);
    if (toId === fromId) throw new BadRequestException('No podés compartirte una publicación a vos mismo');
    const target = await this.users.findById(toId);
    if (!target || !target.active) throw new NotFoundException('No encontramos a ese usuario');
    const result = await this.shares.updateOne(
      { post: id, from: fromId, to: toId },
      { $set: { post: id, from: fromId, to: toId } },
      { upsert: true, timestamps: true },
    );
    if (result.upsertedCount) await this.posts.updateOne({ _id: id }, { $inc: { sharesCount: 1 } });
    const post = await this.posts.findById(id, { sharesCount: 1 }).lean();
    return { sharedWith: target.username, sharesCount: post?.sharesCount ?? 0, alreadyShared: !result.upsertedCount };
  }

  /** Publicaciones que le compartieron al usuario, con quién se las compartió (las más recientes primero). */
  async sharedWith(userId: string, offset = 0, limit = 12) {
    const rows = await this.shares
      .find({ to: userId })
      .sort({ updatedAt: -1 })
      .populate('from', AUTHOR_FIELDS)
      .lean();
    const posts = await this.posts
      .find({ _id: { $in: rows.map((r) => r.post) }, ...ACTIVE })
      .populate('author', AUTHOR_FIELDS)
      .lean();
    const byId = new Map(posts.map((p) => [String(p._id), p]));
    const items = rows.filter((r) => byId.has(String(r.post))).slice(offset, offset + limit);
    const views = await this.views(
      items.map((r) => byId.get(String(r.post))),
      userId,
    );
    return items.map((r, i) => ({ id: String(r._id), sharedBy: authorView(r.from), sharedAt: r.updatedAt, post: views[i] }));
  }

  count() {
    return this.posts.countDocuments(ACTIVE).exec();
  }

  /** Cantidad de posts y me gusta recibidos por un autor. */
  async statsFor(authorId: Types.ObjectId) {
    const [row] = await this.posts.aggregate<{ posts: number; likes: number }>([
      { $match: { author: authorId, ...ACTIVE } },
      { $group: { _id: null, posts: { $sum: 1 }, likes: { $sum: '$likesCount' } } },
    ]);
    return { posts: row?.posts ?? 0, likes: row?.likes ?? 0 };
  }

  /** Arma la vista pública de varios posts (lean + autor populado) para un usuario. */
  async views(posts: any[], viewerId: string) {
    const ids = posts.map((p) => p._id as Types.ObjectId);
    const [liked, saved, previews] = await Promise.all([
      this.likes.find({ user: viewerId, post: { $in: ids } }, { post: 1 }).lean(),
      this.saves.find({ user: viewerId, post: { $in: ids } }, { post: 1 }).lean(),
      this.commentsService.previews(ids, PREVIEW_COMMENTS),
    ]);
    const likedIds = new Set(liked.map((l) => String(l.post)));
    const savedIds = new Set(saved.map((s) => String(s.post)));
    return posts.map((p) =>
      this.view(p, likedIds.has(String(p._id)), savedIds.has(String(p._id)), previews.get(String(p._id)) ?? []),
    );
  }

  private view(p: any, likedByMe: boolean, savedByMe: boolean, comments: CommentView[]) {
    return {
      id: String(p._id),
      title: p.title ?? '',
      content: p.content ?? '',
      imageUrl: mediaUrl(p.image),
      tags: p.tags ?? [],
      likesCount: p.likesCount ?? 0,
      commentsCount: p.commentsCount ?? 0,
      savesCount: p.savesCount ?? 0,
      sharesCount: p.sharesCount ?? 0,
      createdAt: p.createdAt,
      author: authorView(p.author),
      likedByMe,
      savedByMe,
      comments,
    };
  }

  private async saveState(id: string, saved: boolean) {
    const post = await this.posts.findById(id, { savesCount: 1 }).lean();
    return { saved, savesCount: post?.savesCount ?? 0 };
  }

  private async likeState(id: string, liked: boolean) {
    const post = await this.posts.findById(id, { likesCount: 1 }).lean();
    return { liked, likesCount: post?.likesCount ?? 0 };
  }

  private async ensurePost(id: string) {
    if (!isValidObjectId(id) || !(await this.posts.exists({ _id: id, ...ACTIVE }))) {
      throw new NotFoundException('Publicación no encontrada');
    }
  }
}
