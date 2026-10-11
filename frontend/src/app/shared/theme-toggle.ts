import { Component, inject } from '@angular/core';
import { ThemeService } from '../core/theme.service';
import { Icon } from './icon';

@Component({
  selector: 'ms-theme-toggle',
  imports: [Icon],
  template: `
    <button
      type="button"
      class="icon-btn"
      (click)="theme.toggle()"
      [attr.aria-label]="theme.theme() === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
      [title]="theme.theme() === 'dark' ? 'Tema claro' : 'Tema oscuro'"
    >
      <ms-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" class="size-[22px] transition-transform duration-500 hover:rotate-45" />
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
}
