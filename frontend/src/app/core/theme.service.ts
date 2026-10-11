import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
const STORAGE_KEY = 'maxsend-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initial());

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset['theme'] = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'dark' ? '#111317' : '#DCE0E7');
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {}
    });
  }

  toggle() {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private initial(): Theme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark'; // El tema principal es el oscuro
  }
}
