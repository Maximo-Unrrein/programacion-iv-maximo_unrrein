import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './auth.service';
import { ROLES_KEY } from './roles.decorator';
import type { Role } from '../users/user.schema';

/**
 * Valida `Authorization: Bearer <token>`, comprueba que el usuario siga activo y deja
 * `{ sub, username, role }` en `request.user`. Si la ruta tiene `@Roles(...)`, exige ese rol.
 * El rol se lee de la base en cada request, así un cambio de rol o un bloqueo aplica al instante.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Falta el token de acceso');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (!user.active) throw new UnauthorizedException('Tu cuenta fue desactivada');

    const current: JwtPayload = { sub: user.id as string, username: user.username, role: user.role };
    request.user = current;

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && !required.includes(current.role)) {
      throw new ForbiddenException('No tenés permisos para esta acción');
    }
    return true;
  }
}
