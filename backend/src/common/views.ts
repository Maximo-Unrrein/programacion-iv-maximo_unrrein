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
  content: string;
  createdAt: Date;
  /** El comentario fue editado por su autor. */
  modificado: boolean;
  modifiedAt: Date | null;
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

export function commentView(comment: any): CommentView {
  return {
    id: String(comment._id),
    postId: String(comment.post),
    content: comment.content,
    createdAt: comment.createdAt,
    modificado: !!comment.modificado,
    modifiedAt: comment.modifiedAt ?? null,
    author: authorView(comment.author),
  };
}

/** Extrae hashtags únicos (en minúscula) de un texto. */
export function extractTags(text: string): string[] {
  const tags = [...text.matchAll(/#([\p{L}\p{N}_]{2,30})/gu)].map((m) => m[1].toLowerCase());
  return [...new Set(tags)].slice(0, 10);
}
