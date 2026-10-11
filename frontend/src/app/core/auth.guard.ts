import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.isLoggedIn() ? true : router.createUrlTree(['/ingresar']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.isLoggedIn() ? router.createUrlTree(['/feed']) : true;
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  if (!auth.isLoggedIn()) return router.createUrlTree(['/ingresar']);
  return auth.isAdmin() ? true : router.createUrlTree(['/feed']);
};
