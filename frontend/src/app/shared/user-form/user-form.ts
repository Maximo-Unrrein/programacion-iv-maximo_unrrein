import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { shrinkImage } from '../../core/image';
import { validateImage } from '../../core/ui.service';
import { birthDate, errorText, matches, NAME_PATTERN, passwordPolicy, USERNAME_PATTERN } from '../../core/validators';
import { Autosize } from '../directives';
import { Icon } from '../icon';

const BIO_MAX = 280;

/**
 * Formulario de alta de usuario con todas las validaciones y su foto de perfil.
 * Lo usan el registro público y el alta desde el panel de administración (`withRole` agrega la elección de perfil).
 * Emite los datos listos para enviar como multipart.
 */
@Component({
  selector: 'ms-user-form',
  imports: [NgTemplateOutlet, ReactiveFormsModule, Icon, Autosize],
  templateUrl: './user-form.html',
  host: { class: 'block' },
})
export class UserForm {
  /** Muestra los radio buttons para elegir si el usuario es "usuario" o "administrador". */
  readonly withRole = input(false);
  readonly submitLabel = input('Crear cuenta');
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly send = output<FormData>();

  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly localError = signal<string | null>(null);
  protected readonly bioMax = BIO_MAX;

  protected readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40), Validators.pattern(NAME_PATTERN)] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40), Validators.pattern(NAME_PATTERN)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern(USERNAME_PATTERN)],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, passwordPolicy] }),
    passwordConfirm: new FormControl('', { nonNullable: true, validators: [Validators.required, matches('password')] }),
    birthDate: new FormControl('', { nonNullable: true, validators: [Validators.required, birthDate] }),
    bio: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(BIO_MAX)] }),
    role: new FormControl<'user' | 'admin'>('user', { nonNullable: true }),
  });

  protected readonly avatar = signal<File | null>(null);
  protected readonly avatarPreview = signal<string | null>(null);
  protected readonly avatarError = signal<string | null>(null);

  private readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected readonly passwordChecks = computed(() => {
    const value = this.password();
    return [
      { label: '8 caracteres o más', ok: value.length >= 8 },
      { label: 'Una mayúscula', ok: /[A-Z]/.test(value) },
      { label: 'Un número', ok: /\d/.test(value) },
    ];
  });
  protected readonly bioLength = toSignal(this.form.controls.bio.valueChanges, { initialValue: '' });

  /** Fecha máxima del selector: hoy menos 13 años. */
  protected readonly maxBirthDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().slice(0, 10);
  })();

  constructor() {
    // Si cambia la contraseña, se revalida "repetir contraseña"
    this.form.controls.password.valueChanges.subscribe(() =>
      this.form.controls.passwordConfirm.updateValueAndValidity({ emitEvent: false }),
    );
    inject(DestroyRef).onDestroy(() => this.setAvatar(null));
  }

  /** Mensaje de error de un campo, sólo después de tocarlo o de intentar enviar. */
  protected err(control: AbstractControl, patternMessage?: string) {
    if (!(control.touched || this.submitted())) return null;
    return errorText(control, patternMessage);
  }

  protected onAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    const problem = validateImage(file, 3);
    this.avatarError.set(problem);
    if (!problem) this.setAvatar(file);
  }

  protected clearAvatar() {
    this.setAvatar(null);
  }

  protected async submit() {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.localError.set('Revisá los campos marcados en rojo.');
      return;
    }
    this.localError.set(null);
    const { role, ...values } = this.form.getRawValue();
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.append(key, value.trim());
    if (this.withRole()) data.append('role', role);
    const avatar = this.avatar();
    // La foto se achica en el navegador antes de subirla (límite de 4,5 MB del hosting)
    if (avatar) data.append('avatar', await shrinkImage(avatar));
    this.send.emit(data);
  }

  /** Limpia el formulario (después de un alta exitosa desde el panel de admin). */
  reset() {
    this.form.reset();
    this.setAvatar(null);
    this.avatarError.set(null);
    this.submitted.set(false);
    this.localError.set(null);
  }

  private setAvatar(file: File | null) {
    const previous = this.avatarPreview();
    if (previous) URL.revokeObjectURL(previous);
    this.avatar.set(file);
    this.avatarPreview.set(file ? URL.createObjectURL(file) : null);
  }
}
