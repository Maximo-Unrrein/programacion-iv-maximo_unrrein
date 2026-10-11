import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { MediaModule } from '../media/media.module';
import { PostsModule } from '../posts/posts.module';
import { ProfilesController } from './profiles.controller';

@Module({
  imports: [PostsModule, MediaModule, ActivityModule],
  controllers: [ProfilesController],
})
export class ProfilesModule {}
