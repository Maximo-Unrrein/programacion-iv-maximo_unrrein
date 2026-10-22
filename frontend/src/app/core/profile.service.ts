import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { shrinkImage } from './image';
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

  /** Sube la foto de perfil (achicada antes en el navegador). */
  uploadAvatar(file: File) {
    return from(shrinkImage(file)).pipe(
      switchMap((small) => {
        const body = new FormData();
        body.append('avatar', small);
        return this.http.post<Profile>(`${this.url}/me/avatar`, body);
      }),
    );
  }

  removeAvatar() {
    return this.http.delete<Profile>(`${this.url}/me/avatar`);
  }
}
