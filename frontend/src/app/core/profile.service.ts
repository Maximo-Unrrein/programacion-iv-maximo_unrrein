import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Profile } from './models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/users`;

  get(username: string) {
    return this.http.get<Profile>(`${this.url}/${encodeURIComponent(username)}`);
  }

  update(changes: { firstName?: string; lastName?: string; birthDate?: string; bio?: string }) {
    return this.http.patch<Profile>(`${this.url}/me`, changes);
  }

  uploadAvatar(file: File) {
    const body = new FormData();
    body.append('avatar', file);
    return this.http.post<Profile>(`${this.url}/me/avatar`, body);
  }

  removeAvatar() {
    return this.http.delete<Profile>(`${this.url}/me/avatar`);
  }
}
