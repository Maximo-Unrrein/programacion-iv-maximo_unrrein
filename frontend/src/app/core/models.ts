export interface Author {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  /** El autor lo editó después de publicarlo. */
  modificado: boolean;
  modifiedAt: string | null;
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
  imageUrl: string | null;
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
  /** Últimos comentarios, los más recientes primero (vista previa). */
  comments: Comment[];
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
