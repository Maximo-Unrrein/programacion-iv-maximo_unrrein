import { Prop } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

/**
 * Baja lógica: el documento queda en la base marcado como eliminado y deja de aparecer en la app.
 * `$ne: true` también incluye los documentos viejos que no tienen el campo.
 */
export const ACTIVE = { deleted: { $ne: true } } as const;

/** Campos de baja lógica, para agregar a un schema con `extends SoftDeletable`. */
export abstract class SoftDeletable {
  @Prop({ default: false, index: true })
  deleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;
}

/** Update que aplica la baja lógica, registrando quién y cuándo. */
export const softDelete = (userId: string) => ({ $set: { deleted: true, deletedAt: new Date(), deletedBy: userId } });
