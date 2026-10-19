import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { CommentsService } from './comments.service';
import { CommentsQueryDto, CreateCommentDto, NewCommentDto } from './posts.dto';

/** Comentarios de las publicaciones: hilos de un nivel y me gusta. */
@Controller()
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  /** Comentarios principales, más recientes primero. `offset` y `limit` para paginar ("cargar más"). */
  @Get('posts/:id/comments')
  list(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Query() query: CommentsQueryDto) {
    return this.comments.list(id, user.sub, query.offset, query.limit);
  }

  /** Guarda el comentario con su autor (del token) y la fecha. Con `parentId` es una respuesta. Responde 201. */
  @Post('posts/:id/comments')
  create(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: NewCommentDto) {
    return this.comments.create(id, user.sub, dto.content, dto.parentId);
  }

  /** Respuestas de un comentario, en orden de conversación. */
  @Get('comments/:id/replies')
  replies(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Query() query: CommentsQueryDto) {
    return this.comments.replies(id, user.sub, query.offset, query.limit);
  }

  /** Modifica el mensaje y agrega `modificado: true`. Sólo el autor. */
  @Put('comments/:id')
  update(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateCommentDto) {
    return this.comments.update(id, user, dto.content);
  }

  /** Baja lógica (con sus respuestas, si es principal). Devuelve cuántos comentarios se quitaron. */
  @Delete('comments/:id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.comments.remove(id, user);
  }

  @Post('comments/:id/like')
  @HttpCode(200)
  like(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.comments.like(id, user.sub);
  }

  @Delete('comments/:id/like')
  unlike(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.comments.unlike(id, user.sub);
  }
}
