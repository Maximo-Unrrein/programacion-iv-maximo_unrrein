export interface Author {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  postId: string;
  /** Comentario principal al que responde (`null` si es principal). */
  parentId: string | null;
  content: string;
  createdAt: string;
  /** El autor lo editó después de publicarlo. */
  modificado: boolean;
  modifiedAt: string | null;
  likesCount: number;
  likedByMe: boolean;
  /** Respuestas (sólo en comentarios principales). */
  repliesCount: number;
  author: Author | null;
}

/** Página de comentarios (más recientes primero). */
export interface CommentPage {
  items: Comment[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  /** Portada (primera imagen) o null. */
  imageUrl: string | null;
  /** Todas las imágenes, en orden del carrusel. */
  imageUrls: string[];
  tags: string[];
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  sharesCount: number;
  createdAt: string;
  author: Author | null;
  likedByMe: boolean;
  /** Está en mis guardados. */
  savedByMe: boolean;
  /** Últimos comentarios principales, los más recientes primero (vista previa). */
  comments: Comment[];
  /** Cantidad de comentarios principales (`commentsCount` incluye las respuestas). */
  topCommentsCount: number;
}

export interface Profile extends Author {
  firstName: string;
  lastName: string;
  /** Sólo viene en el propio perfil. */
  email: string | null;
  birthDate: string | null;
  bio: string | null;
  /** Sólo lo ven los administradores. */
  active?: boolean;
  role: 'user' | 'admin';
  createdAt: string;
  /** `visits`: visitas de otros usuarios a este perfil (sólo la ve el dueño o un admin). */
  stats: { posts: number; likes: number; visits: number | null };
}

/** Publicación que otro usuario me compartió. */
export interface SharedItem {
  id: string;
  sharedBy: Author | null;
  sharedAt: string;
  post: Post;
}

export type FeedSort = 'fecha' | 'likes' | 'guardados' | 'compartidos';

export type TrendSort = 'popular' | 'recent';
export type TrendWindow = '24h' | '7d' | '30d';

export interface TrendItem {
  post: Post;
  /** popular: me gusta + 2 × comentarios · recent: me gusta recibidos en el período */
  metric: number;
}

export interface TagTrend {
  tag: string;
  count: number;
}

// ---------- mensajes directos ----------

export interface Conversation {
  user: Author;
  unread: number;
  last: { content: string; fromMe: boolean; createdAt: string; hasPost: boolean };
}

export interface Message {
  id: string;
  fromMe: boolean;
  content: string;
  createdAt: string;
  readAt: string | null;
  /** Publicación compartida en el mensaje. */
  post: { id: string; title: string; imageUrl: string | null; author: Author | null } | null;
  /** Tenía una publicación que ya no está disponible. */
  postUnavailable: boolean;
}

export interface Thread {
  user: Author;
  /** Los más nuevos primero. */
  items: Message[];
  hasMore: boolean;
}

// ---------- moderación ----------

export type ReportType = 'post' | 'comment';
export type ReportReason = 'spam' | 'ofensivo' | 'inapropiado' | 'falso' | 'otro';
export type ReportStatus = 'pendiente' | 'resuelto' | 'descartado';

export const REPORT_REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: 'spam', label: 'Spam', hint: 'Publicidad, enlaces engañosos o contenido repetido' },
  { id: 'ofensivo', label: 'Ofensivo', hint: 'Insultos, acoso o discurso de odio' },
  { id: 'inapropiado', label: 'Inapropiado', hint: 'Contenido violento o sexual' },
  { id: 'falso', label: 'Información falsa', hint: 'Engaños o datos falsos' },
  { id: 'otro', label: 'Otro motivo', hint: 'Contanos qué pasa en el detalle' },
];

/** Un contenido denunciado con todas sus denuncias (cola de moderación). */
export interface ReportGroup {
  targetId: string;
  type: ReportType;
  postId: string;
  count: number;
  reasons: Partial<Record<ReportReason, number>>;
  lastAt: string;
  resolvedAt: string | null;
  target: {
    title: string | null;
    content: string;
    imageUrl: string | null;
    author: Author | null;
    deleted: boolean;
    createdAt: string;
  } | null;
  reports: { reporter: Author | null; reason: ReportReason; detail: string; createdAt: string }[];
}
