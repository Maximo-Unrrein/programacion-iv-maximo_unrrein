import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Logo } from '../../shared/logo';
import { AsciiBackground } from '../../shared/space/ascii-background';
import { ThemeToggle } from '../../shared/theme-toggle';

/** Landing de una sola pantalla (sin scroll): ícono al centro sobre la escena three.js. */
@Component({
  selector: 'ms-landing',
  imports: [RouterLink, Logo, AsciiBackground, ThemeToggle],
  templateUrl: './landing.html',
  host: { class: 'fixed inset-0 flex flex-col overflow-hidden overscroll-none' },
})
export class Landing {
  protected readonly auth = inject(AuthService);
}
