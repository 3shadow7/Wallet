import { Component, Input, Output, EventEmitter, ElementRef, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SingleSelectRegistryService } from 'src/app/services/single-select/single-select-registry.service';

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
  @Input() value = '';
  @Input() placeholder = 'Select...';
  @Input() variant: 'dot' | 'badge' = 'dot';

  @Output() valueChange = new EventEmitter<string>();

  private registry = inject(SingleSelectRegistryService);
  private elementRef = inject(ElementRef);
  private id = crypto.randomUUID(); // unique per instance

  showDropdown = computed(() => this.registry.isOpen(this.id));

  toggleDropdown(event?: Event) {
    if (event) event.stopPropagation();
    if (this.showDropdown()) {
      this.registry.close(this.id);
    } else {
      this.registry.open(this.id, this.elementRef.nativeElement);
    }
  }

  selectOption(option: string, event: Event) {
    event.stopPropagation();
    this.value = option;
    this.valueChange.emit(option);
    this.registry.close(this.id);
  }

  getColor(option: string): string {
    const map: Record<string, string> = {
      // Priority (mapped to theme vars)
      'Must': 'var(--danger-color)',
      'Want': 'var(--success-color)',
      'Emergency': 'var(--text-primary)', // Adapts to theme (Black in light, White in dark)
      'Gift': 'var(--border-focus)', // Purple

      // Type
      'Burn': 'var(--danger-color)',
      'Tax': 'var(--warning-color)',
      'Saving': 'var(--success-color)',

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
