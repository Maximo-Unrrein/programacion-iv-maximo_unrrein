import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export const REPORT_TYPES = ['post', 'comment'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_REASONS = ['spam', 'ofensivo', 'inapropiado', 'falso', 'otro'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['pendiente', 'resuelto', 'descartado'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/**
 * Denuncia de un usuario sobre una publicación o un comentario.
 * Un administrador la resuelve dando de baja el contenido o la descarta.
 */
@Schema({ collection: 'reports', timestamps: true })
export class Report {
  @Prop({ type: String, enum: REPORT_TYPES, required: true })
  type: ReportType;

  /** Publicación o comentario denunciado. */
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  target: Types.ObjectId;

  /** Publicación a la que pertenece el contenido (la misma si `type` es post). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Post', required: true })
  post: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reporter: Types.ObjectId;

  @Prop({ type: String, enum: REPORT_REASONS, required: true })
  reason: ReportReason;

  @Prop({ trim: true, maxlength: 300, default: '' })
  detail: string;

  @Prop({ type: String, enum: REPORT_STATUSES, default: 'pendiente', index: true })
  status: ReportStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;

  @Prop()
  resolvedAt?: Date;

  createdAt?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ target: 1, reporter: 1, status: 1 });
