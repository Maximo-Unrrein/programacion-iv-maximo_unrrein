import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsBirthDate, NAME_PATTERN } from '../common/validators';

// class-validator evalúa los decoradores de abajo hacia arriba y, con `stopAtFirstError`,
// devuelve sólo el primer error de cada campo: el chequeo más básico va más cerca de la propiedad.

export class LoginDto {
  /** Correo o nombre de usuario (ambos son únicos). */
  @IsNotEmpty({ message: 'Ingresá tu correo o nombre de usuario' })
  @IsString({ message: 'Ingresá tu correo o nombre de usuario' })
  user: string;

  /** En el login sólo se exige que venga: la política se valida al registrarse. */
  @IsNotEmpty({ message: 'Ingresá tu contraseña' })
  @IsString({ message: 'Ingresá tu contraseña' })
  password: string;
}

/** Datos de una cuenta nueva (registro y alta desde el panel de administración). Llega como multipart. */
export class RegisterDto {
  @Matches(NAME_PATTERN, { message: 'El nombre sólo puede tener letras' })
  @MaxLength(40, { message: 'El nombre puede tener hasta 40 caracteres' })
  @IsNotEmpty({ message: 'Ingresá tu nombre' })
  @IsString({ message: 'Ingresá tu nombre' })
  firstName: string;

  @Matches(NAME_PATTERN, { message: 'El apellido sólo puede tener letras' })
  @MaxLength(40, { message: 'El apellido puede tener hasta 40 caracteres' })
  @IsNotEmpty({ message: 'Ingresá tu apellido' })
  @IsString({ message: 'Ingresá tu apellido' })
  lastName: string;

  @IsEmail({}, { message: 'Correo inválido' })
  email: string;

  @Matches(/^[a-zA-Z0-9_.]+$/, { message: 'El usuario sólo puede tener letras, números, "_" y "."' })
  @MaxLength(30, { message: 'El usuario puede tener hasta 30 caracteres' })
  @MinLength(3, { message: 'El usuario debe tener al menos 3 caracteres' })
  @IsString({ message: 'Ingresá un nombre de usuario' })
  username: string;

  /** Al menos 8 caracteres, una mayúscula y un número. */
  @Matches(/\d/, { message: 'La contraseña debe tener al menos un número' })
  @Matches(/[A-Z]/, { message: 'La contraseña debe tener al menos una mayúscula' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @IsString({ message: 'Ingresá una contraseña' })
  password: string;

  /** Se compara con `password` en el servicio. */
  @IsNotEmpty({ message: 'Repetí la contraseña' })
  @IsString({ message: 'Repetí la contraseña' })
  passwordConfirm: string;

  /** AAAA-MM-DD */
  @IsBirthDate()
  birthDate: string;

  @IsOptional()
  @MaxLength(280, { message: 'La descripción puede tener hasta 280 caracteres' })
  @IsString()
  bio?: string;
}
