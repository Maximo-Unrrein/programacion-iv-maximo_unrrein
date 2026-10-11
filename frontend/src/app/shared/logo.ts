import { Component, input } from '@angular/core';

let uid = 0;

/**
 * Isotipo MaxSend en SVG. El trazo interior se recorta (evenodd), así funciona sobre cualquier fondo.
 * El degradado metálico toma sus colores del tema (--logo-1/2/3): blanco → lunar → metálico en oscuro.
 */
@Component({
  selector: 'ms-logo',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="130 70 1145 1000" role="img" aria-label="MaxSend">
      <defs>
        <linearGradient [attr.id]="gradId" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" style="stop-color: var(--logo-1, #ffffff)" />
          <stop offset="0.55" style="stop-color: var(--logo-2, #d9dee7)" />
          <stop offset="1" style="stop-color: var(--logo-3, #8993a3)" />
        </linearGradient>
      </defs>
      <path
        [attr.fill]="variant() === 'gradient' ? 'url(#' + gradId + ')' : 'currentColor'"
        fill-rule="evenodd"
        d="M668 118H735Q780 118 805 155L960 412Q990 465 960 520L865 612Q850 630 862 645Q875 657 890 652L990 625Q1065 610 1110 665L1250 868Q1272 905 1250 940L1205 1003Q1190 1025 1160 1025H855Q775 1025 745 940L722 876Q712 860 700 860Q688 860 680 876L655 940Q625 1025 545 1025H238Q210 1025 192 1003L148 935Q128 905 148 870L290 665Q335 610 410 625L515 652Q532 656 541 640Q548 624 535 612L445 520Q410 470 440 412L595 155Q620 118 668 118ZM677 280A23.5 23.5 0 0 1 724 280V550Q726 680 830 750L1100 897A21 21 0 0 1 1085 935L800 790Q700 745 600 790L315 935A21 21 0 0 1 300 897L570 750Q674 680 677 550Z"
      />
    </svg>
  `,
  host: { style: 'display:inline-flex' },
})
export class Logo {
  readonly size = input<number | string>(40);
  readonly variant = input<'gradient' | 'mono'>('gradient');
  protected readonly gradId = `ms-grad-${uid++}`;
}
