import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SliderRange {
  min: number;
  max: number;
}

@Component({
  selector: 'app-month-slider',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './month-slider.component.html',
  styleUrl: './month-slider.component.scss'
})
export class MonthSliderComponent implements OnDestroy {
  @Input() min = 1;
  @Input() max = 12;
  
  // Internal state
  currentMin = signal(1);
  currentMax = signal(12);

  @Output() rangeChange = new EventEmitter<SliderRange>();

  @ViewChild('container') container!: ElementRef;

  // Computed Styles
  leftPercent = computed(() => this.toPercent(this.currentMin()));
  rightPercent = computed(() => this.toPercent(this.currentMax()));
  widthPercent = computed(() => this.rightPercent() - this.leftPercent());

  monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  private isDragging = false; 
  // We need to store global event listeners to remove them later
  private mouseMoveListener: ((e: MouseEvent) => void) | null = null;
  private mouseUpListener: (() => void) | null = null;

  private lastEmittedMin = -1;
  private lastEmittedMax = -1;
  
  constructor() {}

  ngOnInit() {
      // Initialize last emitted values
      this.lastEmittedMin = this.min;
      this.lastEmittedMax = this.max;
  }

  ngOnDestroy() {
    this.removeListeners();
  }

  // --- Helpers ---
  
  toPercent(val: number): number {
    return ((val - this.min) / (this.max - this.min)) * 100;
  }
  
  fromPercent(percent: number): number {
      const raw = this.min + (percent * (this.max - this.min));
      return Math.round(raw);
  }

  getMonthName(val: number): string {
    return this.fullMonths[Math.max(0, Math.min(11, val - 1))];
  }

  // --- Interaction ---

  onContainerClick(event: MouseEvent | TouchEvent) {
      // 1. If this is a TouchEvent, prevent default immediately to stop mouse emulation
      if (window.TouchEvent && event instanceof TouchEvent) {
          if (event.cancelable) event.preventDefault();
      }

      // 2. Ignore non-primary mouse events on touch devices (Edge case: ghost clicks if preventDefault didn't work)
      // If we are on a touch device and receive a mousedown without a preceding touch, it might be fine (e.g. mouse connected)
      // But if we just handled a touch, we shouldn't handle a mouse event.
      // Easiest check: if coarse pointer capability is present, prefer touch.
      if (event.type === 'mousedown' && window.matchMedia('(pointer: coarse)').matches) {
           // We might be cautious here. If the user REALLY used a mouse on a tablet, this might block it.
           // However, for this slider, blocking standard mousedown on "coarse" devices is usually safe to prevent double-firing.
           return;
      }

      const target = event.target as HTMLElement;
      if (target.classList.contains('handle')) return;
      
      const val = this.getValueFromEvent(event);
      
      const currentMin = this.currentMin();
      const currentMax = this.currentMax();
      const distMin = Math.abs(val - currentMin);
      const distMax = Math.abs(val - currentMax);
      
      let handleToActivate: 'min' | 'max';
      if (distMin < distMax) {
          handleToActivate = 'min';
      } else {
          handleToActivate = 'max';
      }

      this.jumpTo(val);
      this.startDrag(handleToActivate, event);
  }

  jumpTo(val: number) {
      const currentMin = this.currentMin();
      const currentMax = this.currentMax();
      
      const distMin = Math.abs(val - currentMin);
      const distMax = Math.abs(val - currentMax);

      if (distMin < distMax) {
          // Closer to min
          if (val > currentMax) {
               // If jumping past max, push max just a bit or stop at max? 
               // Standard logic: if clicking past max, we usually move the closest handle (max) unless we determine logic otherwise.
               // But here, we chose Min as closest. If val > Max, then distMax would have been smaller.
               // So this case (val > Max && distMin < distMax) is impossible mathematically 
               // unless val acts weird.
               this.currentMin.set(Math.min(val, currentMax));
          } else {
               this.currentMin.set(val);
          }
      } else {
          // Closer to max
          if (val < currentMin) {
               this.currentMax.set(Math.max(val, currentMin));
          } else {
               this.currentMax.set(val);
          }
      }
      this.emitChange();
  }

  startDrag(handle: 'min' | 'max', event: MouseEvent | TouchEvent) {
      event.preventDefault();
      event.stopPropagation();
      this.isDragging = true;
      
      let activeHandle = handle;

      this.mouseMoveListener = (e: MouseEvent | TouchEvent) => {
          e.preventDefault(); // Prevent scrolling on touch
          const val = this.getValueFromEvent(e);
          const currentMin = this.currentMin();
          const currentMax = this.currentMax();
          
          if (activeHandle === 'min') {
              if (val > currentMax) {
                  // Swap roles
                  this.currentMin.set(currentMax);
                  this.currentMax.set(val);
                  activeHandle = 'max';
              } else {
                  this.currentMin.set(val);
              }
          } else {
              if (val < currentMin) {
                  // Swap roles
                  this.currentMax.set(currentMin);
                  this.currentMin.set(val);
                  activeHandle = 'min';
              } else {
                  this.currentMax.set(val);
              }
          }
          this.emitChange(); // Real-time feedback
      };

      this.mouseUpListener = () => {
          this.isDragging = false;
          this.removeListeners();
          this.emitChange(); // Final commit
      };

      // Mouse events
      document.addEventListener('mousemove', this.mouseMoveListener as EventListener);
      document.addEventListener('mouseup', this.mouseUpListener);
      
      // Touch events
      document.addEventListener('touchmove', this.mouseMoveListener as EventListener, { passive: false });
      document.addEventListener('touchend', this.mouseUpListener);
      document.addEventListener('touchcancel', this.mouseUpListener);
  }

  private getValueFromEvent(event: MouseEvent | TouchEvent): number {
      if (!this.container) return 1;
      
      let clientX;
      if (window.TouchEvent && event instanceof TouchEvent) {
          clientX = event.touches[0].clientX;
      } else {
          clientX = (event as MouseEvent).clientX;
      }

      const rect = this.container.nativeElement.getBoundingClientRect();
      // Handle edge cases where touch is outside element bounds
      const x = clientX - rect.left;
      const width = rect.width;
      
      const percent = Math.max(0, Math.min(1, x / width));
      // Map percent to 1-12 range
      // We want distinct steps
      const raw = this.min + (percent * (this.max - this.min));
      return Math.round(raw);
  }

  private removeListeners() {
      if (this.mouseMoveListener) {
          document.removeEventListener('mousemove', this.mouseMoveListener as EventListener);
          document.removeEventListener('touchmove', this.mouseMoveListener as EventListener);
      }
      if (this.mouseUpListener) {
          document.removeEventListener('mouseup', this.mouseUpListener);
          document.removeEventListener('touchend', this.mouseUpListener);
          document.removeEventListener('touchcancel', this.mouseUpListener);
      }
  }

  private emitChange() {
      const min = this.currentMin();
      const max = this.currentMax();
      
      if (min !== this.lastEmittedMin || max !== this.lastEmittedMax) {
          this.lastEmittedMin = min;
          this.lastEmittedMax = max;
          this.rangeChange.emit({ min, max });
      }
  }
}
