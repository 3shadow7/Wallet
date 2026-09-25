import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatCurrency',
  standalone: true
})
export class FormatCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, currencyCode = 'USD'): string {
    if (value == null || isNaN(value)) {
      return '--';
    }
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch (e) {
      console.warn('Currency formatting failed', e);
      return String(value);
    }
  }
}
