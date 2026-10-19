import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Conversation, Message, Thread } from './models';

/** Mensajes directos. `unread` alimenta el indicador de la navegación. */
@Injectable({ providedIn: 'root' })
export class MessagesService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/messages`;

  /** Mensajes sin leer (se actualiza al consultar y al abrir una conversación). */
  readonly unread = signal(0);

  conversations() {
    return this.http.get<Conversation[]>(this.api).pipe(tap((list) => this.unread.set(list.reduce((n, c) => n + c.unread, 0))));
  }

  /** Conversación con `username`: los más nuevos primero; `before` trae los anteriores. Marca leídos. */
  thread(username: string, before?: string, limit = 30) {
    return this.http.get<Thread>(`${this.api}/${username}`, { params: { limit, ...(before && { before }) } });
  }

  send(username: string, content: string) {
    return this.http.post<Message>(`${this.api}/${username}`, { content });
  }

  refreshUnread() {
    return this.http.get<{ count: number }>(`${this.api}/unread`).pipe(tap((r) => this.unread.set(r.count)));
  }
}
