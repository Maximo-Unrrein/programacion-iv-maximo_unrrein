import { mediaUrl } from './uploads';

/** Formas públicas que devuelve la API (se arman desde documentos `lean()`). */

export interface AuthorView {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CommentView {
  id: string;
  postId: string;
  /** Comentario principal al que responde (`null` si es principal). */
  parentId: string | null;
  content: string;
  createdAt: Date;
  /** El comentario fue editado por su autor. */
  modificado: boolean;
  modifiedAt: Date | null;
  likesCount: number;
  likedByMe: boolean;
  /** Respuestas que tiene (sólo comentarios principales). */
  repliesCount: number;
  author: AuthorView | null;
}

/** Campos del autor que se populan en posts y comentarios. */
export const AUTHOR_FIELDS = 'username displayName avatar';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function authorView(user: any): AuthorView | null {
  if (!user?._id) return null;
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: mediaUrl(user.avatar),
  };
}

export function commentView(comment: any, likedByMe = false): CommentView {
  return {
    id: String(comment._id),
    postId: String(comment.post),
    parentId: comment.parent ? String(comment.parent) : null,
    content: comment.content,
    createdAt: comment.createdAt,
    modificado: !!comment.modificado,
    modifiedAt: comment.modifiedAt ?? null,
    likesCount: comment.likesCount ?? 0,
    likedByMe,
    repliesCount: comment.repliesCount ?? 0,
    author: authorView(comment.author),
  };
}

/** Extrae hashtags únicos (en minúscula) de un texto. */
export function extractTags(text: string): string[] {
  const tags = [...text.matchAll(/#([\p{L}\p{N}_]{2,30})/gu)].map((m) => m[1].toLowerCase());
  return [...new Set(tags)].slice(0, 10);
}
