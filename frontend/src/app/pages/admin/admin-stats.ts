import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AdminService, Period } from '../../core/admin.service';
import { errorMessage } from '../../core/auth.service';
import { ChartView } from '../../shared/chart';
import { Icon } from '../../shared/icon';

const DAY = 86_400_000;

type CsvKey =
  | 'publicaciones-por-usuario'
  | 'comentarios-por-dia'
  | 'comentarios-por-publicacion'
  | 'me-gusta-por-dia'
  | 'ingresos-por-usuario'
  | 'visitas-por-perfil';

interface CsvTable {
  title: string;
  header: string[];
  rows: (string | number)[][];
}

const toLines = (t: CsvTable) => [t.header, ...t.rows];

/** Campo CSV: entre comillas si hace falta (y comillas internas duplicadas). */
const cell = (v: string | number) => {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Genera y descarga el archivo. Se usa ";" como separador y BOM UTF-8
 * para que Excel en español lo abra en columnas y con los acentos bien.
 */
function download(filename: string, lines: (string | number)[][]) {
  const text = '\uFEFF' + lines.map((l) => l.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
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

  // ---------- exportar a CSV ----------

  /** Tablas de cada gráfico con los datos del período elegido. */
  private tables(): Record<CsvKey, CsvTable> | null {
    const c = this.charts.value();
    if (!c) return null;
    return {
      'publicaciones-por-usuario': {
        title: 'Publicaciones por usuario',
        header: ['Usuario', 'Nombre', 'Publicaciones'],
        rows: c.postsByUser.items.map((i) => [i.username, i.displayName, i.count]),
      },
      'comentarios-por-dia': {
        title: 'Comentarios por día',
        header: ['Fecha', 'Comentarios'],
        rows: c.commentsByDay.items.map((i) => [i.date, i.count]),
      },
      'comentarios-por-publicacion': {
        title: 'Comentarios por publicación',
        header: ['Publicación', 'Autor', 'Comentarios'],
        rows: c.commentsByPost.items.map((i) => [i.title, i.author, i.count]),
      },
      'me-gusta-por-dia': {
        title: 'Me gusta por día',
        header: ['Fecha', 'Me gusta'],
        rows: c.likesByDay.items.map((i) => [i.date, i.count]),
      },
      'ingresos-por-usuario': {
        title: 'Ingresos por usuario',
        header: ['Usuario', 'Nombre', 'Ingresos'],
        rows: c.loginsByUser.items.map((i) => [i.username, i.displayName, i.count]),
      },
      'visitas-por-perfil': {
        title: 'Visitas por perfil',
        header: ['Usuario', 'Nombre', 'Visitas'],
        rows: c.visitsByProfile.items.map((i) => [i.username, i.displayName, i.count]),
      },
    };
  }

  /** Descarga un gráfico (`key`) o todos juntos, separados por su título. */
  protected exportCsv(key?: CsvKey) {
    const tables = this.tables();
    if (!tables) return;
    const { from, to } = this.period();
    const selected = key ? [tables[key]] : Object.values(tables);
    const lines = key
      ? toLines(selected[0])
      : [[`MaxSend · Estadísticas del ${from} al ${to}`], ...selected.flatMap((t) => [[], [t.title], ...toLines(t)])];
    download(`maxsend-${key ?? 'estadisticas'}-${from}_${to}.csv`, lines);
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
