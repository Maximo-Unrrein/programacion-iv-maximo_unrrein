import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  Author,
  Comment,
  CommentPage,
  FeedSort,
  Post,
  ReportReason,
  ReportType,
  SharedItem,
  TagTrend,
  TrendItem,
  TrendSort,
  TrendWindow,
} from './models';

export type FeedQuery = {
  author?: string;
  /** fecha (por defecto), likes, guardados o compartidos */
  sort?: FeedSort;
  offset?: number;
  tag?: string;
  /** Texto a buscar en el título o el mensaje */
  q?: string;
  before?: string;
  limit?: number;
};

@Injectable({ providedIn: 'root' })
export class PostsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  feed(query: FeedQuery = {}) {
    return this.http.get<Post[]>(`${this.api}/posts`, { params: clean(query) });
  }

  /** Crea una publicación con sus imágenes (opcionales, hasta 4, en orden del carrusel). */
  create(title: string, content: string, images: File[] = []) {
    const body = new FormData();
    body.append('title', title);
    body.append('content', content);
    for (const image of images) body.append('images', image);
    return this.http.post<Post>(`${this.api}/posts`, body);
  }

  findOne(id: string) {
    return this.http.get<Post>(`${this.api}/posts/${id}`);
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.api}/posts/${id}`);
  }

  like(id: string) {
    return this.http.post<{ liked: boolean; likesCount: number }>(`${this.api}/posts/${id}/like`, {});
  }

  unlike(id: string) {
    return this.http.delete<{ liked: boolean; likesCount: number }>(`${this.api}/posts/${id}/like`);
  }

  // ---------- guardados y compartidos ----------

  save(id: string) {
    return this.http.post<{ saved: boolean; savesCount: number }>(`${this.api}/posts/${id}/save`, {});
  }

  unsave(id: string) {
    return this.http.post<{ saved: boolean; savesCount: number }>(`${this.api}/posts/${id}/unsave`, {});
  }

  saved(offset = 0, limit = 8) {
    return this.http.get<Post[]>(`${this.api}/posts/saved`, { params: { offset, limit } });
  }

  /** Le comparte la publicación al usuario `to` (id). */
  share(id: string, to: string) {
    return this.http.post<{ sharedWith: string; sharesCount: number; alreadyShared: boolean }>(`${this.api}/posts/${id}/share`, { to });
  }

  /** Publicaciones que me compartieron, con quién las compartió. */
  shared(offset = 0, limit = 8) {
    return this.http.get<SharedItem[]>(`${this.api}/posts/shared`, { params: { offset, limit } });
  }

  /** Busca usuarios para elegir a quién compartir. */
  searchUsers(q: string) {
    return this.http.get<Author[]>(`${this.api}/users/search`, { params: { q } });
  }

  /** Comentarios paginados, los más recientes primero. */
  comments(postId: string, offset = 0, limit = 5) {
    return this.http.get<CommentPage>(`${this.api}/posts/${postId}/comments`, { params: { offset, limit } });
  }

  updateComment(id: string, content: string) {
    return this.http.put<Comment>(`${this.api}/comments/${id}`, { content });
  }

  /** Comentario nuevo; con `parentId` es una respuesta (hilo de un nivel). */
  addComment(postId: string, content: string, parentId?: string) {
    return this.http.post<Comment>(`${this.api}/posts/${postId}/comments`, { content, ...(parentId && { parentId }) });
  }

  /** Respuestas de un comentario, las más antiguas primero. */
  replies(commentId: string, offset = 0, limit = 20) {
    return this.http.get<CommentPage>(`${this.api}/comments/${commentId}/replies`, { params: { offset, limit } });
  }

  /** Baja del comentario (y de sus respuestas si es principal). */
  removeComment(id: string) {
    return this.http.delete<{ removed: number }>(`${this.api}/comments/${id}`);
  }

  likeComment(id: string) {
    return this.http.post<{ liked: boolean; likesCount: number }>(`${this.api}/comments/${id}/like`, {});
  }

  unlikeComment(id: string) {
    return this.http.delete<{ liked: boolean; likesCount: number }>(`${this.api}/comments/${id}/like`);
  }

  /** Denuncia una publicación o un comentario. */
  report(type: ReportType, targetId: string, reason: ReportReason, detail?: string) {
    return this.http.post<{ reported: boolean }>(`${this.api}/reports`, { type, targetId, reason, ...(detail && { detail }) });
  }

  trending(sort: TrendSort, window: TrendWindow, tag?: string) {
    return this.http.get<TrendItem[]>(`${this.api}/trends/posts`, { params: clean({ sort, window, tag }) });
  }

  trendingTags(window: TrendWindow) {
    return this.http.get<TagTrend[]>(`${this.api}/trends/tags`, { params: { window } });
  }
}

function clean(params: Record<string, string | number | undefined>) {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') result = result.set(key, value);
  }
  return result;
}
