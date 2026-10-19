import { Injectable, signal } from '@angular/core';
import { ReportType } from './models';

export interface ReportRequest {
  type: ReportType;
  targetId: string;
  /** Cómo se nombra el contenido en el diálogo (p. ej. el título del post o un extracto del comentario). */
  preview: string;
}

/** Abre el diálogo para denunciar una publicación o un comentario (montado una sola vez en la app). */
@Injectable({ providedIn: 'root' })
export class ReportService {
  readonly request = signal<ReportRequest | null>(null);

  open(request: ReportRequest) {
    this.request.set(request);
  }

  close() {
    this.request.set(null);
  }
}
