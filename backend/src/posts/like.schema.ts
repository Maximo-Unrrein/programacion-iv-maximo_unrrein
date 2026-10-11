import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../users/user.schema';
import { Post } from './post.schema';

/** Un "me gusta" por usuario y post. Guarda la fecha para calcular tendencias recientes. */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Like {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Post.name, required: true })
  post: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId;

  createdAt?: Date;
}

export const LikeSchema = SchemaFactory.createForClass(Like);
LikeSchema.index({ post: 1, user: 1 }, { unique: true });
LikeSchema.index({ user: 1 });
LikeSchema.index({ createdAt: -1 });
