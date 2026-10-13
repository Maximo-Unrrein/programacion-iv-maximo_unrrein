import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

// class-validator evalúa los decoradores de abajo hacia arriba: el más cercano a la propiedad va primero
export class CreatePostDto {
  @MaxLength(100, { message: 'El título puede tener hasta 100 caracteres' })
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @IsString({ message: 'El título es obligatorio' })
  title: string;

  @MaxLength(500, { message: 'El mensaje puede tener hasta 500 caracteres' })
  @IsNotEmpty({ message: 'El mensaje es obligatorio' })
  @IsString({ message: 'El mensaje es obligatorio' })
  content: string;
}

export const FEED_SORTS = ['fecha', 'likes', 'guardados', 'compartidos'] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export class FeedQueryDto {
  @IsOptional()
  @IsString()
  author?: string;

  /** Texto a buscar en el título o el mensaje (búsqueda). */
  @IsOptional()
  @MaxLength(60, { message: 'La búsqueda admite hasta 60 caracteres' })
  @IsString()
  q?: string;

  @IsOptional()
  @Matches(/^[\p{L}\p{N}_]{2,30}$/u)
  tag?: string;

  /** Orden del listado: por fecha (por defecto), me gusta, guardados o compartidos. */
  @IsOptional()
  @IsIn(FEED_SORTS, { message: `El orden debe ser uno de: ${FEED_SORTS.join(', ')}` })
  sort?: FeedSort;

  /** Cantidad de publicaciones a saltear (paginación). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  /** Cursor alternativo: devuelve posts anteriores a esta fecha. */
  @IsOptional()
  @IsISO8601()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/** Destinatario al compartir una publicación. */
export class ShareDto {
  @IsMongoId({ message: 'Elegí un usuario válido para compartir' })
  to: string;
}

export class CommentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  content: string;
}

export const TREND_WINDOWS = ['24h', '7d', '30d'] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number];

export class TrendsQueryDto {
  /** popular: me gusta + comentarios de posts del período · recent: me gusta recibidos en el período */
  @IsOptional()
  @IsIn(['popular', 'recent'])
  sort: 'popular' | 'recent' = 'popular';

  @IsOptional()
  @IsIn(TREND_WINDOWS)
  window: TrendWindow = '7d';

  @IsOptional()
  @Matches(/^[\p{L}\p{N}_]{2,30}$/u)
  tag?: string;
}
