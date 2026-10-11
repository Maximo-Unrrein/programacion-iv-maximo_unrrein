import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { StatsQueryDto } from './stats.dto';
import { StatsService } from './stats.service';

/** Estadísticas para los gráficos del dashboard. Sólo administradores. `?from=AAAA-MM-DD&to=AAAA-MM-DD` */
@Controller('stats')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('summary')
  summary() {
    return this.stats.summary();
  }

  @Get('posts-by-user')
  postsByUser(@Query() query: StatsQueryDto) {
    return this.stats.postsByUser(query);
  }

  @Get('comments-by-day')
  commentsByDay(@Query() query: StatsQueryDto) {
    return this.stats.commentsByDay(query);
  }

  @Get('comments-by-post')
  commentsByPost(@Query() query: StatsQueryDto) {
    return this.stats.commentsByPost(query);
  }

  @Get('logins-by-user')
  loginsByUser(@Query() query: StatsQueryDto) {
    return this.stats.loginsByUser(query);
  }

  @Get('visits-by-profile')
  visitsByProfile(@Query() query: StatsQueryDto) {
    return this.stats.visitsByProfile(query);
  }

  @Get('likes-by-day')
  likesByDay(@Query() query: StatsQueryDto) {
    return this.stats.likesByDay(query);
  }
}
