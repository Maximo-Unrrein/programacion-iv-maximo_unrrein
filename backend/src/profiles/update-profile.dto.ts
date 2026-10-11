import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsBirthDate, NAME_PATTERN } from '../common/validators';

export class UpdateProfileDto {
  @IsOptional()
  @Matches(NAME_PATTERN, { message: 'El nombre sólo puede tener letras' })
  @MaxLength(40, { message: 'El nombre puede tener hasta 40 caracteres' })
  @IsString()
  firstName?: string;

  @IsOptional()
  @Matches(NAME_PATTERN, { message: 'El apellido sólo puede tener letras' })
  @MaxLength(40, { message: 'El apellido puede tener hasta 40 caracteres' })
  @IsString()
  lastName?: string;

  /** AAAA-MM-DD */
  @IsOptional()
  @IsBirthDate()
  birthDate?: string;

  @IsOptional()
  @MaxLength(280, { message: 'La descripción puede tener hasta 280 caracteres' })
  @IsString()
  bio?: string;
}
