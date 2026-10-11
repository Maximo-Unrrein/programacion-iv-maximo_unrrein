import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { MediaModule } from '../media/media.module';
import { User, UserSchema } from '../users/user.schema';
import { Comment, CommentSchema } from './comment.schema';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Like, LikeSchema } from './like.schema';
import { Post, PostSchema } from './post.schema';
import { Save, SaveSchema, Share, ShareSchema } from './save-share.schemas';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { TrendsService } from './trends.service';

@Module({
  imports: [
    MediaModule,
    ActivityModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Like.name, schema: LikeSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: User.name, schema: UserSchema },
      { name: Save.name, schema: SaveSchema },
      { name: Share.name, schema: ShareSchema },
    ]),
  ],
  controllers: [PostsController, CommentsController, StatsController],
  providers: [PostsService, CommentsService, TrendsService, StatsService],
  exports: [PostsService],
})
export class PostsModule {}
