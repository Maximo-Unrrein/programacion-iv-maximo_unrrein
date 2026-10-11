import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { ThemeService } from '../core/theme.service';

Chart.register(
  BarController,
  LineController,
  DoughnutController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

export type ChartKind = 'bar' | 'horizontal-bar' | 'line' | 'doughnut';

/** Lee un color del tema actual (variables CSS). */
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Escala de grises de la paleta para las porciones de la torta (de más claro a más oscuro en el tema oscuro). */
const SLICES_DARK = ['#ffffff', '#d9dee7', '#b4bcc9', '#8993a3', '#6b7484', '#525a68', '#3f4552', '#30353f', '#282d35', '#1f232a'];
const SLICES_LIGHT = ['#111317', '#282d35', '#3f4552', '#525a68', '#6b7484', '#8993a3', '#a3abb8', '#b4bcc9', '#c8ced8', '#d9dee7'];

/** Gráfico de Chart.js con los colores de la paleta; se redibuja al cambiar datos o tema. */
@Component({
  selector: 'ms-chart',
  template: `<canvas #canvas [attr.aria-label]="label()" role="img"></canvas>`,
  host: { class: 'relative block' },
})
export class ChartView {
  readonly kind = input.required<ChartKind>();
  readonly labels = input.required<string[]>();
  readonly data = input.required<number[]>();
  /** Nombre de la serie (tooltip y lectores de pantalla). */
  readonly label = input('');

  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;
  private ready = false;

  constructor() {
    afterNextRender(() => {
      this.ready = true;
      this.render();
    });
    effect(() => {
      // Dependencias: datos, tipo y tema
      this.kind();
      this.labels();
      this.data();
      this.theme.theme();
      if (this.ready) this.render();
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private render() {
    this.chart?.destroy();
    this.chart = new Chart(this.canvas().nativeElement, this.config());
  }

  private config(): ChartConfiguration {
    const fg = css('--fg');
    const muted = css('--muted');
    const faint = css('--faint');
    const line = css('--line');
    const dark = this.theme.theme() === 'dark';
    const kind = this.kind();
    const font = { family: 'Inter, system-ui, sans-serif', size: 12 };
    const tooltip = {
      backgroundColor: dark ? '#282d35' : '#ffffff',
      titleColor: fg,
      bodyColor: muted,
      borderColor: line,
      borderWidth: 1,
      padding: 10,
      cornerRadius: 10,
    };

    if (kind === 'doughnut') {
      const doughnut: ChartConfiguration<'doughnut'> = {
        type: 'doughnut',
        data: {
          labels: this.labels(),
          datasets: [
            {
              label: this.label(),
              data: this.data(),
              backgroundColor: (dark ? SLICES_DARK : SLICES_LIGHT).slice(0, this.data().length),
              borderColor: css('--bg'),
              borderWidth: 2,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'right', labels: { color: muted, font, boxWidth: 12, boxHeight: 12, padding: 12 } },
            tooltip,
          },
        },
      };
      return doughnut as unknown as ChartConfiguration;
    }

    const horizontal = kind === 'horizontal-bar';
    const valueAxis = { beginAtZero: true, ticks: { color: faint, font, precision: 0 }, grid: { color: line }, border: { display: false } };
    const categoryAxis = { ticks: { color: muted, font, maxRotation: 0, autoSkip: true }, grid: { display: false }, border: { color: line } };
    return {
      type: kind === 'line' ? 'line' : 'bar',
      data: {
        labels: this.labels(),
        datasets: [
          {
            label: this.label(),
            data: this.data(),
            backgroundColor: kind === 'line' ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(17,19,23,0.08)') : dark ? '#d9dee7' : '#282d35',
            hoverBackgroundColor: fg,
            borderColor: fg,
            borderWidth: kind === 'line' ? 2 : 0,
            borderRadius: 6,
            fill: kind === 'line',
            tension: 0.35,
            pointRadius: kind === 'line' ? 3 : 0,
            pointBackgroundColor: fg,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
        plugins: { legend: { display: false }, tooltip },
      },
    };
  }
}
