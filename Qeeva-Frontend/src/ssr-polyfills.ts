
// Polyfills for SSR
if (typeof window === 'undefined') {
  (global as any).window = {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {}
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: (cb: Function) => { cb(); },
    clearTimeout: () => {},
    location: { href: '' },
    document: {
       createElement: () => ({ style: {} }),
       body: { style: {} },
       documentElement: { style: {} }
    },
    navigator: { userAgent: 'node' }
  };
  (global as any).document = (global as any).window.document;
  if (typeof (global as any).localStorage === 'undefined') {
    (global as any).localStorage = (global as any).window.localStorage;
  }
  if (typeof (global as any).navigator === 'undefined') {
    (global as any).navigator = (global as any).window.navigator;
  }
}
