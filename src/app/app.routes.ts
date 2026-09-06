import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'home',
    redirectTo: '',
  },
  {
    path: 'clubs',
    loadComponent: () => import('./features/clubs/club-list.component').then((m) => m.ClubListComponent),
  },
  {
    path: 'clubs/:id',
    loadComponent: () => import('./features/clubs/club-detail.component').then((m) => m.ClubDetailComponent),
  },
  {
    path: 'showcase',
    loadComponent: () =>
      import('./features/showcase/showcase-gallery.component').then((m) => m.ShowcaseGalleryComponent),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./features/calendar/calendar-view.component').then((m) => m.CalendarViewComponent),
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/register',
    redirectTo: 'auth/login',
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./features/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },
  // Protected Route: Board / Admin Portal (UX convenience guard reflecting server-side rules)
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['board', 'admin'] },
    loadComponent: () =>
      import('./features/admin/application-review.component').then((m) => m.ApplicationReviewComponent),
  },
  {
    path: 'admin/applications',
    redirectTo: 'admin',
  },
  // Protected Route: Club Lead Workspace (UX convenience guard reflecting server-side rules)
  {
    path: 'lead',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['club_lead'] },
    loadComponent: () =>
      import('./features/lead/lead-dashboard.component').then((m) => m.LeadDashboardComponent),
  },
  {
    path: 'lead/dashboard',
    redirectTo: 'lead',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
