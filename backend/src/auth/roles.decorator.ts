import { SetMetadata } from '@nestjs/common';
import type { Role } from '../users/user.schema';

export const ROLES_KEY = 'roles';

/** Restringe una ruta (protegida con JwtAuthGuard) a los roles indicados. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
