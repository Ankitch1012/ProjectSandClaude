// utils.js — Small shared helpers

export function formatSci(n) {
  if (n === 0) return '0';
  if (Math.abs(n) < 0.001 || Math.abs(n) > 1e6) return n.toExponential(2);
  return n.toFixed(3);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function hsl(h, s, l, a = 1) {
  return a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${a})` : `hsl(${h}, ${s}%, ${l}%)`;
}
