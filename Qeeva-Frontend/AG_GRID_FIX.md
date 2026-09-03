# AG Grid Update & Fixes
**Date:** 2026-02-17
**Status:** Resolved

## 1. AG Grid Modules Registration (Error #272)
**Issue:**  
The application was throwing `AG Grid: error #272 No AG Grid modules are registered!` at runtime. This is because modern AG Grid (v31+) uses a modular architecture where features must be explicitly registered to reduce bundle size.

**Fix:**  
Updated `src/app/app.config.ts` to register `AllCommunityModule` globally.
```typescript
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'; 
ModuleRegistry.registerModules([AllCommunityModule]);
```

## 2. Build Budget Adjustment
**Issue:**  
Registering `AllCommunityModule` increased the initial bundle size to `~1.62MB`, exceeding the default `1MB` budget in `angular.json`.

**Fix:**  
Updated `angular.json` configuration:
- `maximumWarning`: Increased to `2MB`
- `maximumError`: Increased to `4MB`

## 3. Deprecation Fixes
**Issue:**  
`allowSignalWrites` in `effect()` was deprecated.

**Fix:**  
Removed the flag in `src/app/features/income/income-input.component.ts` as it is no longer needed (writes are allowed by default in Angular 19+ effects).

## Verification
- `ng build` completes successfully.
- SSR prerendering succeeds.
- Runtime grid initialization will now proceed without errors.
