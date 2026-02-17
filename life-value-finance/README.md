# Life Value Finance — Personal Decision Intelligence Tool

## Overview
Life Value Finance is a privacy-first, offline-capable personal financial planning application built with modern web technologies. Unlike traditional budgeting apps that focus solely on currency, this tool emphasizes "Life Value" by converting financial costs into time-cost equivalents—helping users understand the true cost of their spending in terms of their life energy.

## Features
- **Time-Value Calculation**: Instantly convert item prices into "hours of life" based on your hourly rate.
- **Privacy First**: Zero data collection. All data is persisted locally in your browser using IndexedDB/localStorage.
- **Reactive Financial Engine**: Real-time updates as you adjust income and expenses, powered by Angular Signals.
- **Advanced Budget Grid**: High-performance data grid (AG Grid) for managing line items with sorting, filtering, and inline editing.
- **Visual Dashboard**: Interactive charts to visualize expense breakdown and financial health.
- **Theming**: SCSS-based theme system with support for dark mode and responsive design.

## Architecture

This project follows a **Standalone Architecture** pattern, eliminating `NgModules` in favor of self-contained components and strict separation of concerns.

### Core Principles
- **Signals-First**: State management relies entirely on Angular Signals for fine-grained reactivity.
- **OnPush Change Detection**: Enabled globally to ensure optimal performance.
- **Domain Logic Separation**: All financial calculations reside in pure TypeScript services/models, decoupled from the UI framework.
- **Strict Typing**: TypeScript "Strict Mode" is enabled to prevent runtime errors.

### Folder Structure
```
/src
  /app
    /core           # Singleton services & domain logic
      /domain       # Pure TS models & calculation engines
      /services     # App-wide services (Persistence, Error Handling)
      /state        # Signal-based stores
    /features       # Smart components & specific business logic
      /budget       # Expenses management
      /dashboard    # Data visualization
      /value-calculator # Quick conversion tool
    /shared         # Reusable UI components, pipes, & directives
      /ui
    /layout         # Main layout shell (Nav, Header, etc)
    /theme          # SCSS variables & global styles
```

## Tech Stack
- **Framework**: Angular 19
- **State Management**: Angular Signals
- **Data Grid**: AG Grid Community
- **Visualization**: ApexCharts (ng-apexcharts)
- **Styling**: SCSS (Design Tokens, CSS Variables)
- **Persistence**: IndexedDB (via wrapper service)
- **tooling**: ESLint, Prettier, Angular CLI

## Installation

1. **Prerequisites**
   - Node.js (Late LTS version recommended)
   - npm or yarn

2. **Clone and Install**
   ```bash
   git clone https://github.com/your-username/life-value-finance.git
   cd life-value-finance
   npm install
   ```

## Development

To start the development server:

```bash
ng serve
```
Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Production Build

To build the project for production:

```bash
ng build --configuration production
```
The build artifacts will be stored in the `dist/life-value-finance` directory.

### Build Optimization
The production configuration enables:
- Ahead-of-Time (AOT) compilation
- Build Optimizer
- Dead code elimination
- Minification

## Environment Configuration
The project uses standard Angular environment files (`src/environments`).
- `environment.ts`: Development settings
- `environment.prod.ts`: Production settings (production mode enabled, logs disabled)

## Persistence Strategy
Data is stored entirely on the client-side using a custom `PersistenceService`.
- **Primary Storage**: `localStorage` (for simplicity and speed in this version)
- **Structure**: JSON object stores for `budget-state`
- **Safety**: Includes error handling for quota limits and data corruption.

## Performance Notes
- **Lazy Loading**: Route-level code splitting is implemented for the Dashboard.
- **Bundle Size**: Initial load is optimized by deferring heavy charting libraries.
- **Change Detection**: Strict `OnPush` prevents unnecessary re-renders.

## Future Plans
- **PWA Support**: Offline installation and service workers.
- **IndexedDB Upgrade**: Migrate to IndexedDB for larger datasets.
- **Backend Sync**: Optional cloud sync capabilities.

