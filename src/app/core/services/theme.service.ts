import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly currentTheme = signal<ThemeMode>('light');

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nacs-theme') as ThemeMode | null;
      if (saved === 'dark' || saved === 'light') {
        this.currentTheme.set(saved);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.currentTheme.set('dark');
      }
    }

    effect(() => {
      const theme = this.currentTheme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
        try {
          localStorage.setItem('nacs-theme', theme);
        } catch {
          // Ignore storage restrictions if private mode
        }
      }
    });
  }

  toggleTheme(): void {
    this.currentTheme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }

  isDark(): boolean {
    return this.currentTheme() === 'dark';
  }
}
