import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import type { User } from './auth.service';
import type { ReportGroup, ReportStatus } from './models';

export interface StatsSummary {
  users: number;
  admins: number;
  inactive: number;
  posts: number;
  comments: number;
  likes: number;
}

export interface Period {
  from: string;
  to: string;
}

export interface PostsByUser extends Period {
  items: { username: string; displayName: string; count: number }[];
}

export interface PerDay extends Period {
  total: number;
  items: { date: string; count: number }[];
}

/** Conteo por usuario (ingresos o visitas recibidas). */
export interface ByUser extends Period {
  total: number;
  items: { username: string; displayName: string; count: number }[];
}

export interface CommentsByPost extends Period {
  items: { postId: string; title: string; author: string; count: number }[];
}

/** Rutas sólo para administradores: usuarios (`/users`) y estadísticas (`/stats`). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // ---------- usuarios ----------

  users() {
    return this.http.get<User[]>(`${this.api}/users`);
  }

  /** Alta de un usuario (mismos datos que el registro + `role`). */
  createUser(data: FormData) {
    return this.http.post<User>(`${this.api}/users`, data);
  }

  /** Baja lógica (deshabilitar). */
  disable(id: string) {
    return this.http.delete<User>(`${this.api}/users/${id}`);
  }

  /** Alta lógica (rehabilitar). */
  enable(id: string) {
    return this.http.post<User>(`${this.api}/users/${id}/enable`, {});
  }

  setRole(id: string, role: User['role']) {
    return this.http.patch<User>(`${this.api}/users/${id}/role`, { role });
  }

  // ---------- estadísticas ----------

  summary() {
    return this.http.get<StatsSummary>(`${this.api}/stats/summary`);
  }

  postsByUser(period: Period) {
    return this.http.get<PostsByUser>(`${this.api}/stats/posts-by-user`, { params: params(period) });
  }

  commentsByDay(period: Period) {
    return this.http.get<PerDay>(`${this.api}/stats/comments-by-day`, { params: params(period) });
  }

  commentsByPost(period: Period) {
    return this.http.get<CommentsByPost>(`${this.api}/stats/comments-by-post`, { params: params(period) });
  }

  loginsByUser(period: Period) {
    return this.http.get<ByUser>(`${this.api}/stats/logins-by-user`, { params: params(period) });
  }

  visitsByProfile(period: Period) {
    return this.http.get<ByUser>(`${this.api}/stats/visits-by-profile`, { params: params(period) });
  }

  likesByDay(period: Period) {
    return this.http.get<PerDay>(`${this.api}/stats/likes-by-day`, { params: params(period) });
  }

  // ---------- moderación ----------

  /** Cola de denuncias agrupadas por contenido. */
  reports(status: ReportStatus = 'pendiente') {
    return this.http.get<ReportGroup[]>(`${this.api}/reports`, { params: { status } });
  }

  pendingReports() {
    return this.http.get<{ count: number }>(`${this.api}/reports/pending-count`);
  }

  /** `eliminar` da de baja el contenido; `descartar` lo deja publicado. */
  resolveReport(targetId: string, action: 'eliminar' | 'descartar') {
    return this.http.post<{ resolved: number }>(`${this.api}/reports/${targetId}/resolve`, { action });
  }
}

const params = (p: Period) => new HttpParams().set('from', p.from).set('to', p.to);
