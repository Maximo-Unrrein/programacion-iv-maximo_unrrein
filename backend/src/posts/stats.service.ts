import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LoginEvent, ProfileVisit } from '../activity/activity.schemas';
import { ACTIVE } from '../common/soft-delete';
import { User } from '../users/user.schema';
import { Comment } from './comment.schema';
import { Like } from './like.schema';
import { Post } from './post.schema';
import { StatsQueryDto } from './stats.dto';

/** Zona horaria con la que se agrupan los días de los gráficos. */
const TZ = 'America/Argentina/Buenos_Aires';
const TZ_OFFSET = '-03:00';
const DAY = 24 * 3600_000;

interface Range {
  from: Date;
  to: Date;
  /** Fechas AAAA-MM-DD del período (para completar días sin datos). */
  days: string[];
}

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(Like.name) private readonly likes: Model<Like>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(LoginEvent.name) private readonly logins: Model<LoginEvent>,
    @InjectModel(ProfileVisit.name) private readonly visits: Model<ProfileVisit>,
  ) {}

  /** Totales generales para las tarjetas del dashboard. */
  async summary() {
    const [users, admins, inactive, posts, comments, likes] = await Promise.all([
      this.users.countDocuments(),
      this.users.countDocuments({ role: 'admin' }),
      this.users.countDocuments({ active: false }),
      this.posts.countDocuments(ACTIVE),
      this.comments.countDocuments(ACTIVE),
      this.likes.countDocuments(),
    ]);
    return { users, admins, inactive, posts, comments, likes };
  }

  /** Cantidad de publicaciones realizadas por cada usuario en el período. */
  async postsByUser(q: StatsQueryDto) {
    const { from, to } = this.range(q);
    const rows = await this.posts.aggregate<{ username: string; displayName: string; count: number }>([
      { $match: { ...ACTIVE, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$author', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, username: '$user.username', displayName: '$user.displayName', count: 1 } },
      { $sort: { count: -1, username: 1 } },
    ]);
    return { ...this.period(q), items: rows };
  }

  /** Cantidad de comentarios realizados por día en el período. */
  async commentsByDay(q: StatsQueryDto) {
    return this.perDay(this.comments, { ...ACTIVE }, q);
  }

  /** Cantidad de comentarios recibidos por cada publicación en el período (las 10 con más). */
  async commentsByPost(q: StatsQueryDto) {
    const { from, to } = this.range(q);
    const rows = await this.comments.aggregate<{ postId: Types.ObjectId; title: string; author: string; count: number }>([
      { $match: { ...ACTIVE, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
      { $lookup: { from: 'posts', localField: '_id', foreignField: '_id', as: 'post' } },
      { $unwind: '$post' },
      { $match: { 'post.deleted': { $ne: true } } },
      { $lookup: { from: 'users', localField: 'post.author', foreignField: '_id', as: 'author' } },
      { $unwind: '$author' },
      { $project: { _id: 0, postId: '$_id', title: '$post.title', author: '$author.username', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    return { ...this.period(q), items: rows.map((r) => ({ ...r, postId: String(r.postId) })) };
  }

  /** Cantidad de me gusta otorgados por día en el período. */
  async likesByDay(q: StatsQueryDto) {
    return this.perDay(this.likes, {}, q);
  }

  /** Cantidad de ingresos (logins) de cada usuario en el período. */
  async loginsByUser(q: StatsQueryDto) {
    return this.countByUser(this.logins, '$user', q);
  }

  /** Cantidad de visitas que recibió el perfil de cada usuario (de otros usuarios) en el período. */
  async visitsByProfile(q: StatsQueryDto) {
    return this.countByUser(this.visits, '$profile', q);
  }

  // ---------- helpers ----------

  /** Agrupa eventos por usuario (campo `field`) dentro del período. */
  private async countByUser(model: Model<any>, field: string, q: StatsQueryDto) {
    const { from, to } = this.range(q);
    const rows = await model.aggregate<{ username: string; displayName: string; count: number }>([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: field, count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, username: '$user.username', displayName: '$user.displayName', count: 1 } },
      { $sort: { count: -1, username: 1 } },
    ]);
    return { ...this.period(q), total: rows.reduce((n, r) => n + r.count, 0), items: rows };
  }

  /** Cuenta documentos por día (según `createdAt`) y completa con 0 los días sin actividad. */
  private async perDay(model: Model<any>, match: Record<string, unknown>, q: StatsQueryDto) {
    const { from, to, days } = this.range(q);
    const rows = await model.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, count: { $sum: 1 } } },
    ]);
    const byDay = new Map(rows.map((r) => [r._id, r.count]));
    const items = days.map((date) => ({ date, count: byDay.get(date) ?? 0 }));
    return { ...this.period(q), total: items.reduce((n, d) => n + d.count, 0), items };
  }

  private period(q: StatsQueryDto) {
    const { days } = this.range(q);
    return { from: days[0], to: days[days.length - 1] };
  }

  /** Período pedido (por defecto, los últimos 30 días), en días completos de Argentina. */
  private range(q: StatsQueryDto): Range {
    const today = new Date(Date.now() + (-3 * 3600_000)).toISOString().slice(0, 10);
    const toDay = q.to ?? today;
    const fromDay = q.from ?? new Date(new Date(`${toDay}T12:00:00Z`).getTime() - 29 * DAY).toISOString().slice(0, 10);
    const from = new Date(`${fromDay}T00:00:00${TZ_OFFSET}`);
    const to = new Date(`${toDay}T23:59:59.999${TZ_OFFSET}`);
    if (from > to) throw new BadRequestException('La fecha "desde" debe ser anterior a "hasta"');
    const count = Math.round((to.getTime() - from.getTime()) / DAY);
    if (count > 366) throw new BadRequestException('El período puede ser de hasta un año');
    const days = Array.from({ length: count }, (_, i) =>
      new Date(new Date(`${fromDay}T12:00:00Z`).getTime() + i * DAY).toISOString().slice(0, 10),
    );
    return { from, to, days };
  }
}
