import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  template: `
    <header class="app-header">
      <div class="logo">
        <h1>Life Value Finance</h1>
      </div>
      <nav>
        <!-- Single View App -->
      </nav>
    </header>
  `,
  styles: [`
    .app-header {
      background: var(--primary-color-dark, #2c3e50);
      color: white;
      padding: var(--spacing-md) var(--spacing-lg);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--shadow-md);

      .logo h1 {
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
      }

      nav {
        display: flex;
        gap: var(--spacing-lg);

        a {
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          font-weight: var(--font-weight-medium);
          transition: color 0.2s;
          font-size: var(--font-size-md);

          &:hover {
            color: white;
          }

          &.active {
            color: var(--warning-color, #fb8c00);
            border-bottom: 2px solid var(--warning-color, #fb8c00);
          }
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {}
