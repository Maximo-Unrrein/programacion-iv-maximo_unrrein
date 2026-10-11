/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Carga datos de prueba: un admin, un usuario demo, autores de ejemplo y contenido de demostración
 * (publicaciones con imagen, me gusta y comentarios repartidos en el tiempo para que haya tendencias).
 * Es idempotente: se puede correr varias veces sin duplicar nada.
 *
 *   npm run seed
 *
 * Las credenciales del admin y del usuario demo se leen de backend/.env (SEED_*).
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { extname, resolve, sep } from 'path';
import { Model, Types } from 'mongoose';
import { AppModule } from './app.module';
import { MediaService } from './media/media.service';
import { extractTags } from './common/views';
import { Comment } from './posts/comment.schema';
import { Like } from './posts/like.schema';
import { Post } from './posts/post.schema';
import { Save, Share } from './posts/save-share.schemas';
import { LoginEvent, ProfileVisit } from './activity/activity.schemas';
import { ARTWORKS } from './seed-art';
import { Role, User } from './users/user.schema';

interface SeedUser {
  firstName: string;
  lastName: string;
  birthDate: Date;
  email: string;
  username: string;
  password: string;
  role: Role;
  bio?: string;
}

const HOUR = 3600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

/** Publicaciones de demostración: autor, texto, imagen opcional y hace cuántas horas se publicó. */
const DEMO_POSTS: { author: string; title: string; content: string; art?: keyof typeof ARTWORKS; hoursAgo: number }[] = [
  { author: 'admin', title: 'Bienvenidos', content: '¡Bienvenidos a MaxSend! Usen #maxsend para que los encontremos 💙', hoursAgo: 150 },
  { author: 'luna', title: 'Atardecer orbital', content: 'Atardecer en la órbita baja 🌅 #espacio #fotografia', art: 'horizon', hoursAgo: 52 },
  { author: 'tomasv', title: 'Geometría', content: 'Geometría pura. #diseño #arte', art: 'grid', hoursAgo: 26 },
  { author: 'demo', title: 'Mi primer envío', content: 'Mi primer envío con imagen 🚀 #maxsend', art: 'orbit', hoursAgo: 75 },
  { author: 'nadia', title: 'Fondo nuevo', content: 'Nuevo fondo para el celu, ¿les gusta? #diseño #minimalismo', art: 'nebula', hoursAgo: 5 },
  { author: 'luna', title: 'Menos ruido', content: 'Menos ruido, más señal. #minimalismo', hoursAgo: 10 },
];

const DEMO_COMMENTS = [
  'Increíble 😍',
  'Lo quiero de fondo de pantalla',
  'Esos colores 🔥',
  '¿Con qué lo hiciste?',
  'Tremendo, me encanta',
  'Muy MaxSend esto 💙',
  'Guardado ✨',
];

/** Título de respaldo para publicaciones creadas antes de que el título fuera obligatorio. */
function titleFrom(content?: string) {
  const words = (content ?? '').replace(/#[\p{L}\p{N}_]+/gu, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Publicación';
  const title = words.slice(0, 5).join(' ');
  return title.length > 60 ? title.slice(0, 57) + '…' : title;
}

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  const config = app.get(ConfigService);
  const users = app.get<Model<User>>(getModelToken(User.name));
  const posts = app.get<Model<Post>>(getModelToken(Post.name));
  const likes = app.get<Model<Like>>(getModelToken(Like.name));
  const comments = app.get<Model<Comment>>(getModelToken(Comment.name));
  const saves = app.get<Model<Save>>(getModelToken(Save.name));
  const shares = app.get<Model<Share>>(getModelToken(Share.name));
  const logins = app.get<Model<LoginEvent>>(getModelToken(LoginEvent.name));
  const visits = app.get<Model<ProfileVisit>>(getModelToken(ProfileVisit.name));
  const media = app.get(MediaService);

  // ---------- usuarios ----------
  const accounts: SeedUser[] = [
    {
      email: config.getOrThrow('SEED_ADMIN_EMAIL'),
      password: config.getOrThrow('SEED_ADMIN_PASSWORD'),
      username: 'admin',
      firstName: 'Admin',
      lastName: 'MaxSend',
      birthDate: new Date('1990-05-14'),
      role: 'admin',
      bio: 'Cuenta de administración',
    },
    {
      email: config.getOrThrow('SEED_USER_EMAIL'),
      password: config.getOrThrow('SEED_USER_PASSWORD'),
      username: 'demo',
      firstName: 'Usuario',
      lastName: 'Demo',
      birthDate: new Date('2000-09-21'),
      role: 'user',
      bio: 'Cuenta de pruebas',
    },
    // Autores de ejemplo para poblar el feed (no hace falta ingresar con ellos)
    ...[
      ['luna', 'Luna', 'Ríos', '1998-02-03', 'Fotografía y cielos nocturnos 🌙'],
      ['tomasv', 'Tomás', 'Vega', '1995-11-30', 'Diseño, código y café'],
      ['nadia', 'Nadia', 'Paz', '2001-07-12', 'Dev frontend · minimalista'],
    ].map(([username, firstName, lastName, birthDate, bio]) => ({
      email: `${username}@maxsend.test`,
      password: randomBytes(16).toString('hex'),
      username,
      firstName,
      lastName,
      birthDate: new Date(birthDate),
      bio,
      role: 'user' as Role,
    })),
  ];

  const ids = new Map<string, Types.ObjectId>();
  for (const account of accounts) {
    const { password, ...data } = account;
    let user = await users.findOne({ email: data.email.toLowerCase() });
    if (user) {
      // Mantiene el rol y la contraseña sincronizados con .env para las cuentas de prueba
      if (data.role === 'admin' || data.username === 'demo') {
        user.set({ role: data.role, active: true, passwordHash: await bcrypt.hash(password, 10) });
      }
      if (!user.bio && data.bio) user.set({ bio: data.bio });
      // Completa nombre, apellido y nacimiento en usuarios creados antes de que existieran esos campos
      if (!user.firstName) user.set({ firstName: data.firstName, lastName: data.lastName, displayName: `${data.firstName} ${data.lastName}` });
      if (!user.birthDate) user.set({ birthDate: data.birthDate });
      await user.save();
      logger.log(`= ${data.username} ya existía`);
    } else {
      user = await users.create({ ...data, displayName: `${data.firstName} ${data.lastName}`, passwordHash: await bcrypt.hash(password, 10) });
      logger.log(`+ ${data.username} (${data.role}) creado`);
    }
    ids.set(data.username, user._id);
  }

  // ---------- migración: imágenes en disco (backend/uploads) → colección media ----------
  const legacyDir = resolve(process.cwd(), 'uploads');
  const TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };
  const migrateField = async (model: Model<any>, from: string, to: string, owner: (doc: any) => Types.ObjectId) => {
    const docs = await model.collection.find({ [from]: { $exists: true } }).toArray();
    let moved = 0;
    for (const doc of docs) {
      const url = String(doc[from] ?? '');
      const path = resolve(legacyDir, url.replace(/^\/uploads\//, ''));
      const type = TYPES[extname(path).toLowerCase()];
      const update: Record<string, unknown> = { $unset: { [from]: 1 } };
      if (url.startsWith('/uploads/') && path.startsWith(legacyDir + sep) && type && existsSync(path)) {
        update['$set'] = { [to]: await media.store(readFileSync(path), type, owner(doc)) };
        moved++;
      }
      await model.collection.updateOne({ _id: doc._id }, update);
    }
    return moved;
  };
  const movedPosts = await migrateField(posts, 'imageUrl', 'image', (d) => d.author);
  const movedAvatars = await migrateField(users, 'avatarUrl', 'avatar', (d) => d._id);
  if (movedPosts + movedAvatars) logger.log(`~ ${movedPosts} imágenes de posts y ${movedAvatars} avatares migrados a MongoDB`);

  // ---------- contenido de demostración ----------
  if (await posts.exists({ image: { $exists: true } })) {
    logger.log('= ya hay contenido de demostración');
  } else {
    // Las ilustraciones se guardan en la colección media (SVG generado acá, contenido confiable)
    const art = new Map<string, Types.ObjectId>();
    for (const [name, svg] of Object.entries(ARTWORKS)) {
      art.set(name, await media.store(Buffer.from(svg), 'image/svg+xml', ids.get('admin')));
    }

    const docs = DEMO_POSTS.map((p) => {
      const createdAt = ago(p.hoursAgo);
      return {
        _id: new Types.ObjectId(),
        author: ids.get(p.author)!,
        title: p.title,
        content: p.content,
        ...(p.art && { image: art.get(p.art) }),
        tags: extractTags(`${p.title} ${p.content}`),
        likesCount: 0,
        commentsCount: 0,
        createdAt,
        updatedAt: createdAt,
      };
    });
    // Se inserta directo en la colección para conservar las fechas pasadas
    await posts.collection.insertMany(docs);

    const people = [...ids.values()];
    const likeDocs: { post: Types.ObjectId; user: Types.ObjectId; createdAt: Date }[] = [];
    const commentDocs: { post: Types.ObjectId; author: Types.ObjectId; content: string; createdAt: Date; updatedAt: Date }[] = [];
    docs.forEach((post, i) => {
      const age = Date.now() - post.createdAt.getTime();
      // Los posts más nuevos reciben más me gusta recientes
      people.forEach((user, j) => {
        if ((i + j) % 3 === 2 && i % 2 === 0) return;
        likeDocs.push({ post: post._id, user, createdAt: new Date(post.createdAt.getTime() + age * ((j + 1) / (people.length + 1))) });
      });
      const commenters = post.image ? people.filter((u) => !u.equals(post.author)).slice(0, 2 + (i % 3)) : people.slice(0, 1);
      commenters.forEach((author, k) => {
        const createdAt = new Date(post.createdAt.getTime() + age * ((k + 1) / (commenters.length + 2)));
        commentDocs.push({ post: post._id, author, content: DEMO_COMMENTS[(i + k) % DEMO_COMMENTS.length], createdAt, updatedAt: createdAt });
      });
    });
    await likes.collection.insertMany(likeDocs);
    await comments.collection.insertMany(commentDocs);
    logger.log(`+ ${docs.length} publicaciones, ${likeDocs.length} me gusta y ${commentDocs.length} comentarios de demostración`);
  }

  // ---------- migración: referencias guardadas como string → ObjectId ----------
  const toObjectId = (field: string) => [{ $set: { [field]: { $toObjectId: `$${field}` } } }];
  const migrated = await Promise.all([
    posts.collection.updateMany({ author: { $type: 'string' } }, toObjectId('author')),
    likes.collection.updateMany({ post: { $type: 'string' } }, toObjectId('post')),
    likes.collection.updateMany({ user: { $type: 'string' } }, toObjectId('user')),
    comments.collection.updateMany({ post: { $type: 'string' } }, toObjectId('post')),
    comments.collection.updateMany({ author: { $type: 'string' } }, toObjectId('author')),
  ]);
  const fixed = migrated.reduce((n, r) => n + r.modifiedCount, 0);
  if (fixed) logger.log(`~ ${fixed} referencias migradas a ObjectId`);

  // ---------- actividad de demostración (ingresos, visitas, guardados y compartidos) ----------
  if (await logins.exists({})) {
    logger.log('= ya hay actividad de demostración');
  } else {
    // Pseudoaleatorio con semilla fija: los gráficos salen siempre parecidos
    let seedValue = 7;
    const rand = () => ((seedValue = (seedValue * 16807) % 2147483647) - 1) / 2147483646;
    const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
    const daysAgo = (max: number) => new Date(Date.now() - rand() * max * 24 * HOUR);
    const people = [...ids.values()];
    const activePosts = await posts.find({ deleted: { $ne: true } }, { _id: 1, author: 1 }).lean();

    const loginDocs = people.flatMap((user, i) =>
      Array.from({ length: 4 + ((i * 5) % 11) }, () => ({ user, createdAt: daysAgo(30) })),
    );
    const visitDocs = Array.from({ length: 70 }, () => {
      const profile = pick(people);
      let visitor = pick(people);
      while (visitor.equals(profile)) visitor = pick(people);
      return { profile, visitor, createdAt: daysAgo(30) };
    });
    const saveKeys = new Set<string>();
    const saveDocs = Array.from({ length: 18 }, () => ({ post: pick(activePosts)._id, user: pick(people), createdAt: daysAgo(10) })).filter(
      (d) => !saveKeys.has(`${d.post}-${d.user}`) && saveKeys.add(`${d.post}-${d.user}`),
    );
    const shareKeys = new Set<string>();
    const shareDocs = Array.from({ length: 16 }, () => {
      const from = pick(people);
      let to = pick(people);
      while (to.equals(from)) to = pick(people);
      const createdAt = daysAgo(10);
      return { post: pick(activePosts)._id, from, to, createdAt, updatedAt: createdAt };
    }).filter((d) => !shareKeys.has(`${d.post}-${d.from}-${d.to}`) && shareKeys.add(`${d.post}-${d.from}-${d.to}`));

    await Promise.all([
      logins.collection.insertMany(loginDocs),
      visits.collection.insertMany(visitDocs),
      saves.collection.insertMany(saveDocs),
      shares.collection.insertMany(shareDocs),
    ]);
    logger.log(
      `+ ${loginDocs.length} ingresos, ${visitDocs.length} visitas, ${saveDocs.length} guardados y ${shareDocs.length} compartidos de demostración`,
    );
  }

  // ---------- recalcula contadores y hashtags de todos los posts ----------
  const groupByPost = (model: Model<any>, match: Record<string, unknown> = {}) =>
    model.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: match }, { $group: { _id: '$post', n: { $sum: 1 } } }]);
  const [saveCounts, shareCounts] = await Promise.all([groupByPost(saves), groupByPost(shares)]);
  const saveMap = new Map(saveCounts.map((r) => [String(r._id), r.n]));
  const shareMap = new Map(shareCounts.map((r) => [String(r._id), r.n]));
  const [likeCounts, commentCounts] = await Promise.all([
    likes.aggregate<{ _id: Types.ObjectId; n: number }>([{ $group: { _id: '$post', n: { $sum: 1 } } }]),
    comments.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { deleted: { $ne: true } } },
      { $group: { _id: '$post', n: { $sum: 1 } } },
    ]),
  ]);
  const likeMap = new Map(likeCounts.map((r) => [String(r._id), r.n]));
  const commentMap = new Map(commentCounts.map((r) => [String(r._id), r.n]));
  const all = await posts.find({}, { title: 1, content: 1 }).lean();
  await posts.bulkWrite(
    all.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: {
          $set: {
            likesCount: likeMap.get(String(p._id)) ?? 0,
            commentsCount: commentMap.get(String(p._id)) ?? 0,
            savesCount: saveMap.get(String(p._id)) ?? 0,
            sharesCount: shareMap.get(String(p._id)) ?? 0,
            // Las publicaciones viejas sin título toman las primeras palabras del mensaje
            title: p.title || titleFrom(p.content),
            tags: extractTags(`${p.title || ''} ${p.content ?? ''}`),
          },
        },
      },
    })),
  );
  logger.log(`= contadores sincronizados en ${all.length} publicaciones`);

  await app.close();
  logger.log('Listo ✔');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
