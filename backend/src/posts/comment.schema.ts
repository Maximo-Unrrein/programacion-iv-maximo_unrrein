import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { SoftDeletable } from '../common/soft-delete';
import { User } from '../users/user.schema';
import { Post } from './post.schema';

@Schema({ timestamps: true })
export class Comment extends SoftDeletable {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Post.name, required: true })
  post: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  author: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 300 })
  content: string;

  /** `true` si el autor editó el mensaje después de publicarlo. */
  @Prop({ default: false })
  modificado: boolean;

  @Prop()
  modifiedAt?: Date;

  createdAt?: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ post: 1, createdAt: -1 });
