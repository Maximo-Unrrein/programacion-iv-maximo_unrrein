import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/** Todos los datos del usuario que devuelve el backend (sin la contraseña). */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  username: string;
  birthDate: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: 'user' | 'admin';
  active?: boolean;
  createdAt?: string | null;
}

interface AuthResponse {
  accessToken: string;
  user: User;
}

const TOKEN_KEY = 'maxsend-token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/auth`;

  readonly token = signal<string | null>(readToken());
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  /** Momento (ms) en que vence el token actual, leído de su campo `exp`. */
  readonly expiresAt = computed(() => tokenExpiry(this.token()));

  /** `true` mientras se valida el token guardado al iniciar la app (pantalla de carga). */
  readonly booting = signal(true);
  /** Había un token guardado pero el servidor lo rechazó (vencido o inválido). */
  readonly sessionExpired = signal(false);

  /** Se resuelve cuando se validó (o descartó) la sesión guardada. Lo usan los guards. */
  readonly ready: Promise<void> = this.restore().finally(() => this.booting.set(false));

  /** `user` puede ser el correo o el nombre de usuario. */
  async login(user: string, password: string) {
    this.startSession(await this.post('login', { user, password }));
  }

  /** Registro con todos los datos y la foto de perfil (multipart). */
  async register(data: FormData) {
    this.startSession(await this.post('register', data));
  }

  /** Actualiza los datos del usuario en sesión (p. ej. después de editar el perfil). */
  patchUser(changes: Partial<User>) {
    this.user.update((u) => (u ? { ...u, ...changes } : u));
  }

  /** Pide un token nuevo (misma payload, otros 15 minutos) para extender la sesión. */
  async refresh() {
    const { accessToken } = await firstValueFrom(this.http.post<{ accessToken: string }>(`${this.url}/refrescar`, {}));
    this.token.set(accessToken);
    writeToken(accessToken);
  }

  logout() {
    this.token.set(null);
    this.user.set(null);
    writeToken(null);
  }

  /** Valida el token guardado contra la ruta `autorizar` del backend. */
  private async restore() {
    if (!this.token()) return;
    // Esperamos a que termine el constructor: el interceptor inyecta este mismo servicio
    await Promise.resolve();
    try {
      this.user.set(await firstValueFrom(this.http.post<User>(`${this.url}/autorizar`, {})));
    } catch (e) {
      // Sólo descartamos el token si el servidor lo rechaza; si está caído, se conserva para el próximo intento
      if (e instanceof HttpErrorResponse && (e.status === 401 || e.status === 403)) {
        this.logout();
        this.sessionExpired.set(true);
      }
    }
  }

  private async post(path: string, body: object | FormData) {
    try {
      return await firstValueFrom(this.http.post<AuthResponse>(`${this.url}/${path}`, body));
    } catch (e) {
      throw new Error(errorMessage(e));
    }
  }

  private startSession({ accessToken, user }: AuthResponse) {
    this.sessionExpired.set(false);
    this.token.set(accessToken);
    this.user.set(user);
    writeToken(accessToken);
  }
}

/** Extrae un mensaje legible de los errores de Nest (string o lista de validación). */
export function errorMessage(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No se pudo conectar con el servidor. ¿Está corriendo el backend?';
    // El hosting corta los envíos de más de 4,5 MB antes de que lleguen a la API
    if (e.status === 413) return 'El envío es demasiado pesado. Probá con menos imágenes o más livianas.';
    const message = e.error?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
  }
  // Errores propios del frontend (p. ej. validaciones antes de subir)
  if (e instanceof Error && e.message) return e.message;
  return 'Ocurrió un error inesperado';
}

/** Lee el vencimiento (`exp`, en segundos) de la payload del JWT. */
function tokenExpiry(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}
