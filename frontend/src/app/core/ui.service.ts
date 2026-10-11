import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Post } from './models';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

/** Estado de UI compartido: el compositor de envíos y los avisos (toasts). */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly composerOpen = signal(false);
  /** Emite cada post recién publicado para que las vistas lo agreguen. */
  readonly postCreated = new Subject<Post>();

  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;

  openComposer() {
    this.composerOpen.set(true);
  }

  toast(message: string, kind: Toast['kind'] = 'info') {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, message, kind }]);
    setTimeout(() => this.dismiss(id), 4000);
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Valida una imagen antes de subirla. Devuelve un mensaje de error o null. */
export function validateImage(file: File, maxMb: number): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Formato no permitido. Usá JPG, PNG, WEBP o GIF.';
  if (file.size > maxMb * 1024 * 1024) return `La imagen supera los ${maxMb} MB.`;
  return null;
}
