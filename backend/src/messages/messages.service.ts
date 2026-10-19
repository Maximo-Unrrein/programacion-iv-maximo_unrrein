import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ACTIVE } from '../common/soft-delete';
import { mediaUrl } from '../common/uploads';
import { AUTHOR_FIELDS, authorView } from '../common/views';
import { Post } from '../posts/post.schema';
import { User } from '../users/user.schema';
import { Message } from './message.schema';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
  ) {}

  /** Conversaciones del usuario: una por persona, con el último mensaje y cuántos no leyó (las más recientes primero). */
  async conversations(userId: string) {
    const me = new Types.ObjectId(userId);
    const rows = await this.messages.aggregate<{ _id: Types.ObjectId; last: any; unread: number }>([
      { $match: { $or: [{ from: me }, { to: me }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$from', me] }, '$to', '$from'] },
          last: { $first: '$$ROOT' },
          unread: { $sum: { $cond: [{ $and: [{ $eq: ['$to', me] }, { $not: ['$readAt'] }] }, 1, 0] } },
        },
      },
      { $sort: { 'last.createdAt': -1 } },
      { $limit: 50 },
    ]);
    const people = await this.users.find({ _id: { $in: rows.map((r) => r._id) } }, AUTHOR_FIELDS).lean();
    const byId = new Map(people.map((u) => [String(u._id), u]));
    return rows
      .filter((r) => byId.has(String(r._id)))
      .map((r) => ({
        user: authorView(byId.get(String(r._id))),
        unread: r.unread,
        last: {
          content: r.last.content,
          fromMe: String(r.last.from) === userId,
          createdAt: r.last.createdAt,
          hasPost: !!r.last.post,
        },
      }));
  }

  /** Mensajes con otra persona, los más nuevos primero (paginado hacia atrás con `before`). Marca como leídos los recibidos. */
  async thread(userId: string, username: string, before?: string, limit = 30) {
    const other = await this.findUser(username);
    const filter: Record<string, unknown> = {
      $or: [
        { from: userId, to: other._id },
        { from: other._id, to: userId },
      ],
    };
    if (before) filter.createdAt = { $lt: new Date(before) };
    const rows = await this.messages.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
    await this.messages.updateMany({ from: other._id, to: userId, readAt: null }, { $set: { readAt: new Date() } });
    return {
      user: authorView(other),
      items: await this.views(rows, userId),
      hasMore: rows.length === limit,
    };
  }

  /** Envía un mensaje de texto a `username`. */
  async send(fromId: string, username: string, content: string) {
    const text = content.trim();
    if (!text) throw new BadRequestException('Escribí un mensaje');
    const other = await this.findUser(username);
    if (String(other._id) === fromId) throw new BadRequestException('No podés enviarte mensajes a vos mismo');
    const message = await this.messages.create({ from: fromId, to: other._id, content: text });
    const [view] = await this.views([message.toObject()], fromId);
    return view;
  }

  /** Al compartir una publicación, el envío también queda como mensaje en la conversación. */
  async sharePost(fromId: string, toId: string, postId: string) {
    await this.messages.create({ from: fromId, to: toId, post: postId });
  }

  /** Cantidad de mensajes sin leer (para el indicador de la navegación). */
  async unread(userId: string) {
    return { count: await this.messages.countDocuments({ to: userId, readAt: null }) };
  }

  private async findUser(username: string) {
    const user = await this.users.findOne({ username, active: true }, AUTHOR_FIELDS).lean();
    if (!user) throw new NotFoundException('No encontramos a ese usuario');
    return user;
  }

  /** Arma la vista de los mensajes, con un resumen de la publicación adjunta (si sigue disponible). */
  private async views(rows: any[], userId: string) {
    const postIds = rows.filter((m) => m.post).map((m) => m.post);
    const posts = postIds.length
      ? await this.posts.find({ _id: { $in: postIds }, ...ACTIVE }, { title: 1, image: 1, images: 1, author: 1 }).populate('author', AUTHOR_FIELDS).lean()
      : [];
    const byId = new Map(posts.map((p: any) => [String(p._id), p]));
    return rows.map((m) => {
      const post: any = m.post ? byId.get(String(m.post)) : null;
      return {
        id: String(m._id),
        fromMe: String(m.from) === userId,
        content: m.content ?? '',
        createdAt: m.createdAt,
        readAt: m.readAt ?? null,
        post: post
          ? { id: String(post._id), title: post.title, imageUrl: mediaUrl(post.images?.[0] ?? post.image), author: authorView(post.author) }
          : null,
        /** Tenía una publicación que después se dio de baja. */
        postUnavailable: !!m.post && !post,
      };
    });
  }
}
