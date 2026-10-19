import { IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { REPORT_REASONS, REPORT_STATUSES, REPORT_TYPES } from './report.schema';
import type { ReportReason, ReportStatus, ReportType } from './report.schema';

export class CreateReportDto {
  @IsIn(REPORT_TYPES, { message: 'Sólo se pueden reportar publicaciones o comentarios' })
  type: ReportType;

  @IsMongoId({ message: 'El contenido a reportar no es válido' })
  targetId: string;

  @IsIn(REPORT_REASONS, { message: `Elegí un motivo: ${REPORT_REASONS.join(', ')}` })
  reason: ReportReason;

  @IsOptional()
  @MaxLength(300, { message: 'El detalle admite hasta 300 caracteres' })
  @IsString()
  detail?: string;
}

export class ReportsQueryDto {
  @IsOptional()
  @IsIn(REPORT_STATUSES, { message: `El estado debe ser uno de: ${REPORT_STATUSES.join(', ')}` })
  status?: ReportStatus;
}

export const REPORT_ACTIONS = ['eliminar', 'descartar'] as const;

export class ResolveReportDto {
  @IsIn(REPORT_ACTIONS, { message: 'La acción debe ser "eliminar" o "descartar"' })
  action: (typeof REPORT_ACTIONS)[number];
}
