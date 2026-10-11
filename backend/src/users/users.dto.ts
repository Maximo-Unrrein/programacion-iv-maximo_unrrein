import { IsIn } from 'class-validator';
import { RegisterDto } from '../auth/auth.dto';
import { ROLES, type Role } from './user.schema';

/** Alta desde el panel de administración: mismos datos que el registro + el perfil elegido. */
export class CreateUserDto extends RegisterDto {
  @IsIn(ROLES, { message: 'El perfil debe ser "usuario" o "administrador"' })
  role: Role;
}

export class ChangeRoleDto {
  @IsIn(ROLES, { message: 'El perfil debe ser "usuario" o "administrador"' })
  role: Role;
}
