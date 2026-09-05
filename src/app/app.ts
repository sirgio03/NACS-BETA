import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { environment } from '../environments/environment';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, UpperCasePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly authService = inject(AuthService);
  readonly title = signal('National Association of Campus Societies');
  readonly currentEnv = signal(environment.environmentName);
  readonly isProd = signal(environment.production);

  async onSignOut(): Promise<void> {
    await this.authService.signOut();
  }
}
