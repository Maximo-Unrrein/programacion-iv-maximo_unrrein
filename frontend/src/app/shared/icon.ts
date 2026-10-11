import { Component, input } from '@angular/core';

const ICONS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h4.5v-6h4v6h4.5V9.5',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.6-6 8-6s8 2 8 6',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z',
  plus: 'M12 5v14M5 12h14',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  heart:
    'M12 20s-7-4.4-9.2-8.6C1.3 8.4 3.1 5 6.4 5c2.1 0 3.6 1.2 4.6 2.6l1 1.3 1-1.3C14 6.2 15.5 5 17.6 5c3.3 0 5.1 3.4 3.6 6.4C19 15.6 12 20 12 20Z',
  comment: 'M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.4A8 8 0 1 1 21 12Z',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5 3-3 4 4M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  send: 'M4 12 20 4l-6 16-2.5-6.5L4 12ZM11.5 13.5 20 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  close: 'M6 6l12 12M18 6 6 18',
  'arrow-left': 'M19 12H5M11 18l-6-6 6-6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4',
  flame: 'M12 21c-4 0-7-2.7-7-6.5 0-3 2-5 3.5-6.5.5 2 1.5 3 2.5 3.5C11 8 12 5 14 3c.5 3 5 5.5 5 11 0 4-3 7-7 7Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  hash: 'M5 9h14M5 15h14M10 4 8 20M16 4l-2 16',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'eye-off': 'M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  bookmark: 'M6 3.5h12v17l-6-4-6 4v-17Z',
  share: 'M4 12.5v6.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.5M16 7l-4-4-4 4M12 3v13',
  inbox: 'M3 13h5l1.5 3h5l1.5-3h5M5.5 5h13L21 13v6H3v-6l2.5-8Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  cake: 'M4 21h16v-8H4zM4 16c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M12 13V9M12 6.5c.8 0 1.3-.6 1.3-1.3S12 3 12 3s-1.3 1.5-1.3 2.2.5 1.3 1.3 1.3Z',
} as const;

export type IconName = keyof typeof ICONS;

/** Íconos de trazo 24×24. `filled` rellena la forma (p. ej. el corazón activo). */
@Component({
  selector: 'ms-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      class="size-full"
      [attr.fill]="filled() ? 'currentColor' : 'none'"
      stroke="currentColor"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  host: { class: 'inline-block size-5 shrink-0' },
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly filled = input(false);
  readonly stroke = input(1.8);
  protected path() {
    return ICONS[this.name()];
  }
}
