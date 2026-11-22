export function isPhoneView(matchMedia = globalThis.window && globalThis.window.matchMedia) {
  if (typeof matchMedia !== 'function') return false;
  try {
    const result = matchMedia('(max-width: 768px)');
    return !!(result && result.matches);
  } catch {
    return false;
  }
}
