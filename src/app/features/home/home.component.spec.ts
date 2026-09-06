import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the HomeComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should render the exact Hero headline and sub-headline', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const headline = compiled.querySelector('#hero-headline');
    expect(headline?.textContent?.trim()).toBe(
      'The Digital Backbone of Algerian Student Tech Societies.'
    );

    const subheadline = compiled.querySelector('.hero-subheadline');
    expect(subheadline?.textContent?.trim()).toBe(
      'A unified digital infrastructure connecting, verifying, and empowering scientific clubs, GDG Chapters, and tech communities across all 58 Wilayas.'
    );
  });

  it('should render the primary and secondary CTA links', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const primaryCta = compiled.querySelector('.cta-btn-primary');
    const secondaryCta = compiled.querySelector('.cta-btn-secondary');

    expect(primaryCta?.textContent?.trim()).toBe('Explore the Directory');
    expect(primaryCta?.getAttribute('href') || primaryCta?.getAttribute('ng-reflect-router-link')).toContain('clubs');

    expect(secondaryCta?.textContent?.trim()).toBe('Create an Account to Join');
    expect(secondaryCta?.getAttribute('href') || secondaryCta?.getAttribute('ng-reflect-router-link')).toContain('auth/register');
  });

  it('should render the "How It Started" origin section with exact text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const originHeading = compiled.querySelector('#origin-heading');
    expect(originHeading?.textContent?.trim()).toBe('How It Started');

    const originSection = compiled.querySelector('.origin-section .section-body');
    expect(originSection?.textContent?.trim()).toContain(
      'What began as a localized initiative within a Google Developer Group (GDG)'
    );
  });

  it('should render the "Who We Are" and "Why We Are Here" mandate cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const identityHeading = compiled.querySelector('#identity-heading');
    const missionHeading = compiled.querySelector('#mission-heading');

    expect(identityHeading?.textContent?.trim()).toBe('Who We Are');
    expect(missionHeading?.textContent?.trim()).toBe('Why We Are Here');

    const cards = compiled.querySelectorAll('.mandate-card .section-body');
    expect(cards[0]?.textContent?.trim()).toContain(
      'We are the definitive federation for Algerian university tech clubs'
    );
    expect(cards[1]?.textContent?.trim()).toContain(
      'For too long, the Algerian student tech ecosystem has been completely fragmented.'
    );
  });

  it('should toggle FAQ accordion items via signals', () => {
    expect(component.expandedFaqId()).toBeNull();

    component.toggleFaq('faq-1');
    expect(component.expandedFaqId()).toBe('faq-1');

    // Toggling the same item collapses it
    component.toggleFaq('faq-1');
    expect(component.expandedFaqId()).toBeNull();

    // Toggling another item switches to it
    component.toggleFaq('faq-2');
    expect(component.expandedFaqId()).toBe('faq-2');
  });
});
