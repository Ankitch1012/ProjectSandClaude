// ui/update.js — Sidebar UI updates, formula rendering, telemetry

import { state, PROJ, CAV_CRIT_SIGMA, saveState } from '../state.js';
import { updatePhysics } from '../physics.js';
import { formatSci } from '../utils.js';
import { renderRecentSamples } from './history.js';
import { renderComparison } from './comparison.js';

export function updateUI() {
  updatePhysics();

  // Slider displays
  document.getElementById('valVel').innerHTML = `${state.velocity.toFixed(1)} <span class="unit">m/s</span>`;
  document.getElementById('valDepth').innerHTML = `${state.depth} <span class="unit">m</span>`;
  document.getElementById('valTemp').innerHTML = `${state.temp} <span class="unit">°C</span>`;

  // Velocity slider color
  const velSlider = document.getElementById('sliderVel');
  if (state.sigma < CAV_CRIT_SIGMA * 0.3) {
    velSlider.classList.add('cavitating');
  } else {
    velSlider.classList.remove('cavitating');
  }

  // Telemetry
  document.getElementById('tRe').innerHTML = `${formatSci(state.Re)} <span class="u">—</span>`;
  document.getElementById('tCd').innerHTML = `${state.Cd.toFixed(4)} <span class="u">—</span>`;
  document.getElementById('tDrag').innerHTML = `${formatSci(state.dragForce)} <span class="u">N</span>`;
  document.getElementById('tBubble').innerHTML = state.bubbleLength > 0
    ? `${state.bubbleLength.toFixed(2)} <span class="u">m</span>`
    : `0.00 <span class="u">m</span>`;
  document.getElementById('tPower').innerHTML = `${formatSci(state.power)} <span class="u">W</span>`;
  document.getElementById('tPv').innerHTML = `${Math.round(state.Pv)} <span class="u">Pa</span>`;
  document.getElementById('tPamb').innerHTML = `${(state.Pamb / 1000).toFixed(1)} <span class="u">kPa</span>`;
  const ke = 0.5 * PROJ.mass * state.velocity * state.velocity;
  document.getElementById('tKE').innerHTML = `${formatSci(ke)} <span class="u">J</span>`;
  document.getElementById('tRho').innerHTML = `${state.rho.toFixed(1)} <span class="u">kg/m³</span>`;
  document.getElementById('tTime').innerHTML = `${state.time.toFixed(3)} <span class="u">s</span>`;
  document.getElementById('tSamples').innerHTML = `${state.sampleOrdinal} <span class="u">—</span>`;
  document.getElementById('tTrial').innerHTML = `${state.trial} <span class="u">—</span>`;
  document.getElementById('tRetained').innerHTML = `${state.dragHistory.length} <span class="u">—</span>`;

  // Sigma color
  const sigmaEl = document.getElementById('tSigma');
  sigmaEl.innerHTML = `${state.sigma.toFixed(2)} <span class="u">—</span>`;
  sigmaEl.className = 'telem-value' + (state.sigma < CAV_CRIT_SIGMA ? ' red' : state.sigma < CAV_CRIT_SIGMA * 1.5 ? ' amber' : ' green');

  // Card classes
  document.getElementById('tcSigma').className = 'telem-card' + (state.sigma < CAV_CRIT_SIGMA ? ' warning' : state.sigma < CAV_CRIT_SIGMA * 1.5 ? ' accent' : ' ok');
  document.getElementById('tcCd').className = 'telem-card' + (state.bubbleFraction > 0 ? ' accent' : ' ok');

  // Regime badge
  const badge = document.getElementById('regimeBadge');
  badge.className = 'canvas-regime-badge regime-' + (state.regime === 'sub' ? 'sub' : state.regime === 'transition' ? 'trans' : 'super');
  badge.textContent = state.regime === 'sub' ? 'SUBCRITICAL' : state.regime === 'transition' ? 'CAVITATING' : 'SUPERCAVITY';

  // Warning bar
  const wb = document.getElementById('warningBar');
  const wt = document.getElementById('warningText');
  if (state.sigma < CAV_CRIT_SIGMA) {
    wb.classList.add('show');
    wt.textContent = state.regime === 'super'
      ? `SUPERCAVITY — Full vapor envelope! Drag coefficient dropped to ${state.Cd.toFixed(4)}`
      : `CAVITATION — Local pressure below ${Math.round(state.Pv)} Pa vapor pressure`;
  } else {
    wb.classList.remove('show');
  }

  // Formula box
  const frictionRatio = (PROJ.Awet / PROJ.Afront);
  document.getElementById('formulaBox').innerHTML = `
    <div>σ = (<span class="hi">${(state.Pamb / 1000).toFixed(1)}k</span> − <span class="warn">${Math.round(state.Pv)}</span>) / (½ × ${state.rho.toFixed(0)} × v²)</div>
    <div style="margin-top:4px">C<sub>f</sub> = 0.074 × (${formatSci(state.Re)})<sup>−0.2</sup> = <span class="acc">${state.Cf.toFixed(5)}</span></div>
    <div style="margin-top:4px">C<sub>fric</sub> = C<sub>f</sub> × ${frictionRatio.toFixed(1)} = <span class="acc">${(state.Cf * frictionRatio).toFixed(4)}</span></div>
    <div style="margin-top:4px">F<sub>d</sub> = ½ × <span class="acc">${state.Cd.toFixed(4)}</span> × ${state.rho.toFixed(0)} × ${state.velocity.toFixed(1)}² × ${PROJ.Afront.toFixed(4)}</div>
    <div style="margin-top:4px">= <span class="hi">${formatSci(state.dragForce)} N</span> ${state.power > 1000 ? `(${formatSci(state.power)} W)` : ''}</div>
  `;

  // Plot labels
  document.getElementById('cdPlotVal').textContent = `Cd=${state.Cd.toFixed(4)}`;
  document.getElementById('pressPlotVal').textContent = `σ=${state.sigma.toFixed(2)}`;
  document.getElementById('dragPlotVal').textContent = `F=${formatSci(state.dragForce)}N`;
  renderRecentSamples();
  renderComparison();
}
