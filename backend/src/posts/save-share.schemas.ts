import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

/** Una publicación guardada por un usuario (una sola vez por usuario y publicación). */
@Schema({ collection: 'saves', timestamps: { createdAt: true, updatedAt: false } })
export class Save {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Post', required: true })
  post: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  createdAt?: Date;
}
export const SaveSchema = SchemaFactory.createForClass(Save);
SaveSchema.index({ post: 1, user: 1 }, { unique: true });
SaveSchema.index({ user: 1, createdAt: -1 });

/** Una publicación que `from` le compartió a `to`. Compartir de nuevo lo mismo sólo actualiza la fecha. */
@Schema({ collection: 'shares', timestamps: true })
export class Share {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Post', required: true })
  post: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  from: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  to: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}
export const ShareSchema = SchemaFactory.createForClass(Share);
ShareSchema.index({ post: 1, from: 1, to: 1 }, { unique: true });
ShareSchema.index({ to: 1, updatedAt: -1 });
