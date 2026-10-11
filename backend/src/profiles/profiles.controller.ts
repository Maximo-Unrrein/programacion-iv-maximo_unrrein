import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ActivityService } from '../activity/activity.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { imageUploadOptions } from '../common/uploads';
import { MediaService } from '../media/media.service';
import { PostsService } from '../posts/posts.service';
import { UserDocument } from '../users/user.schema';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from './update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(
    private readonly users: UsersService,
    private readonly posts: PostsService,
    private readonly media: MediaService,
    private readonly activity: ActivityService,
  ) {}

  /** Busca usuarios activos por nombre o usuario (para elegir a quién compartir). Va antes de `:username`. */
  @Get('search')
  search(@Query('q') q: string | undefined, @CurrentUser() me: JwtPayload) {
    return this.users.search(q ?? '', me.sub);
  }

  @Get(':username')
  async findOne(@Param('username') username: string, @CurrentUser() me: JwtPayload) {
    const user = await this.users.findByUsername(username);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    // Se cuenta como visita sólo si lo mira otro usuario
    await this.activity.recordVisit(user._id, me.sub);
    return this.profile(user, me);
  }

  @Patch('me')
  async update(@CurrentUser() me: JwtPayload, @Body() dto: UpdateProfileDto) {
    const user = await this.users.updateProfile(me.sub, {
      ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
      ...(dto.birthDate !== undefined && { birthDate: new Date(`${dto.birthDate}T00:00:00Z`) }),
      ...(dto.bio !== undefined && { bio: dto.bio.trim() }),
    });
    return this.profile(user!, me);
  }

  /** multipart/form-data con el campo `avatar` (máx. 3 MB). */
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', imageUploadOptions(3)))
  async uploadAvatar(@CurrentUser() me: JwtPayload, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Elegí una imagen');
    const previous = (await this.users.findById(me.sub))?.avatar;
    const avatar = await this.media.save(file, me.sub);
    const user = await this.users.updateProfile(me.sub, { avatar });
    await this.media.remove(previous);
    return this.profile(user!, me);
  }

  @Delete('me/avatar')
  async removeAvatar(@CurrentUser() me: JwtPayload) {
    const previous = (await this.users.findById(me.sub))?.avatar;
    const user = await this.users.updateProfile(me.sub, { avatar: null });
    await this.media.remove(previous);
    return this.profile(user!, me);
  }

  /** Todos los datos del usuario; el correo sólo se muestra en el propio perfil. */
  private async profile(user: UserDocument, me: JwtPayload) {
    const { email, active, ...data } = this.users.toProfile(user);
    const isMe = data.id === me.sub;
    return {
      ...data,
      email: isMe ? email : null,
      ...(me.role === 'admin' && { active }),
      stats: {
        ...(await this.posts.statsFor(user._id)),
        // "Visitas a mi perfil": las ve el dueño del perfil (y los administradores)
        visits: isMe || me.role === 'admin' ? await this.activity.visitsTo(user._id) : null,
      },
    };
  }
}
