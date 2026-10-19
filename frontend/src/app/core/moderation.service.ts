import { Injectable, inject, signal } from '@angular/core';
import { AdminService } from './admin.service';

/** Cantidad de contenidos con denuncias pendientes (indicador del panel de administración). */
@Injectable({ providedIn: 'root' })
export class ModerationService {
  private readonly admin = inject(AdminService);
  readonly pending = signal(0);

  refresh() {
    this.admin.pendingReports().subscribe({ next: (r) => this.pending.set(r.count), error: () => undefined });
  }
}
