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

// Kept for any external one-off callers. NOTE: this still does its own
// getComputedStyle() call per invocation, which is fine for a single lookup
// but must NOT be looped for multiple tokens — see getThemeTokens() below,
// which reuses one computed style object for all of them.
export function getCssVar(name: string, fallback?: string, win: Window | null = defaultWindow): string {
  const docEl = win?.document?.documentElement;
  if (!docEl) return fallback ?? `var(${name})`;
  const value = win.getComputedStyle(docEl).getPropertyValue(name).trim();
  return value || fallback || `var(${name})`;
}

export function getThemeTokens(win: Window | null = defaultWindow): Record<TokenName, string> {
  const docEl = win?.document?.documentElement;
  if (!docEl) return { ...FALLBACKS };

  // Single forced style resolution, reused for every token below. Previously
  // getThemeTokens() routed through getCssVar() for each of the 11 tokens,
  // which meant 11 separate getComputedStyle() calls per invocation — each
  // one a forced synchronous style/layout flush if a DOM write (e.g. an
  // ApexCharts updateOptions() call) was pending just before it.
  const computed = win!.getComputedStyle(docEl);

  const read = (token: TokenName): string => {
    const value = computed.getPropertyValue(CSS_VARS[token]).trim();
    return value || FALLBACKS[token];
  };

  return {
    primary: read('primary'),
    success: read('success'),
    warning: read('warning'),
    danger: read('danger'),
    info: read('info'),
    textPrimary: read('textPrimary'),
    textSecondary: read('textSecondary'),
    bgSurface: read('bgSurface'),
    bgElev1: read('bgElev1'),
    bgElev2: read('bgElev2'),
    border: read('border')
  };
}

export function getThemeToken(name: TokenName, win: Window | null = defaultWindow): string {
  return getThemeTokens(win)[name];
}
