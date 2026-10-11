import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { isValidObjectId } from 'mongoose';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { imageUploadOptions } from '../common/uploads';
import { User } from './user.schema';
import { ChangeRoleDto, CreateUserDto } from './users.dto';
import { UsersService } from './users.service';

/** Gestión de usuarios: sólo administradores (el guard valida el rol del token contra la base). */
@Controller('users')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Listado de usuarios con todos sus datos. */
  @Get()
  async findAll() {
    const users = await this.users.findAll();
    return users.map((u) => this.users.toProfile(u));
  }

  /** Alta de un usuario nuevo (multipart: datos del registro + `role` + `avatar` opcional). Responde 201. */
  @Post()
  @UseInterceptors(FileInterceptor('avatar', imageUploadOptions(3)))
  async create(@Body() dto: CreateUserDto, @UploadedFile() avatar?: Express.Multer.File) {
    const user = await this.users.createAccount(dto, avatar, dto.role);
    return this.users.toProfile(user);
  }

  /** Baja lógica: deshabilita al usuario. Al intentar ingresar se le avisa que no está autorizado. */
  @Delete(':id')
  disable(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    if (id === me.sub) throw new BadRequestException('No podés deshabilitar tu propia cuenta');
    return this.change(id, { active: false });
  }

  /** Alta lógica: rehabilita a un usuario deshabilitado. */
  @Post(':id/enable')
  @HttpCode(200)
  enable(@Param('id') id: string) {
    return this.change(id, { active: true });
  }

  /** Cambia el perfil (usuario / administrador). */
  @Patch(':id/role')
  changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto, @CurrentUser() me: JwtPayload) {
    if (id === me.sub && dto.role !== 'admin') throw new BadRequestException('No podés quitarte el perfil de administrador');
    return this.change(id, { role: dto.role });
  }

  private async change(id: string, changes: Partial<Pick<User, 'role' | 'active'>>) {
    const user = isValidObjectId(id) ? await this.users.update(id, changes) : null;
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.users.toProfile(user);
  }
}
