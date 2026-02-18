import { Component, Input, Output, EventEmitter, ElementRef, HostListener, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-single-select',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './single-select.component.html',
  styleUrl: './single-select.component.scss' // We will reuse the SCSS structure or copy it
})
export class SingleSelectComponent {
  @Input() options: string[] = [];
  @Input() value: string = '';
  @Input() placeholder = 'Select...';
  @Input() variant: 'dot' | 'badge' = 'dot'; // New input for variant style

  @Output() valueChange = new EventEmitter<string>();

  dropdownOpen = signal(false);

  constructor(private elementRef: ElementRef) {}

  toggleDropdown(event?: Event) {
    if(event) event.stopPropagation();
    this.dropdownOpen.update(v => !v);
  }

  showDropdown = computed(() => this.dropdownOpen());

  selectOption(option: string, event: Event) {
    event.stopPropagation();
    this.value = option;
    this.valueChange.emit(option);
    this.dropdownOpen.set(false); // Auto-close on single select
  }

  // Close when clicking outside
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.dropdownOpen.set(false);
    }
  }

  getColor(option: string): string {
    const map: Record<string, string> = {
      // Priority (mapped to theme vars)
      'Must Have': 'var(--danger-color)', 
      'Need': 'var(--warning-color)',
      'Want': 'var(--success-color)',
      'Emergency': 'var(--text-primary)', // Adapts to theme (Black in light, White in dark)
      'Gift': 'var(--border-focus)', // Purple
      
      // Type
      'Variable': 'var(--danger-color)',
      'Fixed': 'var(--warning-color)',
      'Savings': 'var(--success-color)',

      // Fallback
      'High': 'var(--danger-color)',
      'Medium': 'var(--warning-color)',
      'Low': 'var(--success-color)'
    };
    return map[option] || 'transparent';
  }

  getBadgeColor(option: string): string {
    // For text color on badge, we usually want the strong color
    return this.getColor(option);
  }

  getBadgeBg(option: string): string {
    const colorVar = this.getColor(option);
    if (colorVar === 'transparent') return 'var(--bg-input)';
    
    // Use color-mix for automatic light/dark background handling
    // 10% opacity of the color on top of surface
    return `color-mix(in srgb, ${colorVar}, transparent 85%)`;
  }
}
