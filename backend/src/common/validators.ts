import { registerDecorator, ValidationOptions } from 'class-validator';

/** Nombres y apellidos: letras (con acentos), espacios, apóstrofes y guiones. */
export const NAME_PATTERN = /^[\p{L}][\p{L}\s'-]*$/u;

/** Fecha de nacimiento válida: en formato AAAA-MM-DD, en el pasado y con edad entre 13 y 120 años. */
export function IsBirthDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isBirthDate',
      target: object.constructor,
      propertyName,
      options: { message: 'Fecha de nacimiento inválida: tenés que tener al menos 13 años', ...options },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const date = new Date(`${value}T00:00:00Z`);
          if (Number.isNaN(date.getTime())) return false;
          const now = new Date();
          const age = now.getUTCFullYear() - date.getUTCFullYear() - (now < new Date(Date.UTC(now.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())) ? 1 : 0);
          return age >= 13 && age <= 120;
        },
      },
    });
}
