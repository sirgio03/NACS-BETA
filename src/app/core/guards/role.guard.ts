import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Functional RoleGuard: UX Convenience Route Filter
 *
 * NOTE ON SECURITY ARCHITECTURE:
 * This guard is a client-side UX convenience only — it improves user experience
 * by steering users away from pages they cannot use. It is NOT a security boundary.
 * The true security boundary is independently enforced server-side by Firestore
 * Security Rules and Cloud Functions role validations.
 * This guard merely reflects on the client the permissions already enforced server-side.
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If unauthenticated, redirect to login
  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  const expectedRoles = route.data['roles'] as UserRole[] | undefined;
  if (!expectedRoles || expectedRoles.length === 0) {
    return true;
  }

  const currentRole = authService.userRole();

  // Reflect server-side authorization: allow navigation if user role matches permitted roles
  if (expectedRoles.includes(currentRole)) {
    return true;
  }

  // Redirect to unauthorized notice view
  return router.createUrlTree(['/unauthorized'], {
    queryParams: { required: expectedRoles.join(','), current: currentRole },
  });
};
