import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import type { RegisterDto } from '../auth/auth.dto';
import { mediaUrl } from '../common/uploads';
import { MediaService } from '../media/media.service';
import { fullName, Role, User, UserDocument } from './user.schema';

export type NewUser = Pick<User, 'firstName' | 'lastName' | 'email' | 'username' | 'passwordHash'> &
  Partial<Pick<User, 'role' | 'bio' | 'birthDate'>>;

export type ProfileChanges = Partial<Pick<User, 'firstName' | 'lastName' | 'bio' | 'birthDate'>> & {
  /** `null` quita la foto de perfil. */
  avatar?: Types.ObjectId | null;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly media: MediaService,
  ) {}

  /**
   * Crea una cuenta validando duplicados y contraseñas. La usan el registro (perfil "usuario")
   * y el alta desde el panel de administración (perfil elegido).
   */
  async createAccount(dto: RegisterDto, avatar?: Express.Multer.File, role: Role = 'user'): Promise<UserDocument> {
    if (dto.password !== dto.passwordConfirm) throw new BadRequestException('Las contraseñas no coinciden');
    const taken = await this.taken(dto.email, dto.username);
    if (taken === 'email') throw new ConflictException('Ese correo ya está registrado');
    if (taken === 'username') throw new ConflictException('Ese nombre de usuario ya está en uso');

    const user = await this.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email,
      username: dto.username,
      birthDate: new Date(`${dto.birthDate}T00:00:00Z`),
      bio: dto.bio?.trim() || undefined,
      role,
      // La contraseña se guarda encriptada (hash bcrypt)
      passwordHash: await bcrypt.hash(dto.password, 10),
    });
    if (!avatar) return user;
    const avatarId = await this.media.save(avatar, user.id as string);
    return (await this.updateProfile(user.id as string, { avatar: avatarId }))!;
  }

  findById(id: string) {
    return this.users.findById(id).exec();
  }

  findByUsername(username: string) {
    return this.users.findOne({ username }).exec();
  }

  /** Busca por correo (si tiene "@") o por nombre de usuario, incluyendo el hash de la contraseña. */
  findByIdentifierWithPassword(identifier: string) {
    const value = identifier.trim();
    const filter = value.includes('@') ? { email: value.toLowerCase() } : { username: value };
    return this.users.findOne(filter).select('+passwordHash').exec();
  }

  /** Usuarios activos (sin el que busca) cuyo usuario o nombre contiene el texto. Máximo 8. */
  async search(q: string, excludeId: string) {
    // Se escapan los caracteres especiales para usar el texto dentro de una expresión regular
    const text = q.trim().slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text ? { $or: [{ username: new RegExp(text, 'i') }, { displayName: new RegExp(text, 'i') }] } : {};
    const users = await this.users
      .find({ active: true, _id: { $ne: excludeId }, ...match })
      .sort({ username: 1 })
      .limit(8)
      .exec();
    return users.map((u) => ({
      id: u.id as string,
      username: u.username,
      displayName: u.displayName || u.username,
      avatarUrl: mediaUrl(u.avatar),
    }));
  }

  findAll() {
    return this.users.find().sort({ createdAt: -1 }).exec();
  }

  count(filter: Partial<Pick<User, 'role' | 'active'>> = {}) {
    return this.users.countDocuments(filter).exec();
  }

  /** Indica qué dato ya está en uso, para devolver un mensaje preciso. */
  async taken(email: string, username: string): Promise<'email' | 'username' | null> {
    if (await this.users.exists({ email: email.toLowerCase() })) return 'email';
    if (await this.users.exists({ username })) return 'username';
    return null;
  }

  create(data: NewUser): Promise<UserDocument> {
    return this.users.create({ ...data, displayName: fullName(data.firstName, data.lastName) });
  }

  async updateProfile(id: string, changes: ProfileChanges) {
    const { avatar, ...rest } = changes;
    const set: Record<string, unknown> = { ...rest, ...(avatar && { avatar }) };
    if (rest.firstName !== undefined || rest.lastName !== undefined) {
      const current = await this.users.findById(id, { firstName: 1, lastName: 1 }).lean();
      set['displayName'] = fullName(rest.firstName ?? current?.firstName, rest.lastName ?? current?.lastName);
    }
    const update = avatar === null ? { $set: set, $unset: { avatar: 1 } } : { $set: set };
    return this.users.findByIdAndUpdate(id, update, { new: true, runValidators: true }).exec();
  }

  update(id: string, changes: Partial<Pick<User, 'role' | 'active'>>) {
    return this.users.findByIdAndUpdate(id, changes, { new: true, runValidators: true }).exec();
  }

  /** Todos los datos del usuario (sin la contraseña). */
  toProfile(user: UserDocument) {
    return {
      id: user.id as string,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      displayName: user.displayName || user.username,
      email: user.email,
      username: user.username,
      birthDate: user.birthDate ?? null,
      avatarUrl: mediaUrl(user.avatar),
      bio: user.bio ?? null,
      role: user.role as Role,
      active: user.active,
      createdAt: (user as unknown as { createdAt?: Date }).createdAt ?? null,
    };
  }
}
