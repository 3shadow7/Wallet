// Utility helpers to read CSS variables at runtime so charts/grids can stay token-driven.
// Uses safe fallbacks for SSR (returns `var(--token)` or provided defaults when document is unavailable).

type TokenName =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'textPrimary'
  | 'textSecondary'
  | 'bgSurface'
  | 'bgElev1'
  | 'bgElev2'
  | 'border';

const defaultWindow: Window | null = typeof window !== 'undefined' ? window : null;

const FALLBACKS: Record<TokenName, string> = {
  primary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  textPrimary: '#1a1b25',
  textSecondary: '#5e6472',
  bgSurface: '#ffffff',
  bgElev1: '#f8f9fc',
  bgElev2: '#eef1f7',
  border: '#e2e8f0'
};

const CSS_VARS: Record<TokenName, string> = {
  primary: '--primary-color',
  success: '--success-color',
  warning: '--warning-color',
  danger: '--danger-color',
  info: '--info-color',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  bgSurface: '--bg-surface',
  bgElev1: '--bg-elev-1',
  bgElev2: '--bg-elev-2',
  border: '--border-color'
};

export function getCssVar(name: string, fallback?: string, win: Window | null = defaultWindow): string {
  const docEl = win?.document?.documentElement;
  if (!docEl) return fallback ?? `var(${name})`;
  const value = win.getComputedStyle(docEl).getPropertyValue(name).trim();
  return value || fallback || `var(${name})`;
}

export function getThemeTokens(win: Window | null = defaultWindow): Record<TokenName, string> {
  return {
    primary: getCssVar(CSS_VARS.primary, FALLBACKS.primary, win),
    success: getCssVar(CSS_VARS.success, FALLBACKS.success, win),
    warning: getCssVar(CSS_VARS.warning, FALLBACKS.warning, win),
    danger: getCssVar(CSS_VARS.danger, FALLBACKS.danger, win),
    info: getCssVar(CSS_VARS.info, FALLBACKS.info, win),
    textPrimary: getCssVar(CSS_VARS.textPrimary, FALLBACKS.textPrimary, win),
    textSecondary: getCssVar(CSS_VARS.textSecondary, FALLBACKS.textSecondary, win),
    bgSurface: getCssVar(CSS_VARS.bgSurface, FALLBACKS.bgSurface, win),
    bgElev1: getCssVar(CSS_VARS.bgElev1, FALLBACKS.bgElev1, win),
    bgElev2: getCssVar(CSS_VARS.bgElev2, FALLBACKS.bgElev2, win),
    border: getCssVar(CSS_VARS.border, FALLBACKS.border, win)
  };
}

export function getThemeToken(name: TokenName, win: Window | null = defaultWindow): string {
  return getThemeTokens(win)[name];
}
