import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

describe('Guards', () => {
  let mockAuthService: any;
  let router: Router;

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: signal(false),
      userRole: signal('visitor'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: Router,
          useValue: {
            createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((path: any[], queryParams?: any) => ({
              path,
              queryParams,
            })),
          },
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('allows access when user is authenticated', () => {
      mockAuthService.isAuthenticated.set(true);
      const route = {} as ActivatedRouteSnapshot;
      const state = { url: '/protected' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => authGuard(route, state));
      expect(result).toBeTrue();
    });

    it('redirects to /auth/login when unauthenticated', () => {
      mockAuthService.isAuthenticated.set(false);
      const route = {} as ActivatedRouteSnapshot;
      const state = { url: '/protected' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => authGuard(route, state));
      expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/protected' },
      });
      expect(result).toEqual(jasmine.any(Object));
    });
  });

  describe('roleGuard (UX convenience reflecting server permissions)', () => {
    it('redirects unauthenticated users to /auth/login', () => {
      mockAuthService.isAuthenticated.set(false);
      const route = { data: { roles: ['board', 'admin'] } } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/admin' },
      });
      expect(result).toEqual(jasmine.any(Object));
    });

    it('allows access when user role satisfies expected roles', () => {
      mockAuthService.isAuthenticated.set(true);
      mockAuthService.userRole.set('admin');

      const route = { data: { roles: ['board', 'admin'] } } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      expect(result).toBeTrue();
    });

    it('redirects to /unauthorized when user role does not match expected roles', () => {
      mockAuthService.isAuthenticated.set(true);
      mockAuthService.userRole.set('visitor');

      const route = { data: { roles: ['board', 'admin'] } } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      expect(router.createUrlTree).toHaveBeenCalledWith(['/unauthorized'], {
        queryParams: { required: 'board,admin', current: 'visitor' },
      });
      expect(result).toEqual(jasmine.any(Object));
    });
  });
});
