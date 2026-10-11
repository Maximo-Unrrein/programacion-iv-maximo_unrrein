import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorText, passwordPolicy } from '../../core/validators';
import { Icon } from '../../shared/icon';
import { Logo } from '../../shared/logo';
import { AsciiBackground } from '../../shared/space/ascii-background';
import { ThemeToggle } from '../../shared/theme-toggle';
import { UserForm } from '../../shared/user-form/user-form';

type Mode = 'login' | 'registro';

@Component({
  selector: 'ms-auth',
  imports: [NgTemplateOutlet, ReactiveFormsModule, RouterLink, Logo, Icon, AsciiBackground, ThemeToggle, UserForm],
  templateUrl: './auth.html',
  host: { class: 'flex min-h-dvh flex-col' },
})
export class Auth {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query param ?modo=registro */
  readonly modo = input<string>();
  /** Query param ?sesion=expirada (cuando vence el token o el servidor lo rechaza) */
  readonly sesion = input<string>();
  protected readonly mode = linkedSignal<Mode>(() => (this.modo() === 'registro' ? 'registro' : 'login'));

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);

  /** Login por correo o nombre de usuario; la contraseña debe cumplir la política (8+, mayúscula y número). */
  protected readonly loginForm = new FormGroup({
    user: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, passwordPolicy] }),
  });

  protected setMode(mode: Mode) {
    this.mode.set(mode);
    this.error.set(null);
    this.submitted.set(false);
  }

  /** Mensaje de error de un campo, sólo después de tocarlo o de intentar enviar. */
  protected err(control: AbstractControl) {
    if (!(control.touched || this.submitted())) return null;
    return errorText(control);
  }

  protected async submitLogin() {
    this.submitted.set(true);
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) return;
    const { user, password } = this.loginForm.getRawValue();
    await this.run(() => this.auth.login(user.trim(), password));
  }

  /** Recibe los datos validados del formulario de registro (multipart con la foto). */
  protected async register(data: FormData) {
    await this.run(() => this.auth.register(data));
  }

  private async run(action: () => Promise<void>) {
    this.error.set(null);
    this.loading.set(true);
    try {
      await action();
      await this.router.navigateByUrl('/feed');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Ocurrió un error inesperado');
    } finally {
      this.loading.set(false);
    }
  }
}
