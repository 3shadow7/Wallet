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
  @Input() variant: 'dot' | 'badge' = 'dot';

  @Output() selectionChange = new EventEmitter<string[]>();
  @Output() dropdownToggle = new EventEmitter<boolean>();

  dropdownOpen = signal(false);

  constructor(private elementRef: ElementRef) {}

  getBadgeStyle(option: string): Record<string, string> {
     // Check dark mode
     let isDark = false;
     if (typeof document !== 'undefined') {
         isDark = document.body.classList.contains('dark-theme') || 
                  document.documentElement.getAttribute('data-theme') === 'dark';
     }

     const styleMap: Record<string, any> = {
         'Burning': { 
             bg:'color-mix(in srgb, var(--danger-color), transparent 85%)', 
             color: 'var(--danger-color)', 
             border: 'var(--danger-color)' 
         },
         'Responsibility': { 
             bg:'color-mix(in srgb, var(--warning-color), transparent 85%)', 
             color: 'var(--warning-color)', 
             border: 'var(--warning-color)' 
         },
         'Saving': { 
             bg:'color-mix(in srgb, var(--success-color), transparent 85%)', 
             color: 'var(--success-color)', 
             border: 'var(--success-color)' 
         }
     };

     const style = styleMap[option];
     if (style) {
         return {
             'background-color': style.bg,
             'color': style.color,
             'border': `1px solid ${style.border}`,
             'padding': '0.125rem 0.625rem',
             'border-radius': '0.75rem',
             'border-width': '0.0625rem',
             'font-size': '0.85rem',
             'font-weight': '600',
             'line-height': 'normal',
             'display': 'inline-block'
         };
     }
     
     return {};
  }

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

  getColor(option: string): string {
    const map: Record<string, string> = {
      // Priority (mapped to theme vars)
      'Must Have': 'var(--danger-color)', 
      'Want': 'var(--success-color)',
      'Emergency': 'var(--text-primary)', // Black in Light, White in Dark
      'Gift': 'var(--border-focus)', // Purple
      
      // Type
      'Burning': 'var(--danger-color)',
      'Responsibility': 'var(--warning-color)',
      'Saving': 'var(--success-color)',
      
      // Fallback
      'High': 'var(--danger-color)',
      'Medium': 'var(--warning-color)',
      'Low': 'var(--success-color)'
    };
    return map[option] || 'transparent';
  }
}
