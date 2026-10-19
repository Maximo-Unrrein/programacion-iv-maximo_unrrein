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

  /**
   * Comentario al que responde. Los hilos tienen un solo nivel: responder a una respuesta
   * la cuelga del mismo comentario principal. `null` = comentario principal.
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Comment', default: null })
  parent: Types.ObjectId | null;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 300 })
  content: string;

  /** `true` si el autor editó el mensaje después de publicarlo. */
  @Prop({ default: false })
  modificado: boolean;

  @Prop()
  modifiedAt?: Date;

  @Prop({ default: 0, min: 0 })
  likesCount: number;

  /** Respuestas activas (sólo en comentarios principales). */
  @Prop({ default: 0, min: 0 })
  repliesCount: number;

  createdAt?: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ post: 1, parent: 1, createdAt: -1 });
CommentSchema.index({ parent: 1, createdAt: 1 });

/** Un "me gusta" por usuario y comentario. */
@Schema({ collection: 'comment_likes', timestamps: { createdAt: true, updatedAt: false } })
export class CommentLike {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Comment', required: true })
  comment: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId;

  createdAt?: Date;
}

export const CommentLikeSchema = SchemaFactory.createForClass(CommentLike);
CommentLikeSchema.index({ comment: 1, user: 1 }, { unique: true });
