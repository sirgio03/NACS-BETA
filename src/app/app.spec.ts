import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { AuthService } from './core/services/auth.service';

describe('App', () => {
  const mockAuthService = {
    currentUser: signal(null),
    userProfile: signal(null),
    loading: signal(false),
    isAuthenticated: signal(false),
    userRole: signal('visitor'),
    isClubLead: signal(false),
    isBoard: signal(false),
    isAdmin: signal(false),
    isBoardOrAdmin: signal(false),
    signOut: jasmine.createSpy('signOut').and.returnValue(Promise.resolve()),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the NACS brand in header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain(
      'National Association of Campus Societies'
    );
  });
});
