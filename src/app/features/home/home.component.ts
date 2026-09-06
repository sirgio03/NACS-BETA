import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  /**
   * Reactive signal tracking the currently expanded FAQ item ID.
   * Defaults to null (all collapsed).
   */
  readonly expandedFaqId = signal<string | null>(null);

  /**
   * Institutional FAQ items based on the official NACS charter and platform capabilities.
   */
  readonly faqs: readonly FaqItem[] = [
    {
      id: 'faq-1',
      question: 'What exactly does NACS provide?',
      answer:
        'NACS offers an official accreditation system, a national events calendar with automatic conflict detection, a verified club directory spanning all 58 wilayas, and a permanent project showcase.',
    },
    {
      id: 'faq-2',
      question: 'How does the conflict detection work?',
      answer:
        'When a club schedules an event, our automated engine scans the national database. If another major event is scheduled in the same wilaya or category on the same dates, the system flags the overlap to prevent cannibalizing attendees and sponsors.',
    },
    {
      id: 'faq-3',
      question: 'Is my personal data safe?',
      answer:
        'Yes. We enforce strict privacy invariants. Public directories only display leadership roles and names. Personal contact information and administrative IDs are mathematically shielded from public API requests.',
    },
    {
      id: 'faq-4',
      question: 'How does a club join?',
      answer:
        'Club leads can apply through our portal by submitting their university endorsement and club mandate. Once verified by the Federation Board, they can create an account to gain full access to the operational workspace.',
    },
  ];

  /**
   * Toggles the open/collapsed state of a given FAQ item.
   */
  toggleFaq(id: string): void {
    this.expandedFaqId.update((currentId) => (currentId === id ? null : id));
  }
}

