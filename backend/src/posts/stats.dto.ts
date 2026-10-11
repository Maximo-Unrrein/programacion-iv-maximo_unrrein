import { IsOptional, Matches } from 'class-validator';

/** Período de los gráficos. Fechas AAAA-MM-DD; si faltan, se usan los últimos 30 días. */
export class StatsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha "desde" debe tener formato AAAA-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha "hasta" debe tener formato AAAA-MM-DD' })
  to?: string;
}
