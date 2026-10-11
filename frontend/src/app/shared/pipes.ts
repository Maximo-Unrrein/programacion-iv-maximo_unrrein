import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

/** Convierte `/uploads/...` en una URL absoluta hacia el backend. */
@Pipe({ name: 'media' })
export class MediaPipe implements PipeTransform {
  transform(url: string | null | undefined): string | null {
    if (!url) return null;
    return url.startsWith('/') ? environment.mediaUrl + url : url;
  }
}

/** Edad en años a partir de una fecha de nacimiento. */
@Pipe({ name: 'age' })
export class AgePipe implements PipeTransform {
  transform(birthDate: string | Date | null | undefined): number | null {
    if (!birthDate) return null;
    const date = new Date(birthDate);
    if (Number.isNaN(date.getTime())) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - date.getUTCFullYear();
    if (now < new Date(Date.UTC(now.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))) age--;
    return age;
  }
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto', style: 'short' });
const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** "hace 5 min", "ayer", o la fecha corta si pasó más de una semana. */
@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    const seconds = (date.getTime() - Date.now()) / 1000;
    if (Math.abs(seconds) < 60) return 'ahora';
    if (Math.abs(seconds) > 7 * 86400) return dateFmt.format(date);
    for (const [unit, size] of UNITS) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return 'ahora';
  }
}
