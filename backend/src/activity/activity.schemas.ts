import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

/** Un ingreso (login exitoso) de un usuario. */
@Schema({ collection: 'logins', timestamps: { createdAt: true, updatedAt: false } })
export class LoginEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  createdAt?: Date;
}
export const LoginEventSchema = SchemaFactory.createForClass(LoginEvent);
LoginEventSchema.index({ createdAt: -1 });

/** Una visita al perfil de `profile` hecha por otro usuario (`visitor`). Las visitas a uno mismo no se guardan. */
@Schema({ collection: 'profile_visits', timestamps: { createdAt: true, updatedAt: false } })
export class ProfileVisit {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  profile: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  visitor: Types.ObjectId;

  createdAt?: Date;
}
export const ProfileVisitSchema = SchemaFactory.createForClass(ProfileVisit);
ProfileVisitSchema.index({ createdAt: -1 });
