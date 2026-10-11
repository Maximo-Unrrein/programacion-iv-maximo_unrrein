import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { jsonOptions } from '../common/json';

export type UserDocument = HydratedDocument<User>;

export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];

@Schema(jsonOptions)
export class User {
  @Prop({ trim: true, maxlength: 40 })
  firstName: string;

  @Prop({ trim: true, maxlength: 40 })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true, minlength: 3, maxlength: 30 })
  username: string;

  /** Nombre visible ("Nombre Apellido"); se recalcula al cambiar nombre o apellido. */
  @Prop({ trim: true, maxlength: 81 })
  displayName?: string;

  @Prop()
  birthDate?: Date;

  /** Foto de perfil (colección `media`). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Media' })
  avatar?: Types.ObjectId;

  /** Descripción breve. */
  @Prop({ maxlength: 280 })
  bio?: string;

  /** Perfil del usuario: "usuario" por defecto, puede ser "administrador". */
  @Prop({ type: String, enum: ROLES, default: 'user' })
  role: Role;

  /** Baja lógica: un usuario deshabilitado por un admin no puede ingresar. */
  @Prop({ default: true })
  active: boolean;

  /** Hash bcrypt. Nunca se devuelve por defecto en las consultas. */
  @Prop({ required: true, select: false })
  passwordHash: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

/** Campos públicos de un usuario (sin email ni hash). */
export const PUBLIC_USER_FIELDS = 'username displayName avatar bio';

export const fullName = (firstName?: string, lastName?: string) => [firstName, lastName].filter(Boolean).join(' ');
