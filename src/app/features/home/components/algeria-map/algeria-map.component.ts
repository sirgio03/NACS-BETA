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
import {
  ALGERIA_MAP_PATHS,
  ALGERIA_MAP_VIEWBOX,
  ALGERIA_MAP_NORTH_VIEWBOX,
  WilayaMapPath,
} from '../../../../core/data/algeria-map-paths.data';

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  flipped?: boolean;
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

  readonly fullViewBox = ALGERIA_MAP_VIEWBOX;
  readonly northViewBox = ALGERIA_MAP_NORTH_VIEWBOX;
  readonly mapPaths: WilayaMapPath[] = ALGERIA_MAP_PATHS;

  // --- Zoom & Camera State ---
  readonly viewMode = signal<'full' | 'north'>('full');
  readonly currentViewBox = signal<string>(ALGERIA_MAP_VIEWBOX);
  readonly isSwooping = signal<boolean>(false);
  readonly swoopDirection = signal<'in' | 'out' | null>(null);

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

  private calculateTooltipPosition(clientX: number, clientY: number): { x: number; y: number; flipped: boolean } {
    const tooltipWidth = 270;
    const tooltipHeight = 170;
    const padding = 16;
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

    // Clamp horizontally so tooltip never overflows the viewport
    const minX = tooltipWidth / 2 + padding;
    const maxX = Math.max(minX, winWidth - tooltipWidth / 2 - padding);
    const clampedX = Math.max(minX, Math.min(clientX, maxX));

    // Flip vertically if close to the top of viewport (prevents clipping)
    const flipped = clientY < tooltipHeight + 40;
    const y = flipped ? clientY + 20 : clientY - 12;

    return { x: clampedX, y, flipped };
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

    const pos = this.calculateTooltipPosition(event.clientX, event.clientY);
    this.tooltip.set({
      visible: true,
      x: pos.x,
      y: pos.y,
      flipped: pos.flipped,
      stats,
      regionName: this.getWilayaName(path),
    });
  }

  onPathMouseMove(event: MouseEvent): void {
    const current = this.tooltip();
    if (current.visible) {
      const pos = this.calculateTooltipPosition(event.clientX, event.clientY);
      this.tooltip.set({
        ...current,
        x: pos.x,
        y: pos.y,
        flipped: pos.flipped,
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

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top;
    const pos = this.calculateTooltipPosition(centerX, centerY);

    this.focusedWilayaCode.set(path.code);
    this.tooltip.set({
      visible: true,
      x: pos.x,
      y: pos.y,
      flipped: pos.flipped,
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
      flipped: false,
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

  // --- Zoom & Smooth GPU Camera Transition ---
  toggleViewMode(): void {
    const nextMode = this.viewMode() === 'full' ? 'north' : 'full';
    const targetBoxStr = nextMode === 'north' ? this.northViewBox : this.fullViewBox;

    this.viewMode.set(nextMode);
    this.currentViewBox.set(targetBoxStr);
  }
}

