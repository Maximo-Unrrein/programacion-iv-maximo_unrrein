import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Rutas donde un 401 es una respuesta esperada (credenciales incorrectas, token al iniciar) y no una sesión vencida. */
const AUTH_ROUTES = ['/auth/login', '/auth/register', '/auth/autorizar'];

/**
 * - Adjunta el JWT a las llamadas hacia la API de Nest.
 * - Si la API responde 401 (token vencido o inválido), cierra la sesión y lleva al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      const isAuthRoute = AUTH_ROUTES.some((path) => req.url.startsWith(environment.apiUrl + path));
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthRoute && auth.token()) {
        auth.logout();
        router.navigate(['/ingresar'], { queryParams: { sesion: 'expirada' } });
      }
      return throwError(() => error);
    }),
  );
};
