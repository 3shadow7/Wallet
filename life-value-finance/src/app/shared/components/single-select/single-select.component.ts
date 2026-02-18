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
      // Priority
      'Must Have': '#ef4444', 
      'Need': '#f59e0b',
      'Want': '#10b981',
      'Emergency': '#000000', // Black
      'Gift': '#8b5cf6',
      
      // Type (Updated as requested)
      'Variable': '#ef4444', // Red
      'Fixed': '#f59e0b',    // Warning (Orange/Amber)
      'Savings': '#10b981',  // Green

      // Fallback
      'High': '#ef4444',
      'Medium': '#f59e0b',
      'Low': '#10b981'
    };
    return map[option] || 'transparent';
  }

  getBadgeColor(option: string): string {
    return this.getColor(option);
  }

  getBadgeBg(option: string): string {
    const color = this.getColor(option);
    // Rough mapping of color -> background
    const bgMap: Record<string, string> = {
      '#ef4444': '#fee2e2', // Red 100
      '#f59e0b': '#fef3c7', // Amber 100
      '#10b981': '#d1fae5', // Emerald 100
      '#7f1d1d': '#fecaca',
      '#8b5cf6': '#ede9fe',
      '#3b82f6': '#dbeafe',
      '#000000': '#e5e7eb', // Black -> Gray 200
    };
    return bgMap[color] || '#f3f4f6';
  }
}
