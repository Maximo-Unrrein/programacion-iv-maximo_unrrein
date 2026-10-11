import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Contraseña: al menos 8 caracteres, una mayúscula y un número. */
export const passwordPolicy: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null; // de "requerido" se encarga Validators.required
  const errors: ValidationErrors = {};
  if (value.length < 8) errors['passwordLength'] = true;
  if (!/[A-Z]/.test(value)) errors['passwordUpper'] = true;
  if (!/\d/.test(value)) errors['passwordNumber'] = true;
  return Object.keys(errors).length ? errors : null;
};

/** El valor debe coincidir con el de otro control del mismo formulario (p. ej. repetir contraseña). */
export function matches(otherName: string): ValidatorFn {
  return (control) => {
    const other = control.parent?.get(otherName);
    if (!other || !control.value) return null;
    return control.value === other.value ? null : { mismatch: true };
  };
}

/** Fecha de nacimiento (AAAA-MM-DD) con edad entre 13 y 120 años. */
export const birthDate: ValidatorFn = (control) => {
  const value = control.value as string;
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { birthDate: true };
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (now < new Date(now.getFullYear(), date.getMonth(), date.getDate())) age--;
  if (age < 13) return { tooYoung: true };
  if (age > 120) return { birthDate: true };
  return null;
};

export const NAME_PATTERN = /^[\p{L}][\p{L}\s'-]*$/u;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

const MESSAGES: Record<string, (e: unknown) => string> = {
  required: () => 'Este campo es obligatorio',
  email: () => 'Ingresá un correo válido',
  minlength: (e) => `Debe tener al menos ${(e as { requiredLength: number }).requiredLength} caracteres`,
  maxlength: (e) => `Puede tener hasta ${(e as { requiredLength: number }).requiredLength} caracteres`,
  passwordLength: () => 'Al menos 8 caracteres',
  passwordUpper: () => 'Al menos una mayúscula',
  passwordNumber: () => 'Al menos un número',
  mismatch: () => 'Las contraseñas no coinciden',
  tooYoung: () => 'Tenés que tener al menos 13 años',
  birthDate: () => 'Fecha de nacimiento inválida',
};

/** Primer mensaje de error legible de un control (o null si es válido). */
export function errorText(control: AbstractControl | null, patternMessage = 'Formato inválido'): string | null {
  if (!control?.errors) return null;
  const [key, value] = Object.entries(control.errors)[0];
  if (key === 'pattern') return patternMessage;
  return MESSAGES[key]?.(value) ?? 'Valor inválido';
}
