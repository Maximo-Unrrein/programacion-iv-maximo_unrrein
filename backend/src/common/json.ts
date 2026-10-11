import type { SchemaOptions } from 'mongoose';

/** Serializa los documentos con `id` en lugar de `_id` y sin `__v`. */
export const jsonOptions: SchemaOptions = {
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  },
};
