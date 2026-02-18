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

  onContainerClick(event: MouseEvent) {
      if ((event.target as HTMLElement).classList.contains('handle')) return; // Ignore handle clicks (handled by mousedown)
      
      const val = this.getValueFromEvent(event);
      this.jumpTo(val, event);
  }

  jumpTo(val: number, event?: Event) {
      if(event) event.stopPropagation();

      const distMin = Math.abs(val - this.currentMin());
      const distMax = Math.abs(val - this.currentMax());

      if (distMin < distMax) {
          this.currentMin.set(Math.min(val, this.currentMax())); // Ensure min <= max
      } else {
          this.currentMax.set(Math.max(val, this.currentMin())); // Ensure max >= min
      }
      this.emitChange();
  }

  startDrag(handle: 'min' | 'max', event: MouseEvent) {
      event.preventDefault();
      event.stopPropagation();
      this.isDragging = true;
      
      // Track which handle is currently active to allow swapping
      let activeHandle = handle;

      this.mouseMoveListener = (e: MouseEvent) => {
          const val = this.getValueFromEvent(e);
          
          if (activeHandle === 'min') {
              const currentMaxValue = this.currentMax();
              if (val > currentMaxValue) {
                  // Swap roles: Min becomes Max
                  this.currentMin.set(currentMaxValue);
                  this.currentMax.set(val);
                  activeHandle = 'max';
              } else {
                  this.currentMin.set(val);
              }
          } else {
              const currentMinValue = this.currentMin();
              if (val < currentMinValue) {
                  // Swap roles: Max becomes Min
                  this.currentMax.set(currentMinValue);
                  this.currentMin.set(val);
                  activeHandle = 'min';
              } else {
                  this.currentMax.set(val);
              }
          }
          this.emitChange(); 
      };

      this.mouseUpListener = () => {
          this.isDragging = false;
          this.removeListeners();
          this.emitChange();
      };

      document.addEventListener('mousemove', this.mouseMoveListener);
      document.addEventListener('mouseup', this.mouseUpListener);
  }

  private getValueFromEvent(event: MouseEvent): number {
      if (!this.container) return 1;
      const rect = this.container.nativeElement.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const width = rect.width;
      const percent = Math.max(0, Math.min(1, clickX / width));
      return Math.max(this.min, Math.min(this.max, this.fromPercent(percent)));
  }

  private removeListeners() {
      if (this.mouseMoveListener) document.removeEventListener('mousemove', this.mouseMoveListener);
      if (this.mouseUpListener) document.removeEventListener('mouseup', this.mouseUpListener);
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
