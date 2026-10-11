import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AdminService, Period } from '../../core/admin.service';
import { errorMessage } from '../../core/auth.service';
import { ChartView } from '../../shared/chart';
import { Icon } from '../../shared/icon';

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Fecha de hoy en Argentina (AAAA-MM-DD). */
const today = () => iso(new Date(Date.now() - 3 * 3_600_000));

/** Dashboard / estadísticas: gráficos con período elegible. */
@Component({
  selector: 'ms-admin-stats',
  imports: [DatePipe, ChartView, Icon],
  templateUrl: './admin-stats.html',
})
export class AdminStats {
  private readonly api = inject(AdminService);

  protected readonly presets = [
    { days: 7, label: '7 días' },
    { days: 30, label: '30 días' },
    { days: 90, label: '90 días' },
  ];
  protected readonly preset = signal<number | null>(30);
  protected readonly period = signal<Period>({ from: iso(new Date(Date.now() - 3 * 3_600_000 - 29 * DAY)), to: today() });
  protected readonly today = today();
  protected readonly rangeError = signal<string | null>(null);

  protected readonly summary = rxResource({ stream: () => this.api.summary() });

  protected readonly charts = rxResource({
    params: () => this.period(),
    stream: ({ params }) =>
      forkJoin({
        postsByUser: this.api.postsByUser(params),
        commentsByDay: this.api.commentsByDay(params),
        commentsByPost: this.api.commentsByPost(params),
        likesByDay: this.api.likesByDay(params),
        loginsByUser: this.api.loginsByUser(params),
        visitsByProfile: this.api.visitsByProfile(params),
      }),
  });
  protected readonly chartsError = computed(() => (this.charts.error() ? errorMessage(this.charts.error()) : null));

  protected readonly cards = computed(() => {
    const s = this.summary.value();
    return [
      { label: 'Usuarios', value: s?.users },
      { label: 'Publicaciones', value: s?.posts },
      { label: 'Comentarios', value: s?.comments },
      { label: 'Me gusta', value: s?.likes },
    ];
  });

  /** Etiqueta corta de un día para los ejes (p. ej. "8 oct"). */
  protected dayLabel = (date: string) =>
    new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

  protected readonly series = computed(() => {
    const c = this.charts.value();
    if (!c) return null;
    return {
      postsByUser: {
        labels: c.postsByUser.items.map((i) => '@' + i.username),
        data: c.postsByUser.items.map((i) => i.count),
        total: c.postsByUser.items.reduce((n, i) => n + i.count, 0),
      },
      commentsByDay: { labels: c.commentsByDay.items.map((i) => this.dayLabel(i.date)), data: c.commentsByDay.items.map((i) => i.count), total: c.commentsByDay.total },
      commentsByPost: {
        labels: c.commentsByPost.items.map((i) => (i.title.length > 26 ? i.title.slice(0, 25) + '…' : i.title)),
        data: c.commentsByPost.items.map((i) => i.count),
      },
      likesByDay: { labels: c.likesByDay.items.map((i) => this.dayLabel(i.date)), data: c.likesByDay.items.map((i) => i.count), total: c.likesByDay.total },
      loginsByUser: { labels: c.loginsByUser.items.map((i) => '@' + i.username), data: c.loginsByUser.items.map((i) => i.count), total: c.loginsByUser.total },
      visitsByProfile: { labels: c.visitsByProfile.items.map((i) => '@' + i.username), data: c.visitsByProfile.items.map((i) => i.count), total: c.visitsByProfile.total },
    };
  });

  protected usePreset(days: number) {
    this.preset.set(days);
    this.rangeError.set(null);
    this.period.set({ from: iso(new Date(Date.now() - 3 * 3_600_000 - (days - 1) * DAY)), to: today() });
  }

  protected setRange(field: 'from' | 'to', value: string) {
    if (!value) return;
    const next = { ...this.period(), [field]: value };
    if (next.from > next.to) {
      this.rangeError.set('La fecha "desde" tiene que ser anterior a "hasta".');
      return;
    }
    this.rangeError.set(null);
    this.preset.set(null);
    this.period.set(next);
  }
}
