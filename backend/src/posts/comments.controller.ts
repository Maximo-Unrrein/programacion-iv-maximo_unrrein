import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { CommentsService } from './comments.service';
import { CommentsQueryDto, CreateCommentDto } from './posts.dto';

/** Comentarios de las publicaciones. */
@Controller()
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  /** Más recientes primero. `offset` y `limit` para paginar ("cargar más"). */
  @Get('posts/:id/comments')
  list(@Param('id') id: string, @Query() query: CommentsQueryDto) {
    return this.comments.list(id, query.offset, query.limit);
  }

  /** Guarda el comentario con su autor (del token) y la fecha. Responde 201. */
  @Post('posts/:id/comments')
  create(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateCommentDto) {
    return this.comments.create(id, user.sub, dto.content);
  }

  /** Modifica el mensaje y agrega `modificado: true`. Sólo el autor. */
  @Put('comments/:id')
  update(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateCommentDto) {
    return this.comments.update(id, user, dto.content);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.comments.remove(id, user);
  }
}
