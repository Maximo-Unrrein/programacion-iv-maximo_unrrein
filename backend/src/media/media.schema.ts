import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../users/user.schema';

/** Imagen guardada en MongoDB como binario (BinData). Se sirve en `/api/media/:id`. */
@Schema({ collection: 'media', timestamps: { createdAt: true, updatedAt: false } })
export class Media {
  @Prop({ type: Buffer, required: true })
  data: Buffer;

  @Prop({ required: true })
  contentType: string;

  @Prop({ required: true })
  size: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, index: true })
  owner?: Types.ObjectId;

  createdAt?: Date;
}

export const MediaSchema = SchemaFactory.createForClass(Media);
