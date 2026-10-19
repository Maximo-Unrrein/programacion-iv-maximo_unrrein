import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { SendMessageDto, ThreadQueryDto } from './messages.dto';
import { MessagesService } from './messages.service';

/** Mensajes directos entre usuarios. */
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  /** Conversaciones del usuario del token. */
  @Get()
  conversations(@CurrentUser() user: JwtPayload) {
    return this.messages.conversations(user.sub);
  }

  /** Cantidad de mensajes sin leer (antes de `:username` para que no se tome como usuario). */
  @Get('unread')
  unread(@CurrentUser() user: JwtPayload) {
    return this.messages.unread(user.sub);
  }

  /** Conversación con `username` (marca como leídos los recibidos). */
  @Get(':username')
  thread(@Param('username') username: string, @CurrentUser() user: JwtPayload, @Query() query: ThreadQueryDto) {
    return this.messages.thread(user.sub, username, query.before, query.limit);
  }

  /** Envía un mensaje a `username`. Responde 201. */
  @Post(':username')
  send(@Param('username') username: string, @CurrentUser() user: JwtPayload, @Body() dto: SendMessageDto) {
    return this.messages.send(user.sub, username, dto.content);
  }
}
