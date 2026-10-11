import { Body, Controller, HttpCode, NotFoundException, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { imageUploadOptions } from '../common/uploads';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService, type JwtPayload } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  /** multipart/form-data: datos del usuario + `avatar` (imagen de perfil opcional, máx. 3 MB). Responde 201. */
  @Post('register')
  @UseInterceptors(FileInterceptor('avatar', imageUploadOptions(3)))
  register(@Body() dto: RegisterDto, @UploadedFile() avatar?: Express.Multer.File) {
    return this.auth.register(dto, avatar);
  }

  /** `{ user, password }` (user = correo o nombre de usuario). No crea nada: responde 200. */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /**
   * Valida el token (`Authorization: Bearer …`): si es válido y no venció devuelve los datos del usuario;
   * si no, el guard responde 401.
   */
  @Post('autorizar')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async authorize(@CurrentUser() payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.users.toProfile(user);
  }

  /** Con un token válido y no vencido, devuelve uno nuevo con la misma payload y otros 15 minutos. */
  @Post('refrescar')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  refresh(@CurrentUser() payload: JwtPayload) {
    return this.auth.refresh(payload);
  }
}
