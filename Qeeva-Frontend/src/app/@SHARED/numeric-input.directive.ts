import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: 'input[appNumericInput]',
  standalone: true
})
export class NumericInputDirective {
  private el = inject(ElementRef);
  private control = inject(NgControl, { optional: true });

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement as HTMLInputElement;
    const value = input.value;

    // Remove non-numeric characters except dot and minus (if applicable, but expenses usually positive)
    // Here we allow positive decimals
    const sanitized = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple dots
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      input.value = parts[0] + '.' + parts.slice(1).join('');
    } else {
      input.value = sanitized;
    }

    // Update control if bound
    if (this.control && this.control.control) {
        this.control.control.setValue(input.value, { emitEvent: false });
    }
  }
}
