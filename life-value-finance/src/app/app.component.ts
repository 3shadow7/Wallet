import { Component, ChangeDetectionStrategy, ViewEncapsulation, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {
  title = 'life-value-finance';
  private router = inject(Router);

  showHeader(): boolean {
    const url = this.router.url;
    return !url.includes('/login') && !url.includes('/register');
  }
}
