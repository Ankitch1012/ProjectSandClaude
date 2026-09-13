// keyboard.js — Keyboard shortcut handler

const PRESETS = {
  '1': { v: 15, d: 50, t: 20 },
  '2': { v: 45, d: 50, t: 20 },
  '3': { v: 65, d: 50, t: 20 },
  '4': { v: 100, d: 100, t: 20 },
  '5': { v: 80, d: 5, t: 20 },
};

export function setupKeyboard(handlers) {
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const helpOpen = document.getElementById('helpModal')?.classList.contains('open');
    if (helpOpen && [' ', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      handlers.togglePlay();
    } else if (e.key === 'r' || e.key === 'R') {
      handlers.reset();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handlers.step();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handlers.velocityDelta(2);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handlers.velocityDelta(-2);
    } else if (e.key === '?') {
      handlers.toggleHelp();
    } else if (e.key === 'Escape') {
      handlers.closeHelp();
    } else if (PRESETS[e.key]) {
      const p = PRESETS[e.key];
      handlers.preset(p.v, p.d, p.t);
    }
  });
}
