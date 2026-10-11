import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Acción destructiva: el botón de confirmar se muestra en rojo. */
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (accepted: boolean) => void;
}

/** Confirmaciones con un modal propio (en lugar de `confirm()` del navegador). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);

  /** Abre el modal y resuelve `true` si el usuario confirma. */
  ask(options: ConfirmOptions): Promise<boolean> {
    // Si había otra confirmación abierta, se da por cancelada
    this.request()?.resolve(false);
    return new Promise((resolve) => this.request.set({ ...options, resolve }));
  }

  settle(accepted: boolean) {
    const request = this.request();
    this.request.set(null);
    request?.resolve(accepted);
  }
}
