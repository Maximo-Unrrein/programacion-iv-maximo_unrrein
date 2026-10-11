import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { ACTIVE } from '../common/soft-delete';
import { AUTHOR_FIELDS } from '../common/views';
import { Like } from './like.schema';
import { Post } from './post.schema';
import { TrendsQueryDto, TrendWindow } from './posts.dto';
import { PostsService } from './posts.service';

const WINDOW_MS: Record<TrendWindow, number> = {
  '24h': 24 * 3600_000,
  '7d': 7 * 24 * 3600_000,
  '30d': 30 * 24 * 3600_000,
};
const LIMIT = 20;

/* eslint-disable @typescript-eslint/no-explicit-any */
@Injectable()
export class TrendsService {
  constructor(
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(Like.name) private readonly likes: Model<Like>,
    private readonly postsService: PostsService,
  ) {}

  /** Ranking de posts. Cada ítem trae `metric`: puntaje (popular) o me gusta en el período (recent). */
  async posts$(viewerId: string, q: TrendsQueryDto) {
    const since = new Date(Date.now() - WINDOW_MS[q.window]);
    const ranked = q.sort === 'recent' ? await this.byRecentLikes(since, q.tag) : await this.byPopularity(since, q.tag);
    const views = await this.postsService.views(
      ranked.map((r) => r.post),
      viewerId,
    );
    return views.map((post, i) => ({ post, metric: ranked[i].metric }));
  }

  /** Hashtags más usados en el período. */
  async tags(window: TrendWindow) {
    const since = new Date(Date.now() - WINDOW_MS[window]);
    const rows = await this.posts.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since }, ...ACTIVE } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ]);
    return rows.map((r) => ({ tag: r._id, count: r.count }));
  }

  /** Posts del período ordenados por me gusta + 2 × comentarios. */
  private async byPopularity(since: Date, tag?: string) {
    const match: Record<string, unknown> = { createdAt: { $gte: since }, ...ACTIVE };
    if (tag) match['tags'] = tag.toLowerCase();
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $addFields: {
          score: { $add: [{ $ifNull: ['$likesCount', 0] }, { $multiply: [{ $ifNull: ['$commentsCount', 0] }, 2] }] },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: LIMIT },
    ];
    const rows = await this.posts.aggregate(pipeline);
    await this.posts.populate(rows, { path: 'author', select: AUTHOR_FIELDS });
    return rows.map((post: any) => ({ post, metric: post.score as number }));
  }

  /** Posts que más me gusta recibieron dentro del período (sin importar cuándo se publicaron). */
  private async byRecentLikes(since: Date, tag?: string) {
    const counts = await this.likes.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: LIMIT * 3 },
    ]);
    const filter: Record<string, unknown> = { _id: { $in: counts.map((c) => c._id) }, ...ACTIVE };
    if (tag) filter['tags'] = tag.toLowerCase();
    const posts = await this.posts.find(filter).populate('author', AUTHOR_FIELDS).lean();
    const byId = new Map(posts.map((p) => [String(p._id), p]));
    return counts
      .map((c) => ({ post: byId.get(String(c._id)), metric: c.count }))
      .filter((r) => r.post)
      .slice(0, LIMIT);
  }
}
