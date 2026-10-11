import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ActivityService } from '../activity/activity.service';
import * as bcrypt from 'bcryptjs';
import { Role, UserDocument } from '../users/user.schema';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';

/** Lo que viaja dentro del JWT: quién es el usuario y su perfil (rol). */
export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly activity: ActivityService,
  ) {}

  /** Registro público: siempre crea un usuario con perfil "usuario". */
  async register(dto: RegisterDto, avatar?: Express.Multer.File) {
    const user = await this.users.createAccount(dto, avatar);
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByIdentifierWithPassword(dto.user);
    // bcrypt.compare hashea la contraseña recibida y la compara con el hash guardado
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Usuario, correo o contraseña incorrectos');
    }
    if (!user.active) {
      throw new ForbiddenException('Tu cuenta fue deshabilitada por un administrador. No estás autorizado a ingresar.');
    }
    // Cada ingreso queda registrado para la estadística "ingresos por usuario"
    await this.activity.recordLogin(user._id);
    return this.session(user);
  }

  /** Nuevo token con la misma payload (usuario y rol) y vencimiento de 15 minutos. */
  async refresh(payload: JwtPayload) {
    const { sub, username, role } = payload;
    return { accessToken: await this.jwt.signAsync({ sub, username, role } satisfies JwtPayload) };
  }

  /** Genera el token (vence en 15 minutos) y devuelve todos los datos del usuario. */
  private async session(user: UserDocument) {
    const payload: JwtPayload = { sub: user.id as string, username: user.username, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: this.users.toProfile(user),
    };
  }
}
