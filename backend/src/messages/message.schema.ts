import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

/**
 * Mensaje directo entre dos usuarios. Puede llevar una publicación adjunta
 * (cuando alguien la comparte, el envío también aparece en la conversación).
 */
@Schema({ collection: 'messages', timestamps: { createdAt: true, updatedAt: false } })
export class Message {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  from: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  to: Types.ObjectId;

  @Prop({ trim: true, maxlength: 1000, default: '' })
  content: string;

  /** Publicación compartida en el mensaje (opcional). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Post' })
  post?: Types.ObjectId;

  /** Cuándo lo leyó el destinatario (`null` = sin leer). */
  @Prop({ type: Date, default: null })
  readAt: Date | null;

  createdAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ from: 1, to: 1, createdAt: -1 });
MessageSchema.index({ to: 1, readAt: 1 });
