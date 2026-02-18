import { Component, Input, Output, EventEmitter, ElementRef, HostListener, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss'
})
export class MultiSelectComponent {
  @Input() options: string[] = [];  // List of strings to select from
  @Input() selected: string[] = []; // Currently selected strings
  @Input() placeholder = 'Select...';

  @Output() selectionChange = new EventEmitter<string[]>();
  @Output() dropdownToggle = new EventEmitter<boolean>();

  dropdownOpen = signal(false);

  constructor(private elementRef: ElementRef) {}

  toggleDropdown(event?: Event) {
    if(event) event.stopPropagation();
    this.dropdownOpen.update(v => !v);
    this.dropdownToggle.emit(this.dropdownOpen());
  }

  showDropdown = computed(() => this.dropdownOpen());

  isSelected(option: string): boolean {
    return this.selected.includes(option);
  }

  getDisplayText(): string {
    if (!this.selected || this.selected.length === 0) {
      return this.placeholder;
    }
    if (this.selected.length === this.options.length) {
      return 'All Selected';
    }
    if (this.selected.length <= 2) {
      return this.selected.join(', ');
    }
    return `${this.selected.length} items selected`;
  }

  onCheckboxChange(option: string, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    
    let newSelection = [...this.selected];
    
    if (isChecked) {
      if (!newSelection.includes(option)) {
        newSelection.push(option);
      }
    } else {
      newSelection = newSelection.filter(item => item !== option);
    }
    
    // Maintain Order based on original Options list
    newSelection.sort((a,b) => this.options.indexOf(a) - this.options.indexOf(b));

    this.selectionChange.emit(newSelection);
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.dropdownOpen.set(false);
    }
  }
}
