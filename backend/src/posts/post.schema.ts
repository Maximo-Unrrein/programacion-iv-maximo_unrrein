import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { jsonOptions } from '../common/json';
import { SoftDeletable } from '../common/soft-delete';
import { User } from '../users/user.schema';

export type PostDocument = HydratedDocument<Post>;

@Schema(jsonOptions)
export class Post extends SoftDeletable {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true, index: true })
  author: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  title: string;

  /** Mensaje de la publicación. */
  @Prop({ trim: true, maxlength: 500, default: '' })
  content: string;

  /** Imágenes adjuntas (colección `media`), en orden del carrusel. Hasta MAX_POST_IMAGES. */
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Media' }], default: [] })
  images: Types.ObjectId[];

  /** Primera imagen (portada). Se mantiene por compatibilidad con publicaciones de una sola imagen. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Media' })
  image?: Types.ObjectId;

  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  @Prop({ default: 0, min: 0 })
  likesCount: number;

  @Prop({ default: 0, min: 0 })
  commentsCount: number;

  /** Veces que se guardó (para ordenar por guardados). */
  @Prop({ default: 0, min: 0 })
  savesCount: number;

  /** Veces que se compartió (para ordenar por compartidos). */
  @Prop({ default: 0, min: 0 })
  sharesCount: number;

  createdAt?: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ createdAt: -1 });

/** Máximo de imágenes por publicación. */
export const MAX_POST_IMAGES = 4;
