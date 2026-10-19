import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SendMessageDto {
  @MaxLength(1000, { message: 'El mensaje admite hasta 1000 caracteres' })
  @IsString({ message: 'Escribí un mensaje' })
  content: string;
}

export class ThreadQueryDto {
  /** Trae los mensajes anteriores a esta fecha (para "cargar anteriores"). */
  @IsOptional()
  @IsISO8601()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
