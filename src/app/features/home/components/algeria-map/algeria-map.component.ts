import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WilayaMapService } from '../../../../core/services/wilaya-map.service';
import { WilayaStats, NationalReachSummary } from '../../../../core/models/wilaya-stats.model';
import { ALGERIA_MAP_PATHS, ALGERIA_MAP_VIEWBOX, WilayaMapPath } from '../../../../core/data/algeria-map-paths.data';

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  stats: WilayaStats | null;
  regionName: string;
}

@Component({
  selector: 'app-algeria-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './algeria-map.component.html',
  styleUrl: './algeria-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlgeriaMapComponent implements OnInit {
  private readonly mapService = inject(WilayaMapService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  readonly viewBox = ALGERIA_MAP_VIEWBOX;
  readonly mapPaths: WilayaMapPath[] = ALGERIA_MAP_PATHS;

  // --- Reactive Signals ---
  readonly isLoading = signal<boolean>(false);
  readonly reachSummary = signal<NationalReachSummary | null>(null);
  readonly searchQuery = signal<string>('');
  readonly selectedFilter = signal<'all' | 'clubs' | 'events' | 'open'>('all');

  // Tooltip state
  readonly tooltip = signal<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    stats: null,
    regionName: '',
  });

  // Focused / Keyboard active wilaya
  readonly focusedWilayaCode = signal<string | null>(null);

  // Filtered wilaya list for mobile search & quick navigation
  readonly mobileWilayas = computed(() => {
    const summary = this.reachSummary();
    if (!summary) return [];

    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.selectedFilter();

    // Map 1 to 58 official wilayas (ordered)
    const list: WilayaStats[] = [];
    for (let i = 1; i <= 58; i++) {
      const code = String(i).padStart(2, '0');
      const item = summary.stats[code];
      if (item) {
        list.push(item);
      }
    }

    return list.filter((item) => {
      // Search term filter
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.code.includes(query);

      if (!matchesSearch) return false;

      // Status filter
      if (filter === 'clubs') return item.clubCount > 0;
      if (filter === 'events') return item.eventCount > 0;
      if (filter === 'open') return item.clubCount === 0 && item.eventCount === 0;

      return true;
    });
  });

  ngOnInit(): void {
    if (this.mapService?.getDemoAggregation) {
      this.reachSummary.set(this.mapService.getDemoAggregation());
    }
    this.loadMapData();
  }

  async loadMapData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.mapService.getNationalReach();
      this.reachSummary.set(data);
    } catch (err) {
      console.error('[AlgeriaMapComponent] Error loading reach stats:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  getWilayaStats(code: string): WilayaStats | undefined {
    const summary = this.reachSummary();
    if (!summary) return undefined;
    const formatted = code.padStart(2, '0');
    return summary.stats[formatted];
  }

  getWilayaName(path: WilayaMapPath): string {
    const stats = this.getWilayaStats(path.code);
    return stats?.name || path.name || `Wilaya ${path.code}`;
  }

  hasClub(code: string): boolean {
    const s = this.getWilayaStats(code);
    return !!s && s.clubCount > 0;
  }

  hasEvent(code: string): boolean {
    const s = this.getWilayaStats(code);
    return !!s && s.eventCount > 0;
  }

  hasUpcomingWithin7Days(code: string): boolean {
    const s = this.getWilayaStats(code);
    return !!s && s.hasUpcomingWithin7Days;
  }

  getAriaLabel(path: WilayaMapPath): string {
    const stats = this.getWilayaStats(path.code);
    const name = this.getWilayaName(path);
    if (!stats || (stats.clubCount === 0 && stats.eventCount === 0)) {
      return `${name} wilaya, no clubs yet. Open for first society.`;
    }
    const clubsText = `${stats.clubCount} verified club${stats.clubCount === 1 ? '' : 's'}`;
    const eventsText = `${stats.eventCount} upcoming event${stats.eventCount === 1 ? '' : 's'}`;
    return `${name} wilaya, ${clubsText}, ${eventsText}`;
  }

  // --- Mouse & Tooltip Handlers ---
  onPathMouseEnter(path: WilayaMapPath, event: MouseEvent): void {
    const stats = this.getWilayaStats(path.code) || {
      code: path.code,
      name: this.getWilayaName(path),
      clubCount: 0,
      eventCount: 0,
      hasUpcomingWithin7Days: false,
    };

    this.tooltip.set({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      stats,
      regionName: this.getWilayaName(path),
    });
  }

  onPathMouseMove(event: MouseEvent): void {
    const current = this.tooltip();
    if (current.visible) {
      this.tooltip.set({
        ...current,
        x: event.clientX,
        y: event.clientY,
      });
    }
  }

  onPathMouseLeave(): void {
    const current = this.tooltip();
    if (current.visible) {
      this.tooltip.set({
        ...current,
        visible: false,
      });
    }
  }

  // --- Keyboard & Focus Handlers ---
  onPathFocus(path: WilayaMapPath, event: FocusEvent): void {
    const target = event.target as SVGPathElement;
    const rect = target.getBoundingClientRect();
    const stats = this.getWilayaStats(path.code) || {
      code: path.code,
      name: this.getWilayaName(path),
      clubCount: 0,
      eventCount: 0,
      hasUpcomingWithin7Days: false,
    };

    this.focusedWilayaCode.set(path.code);
    this.tooltip.set({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      stats,
      regionName: this.getWilayaName(path),
    });
  }

  onPathBlur(): void {
    this.focusedWilayaCode.set(null);
    this.tooltip.set({
      visible: false,
      x: 0,
      y: 0,
      stats: null,
      regionName: '',
    });
  }

  // --- Navigation Action ---
  selectWilaya(code: string): void {
    const formatted = code.padStart(2, '0');
    this.router.navigate(['/clubs'], {
      queryParams: { wilaya: formatted },
    });
  }

  setFilter(filter: 'all' | 'clubs' | 'events' | 'open'): void {
    this.selectedFilter.set(filter);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }
}
