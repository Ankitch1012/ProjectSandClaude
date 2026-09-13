// main.js — Entry point: wire stores + UI together

import { state, loadState } from './state.js';
import { advanceOneTick } from './trial.js';
import { setupKeyboard } from './keyboard.js';
import { resizeSimCanvas, initParticles, renderSim } from './ui/sim-canvas.js';
import { renderCdPlot, renderPressurePlot, renderDragPlot } from './ui/plots.js';
import { updateUI } from './ui/update.js';
import { setupComparison } from './ui/comparison.js';
import { setupSliders, setupButtons, togglePlay, doStep, doReset, setPreset, velocityDelta, pauseRun } from './ui/controls.js';
import { toggleHelp, closeHelp } from './ui/help-modal.js';
import { runSelfTest } from './ui/self-test.js';

const toggleHelpWithPause = () => {
  const opening = !document.getElementById('helpModal').classList.contains('open');
  if (opening) pauseRun();
  toggleHelp();
};

// Wire up keyboard
setupKeyboard({
  togglePlay,
  reset: doReset,
  step: doStep,
  velocityDelta,
  toggleHelp: toggleHelpWithPause,
  closeHelp,
  preset: setPreset,
});

// Wire up sliders and buttons
setupSliders();
setupButtons();
setupComparison();
document.getElementById('btnHelp').addEventListener('click', toggleHelpWithPause);

// Resize handler
window.addEventListener('resize', resizeSimCanvas);

// Init
resizeSimCanvas();
loadState();
updateUI();
runSelfTest();
initParticles();

// Main loop
let lastTime = performance.now();

function mainLoop(now) {
  let dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (state.playing) {
    advanceOneTick();
    updateUI();
  }
  renderSim(dt);
  renderCdPlot();
  renderPressurePlot();
  renderDragPlot();
  requestAnimationFrame(mainLoop);
}

requestAnimationFrame(mainLoop);
