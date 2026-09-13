// ui/plots.js — Plot rendering (Cd curve, pressure, drag history)

import { state, CAV_CRIT_SIGMA, WATER, PROJ } from '../state.js';
import { formatSci } from '../utils.js';
import { waterDensity, waterViscosity, vaporPressure, skinFrictionCf, computeDragCoefficient, computePressureDistribution } from '../physics.js';

function setupCanvas(canvas) {
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = wrap.clientWidth * dpr;
  canvas.height = wrap.clientHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: wrap.clientWidth, h: wrap.clientHeight };
}

function drawGrid(ctx, w, h) {
  ctx.fillStyle = '#0D1929';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(30,48,80,0.5)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    let x = (i / 5) * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    let y = (i / 5) * h;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

// Helper: compute local Cd and sigma at a given velocity using pure functions
function computeCdAtVelocity(v, T, depth) {
  const rho = waterDensity(T);
  const mu = waterViscosity(T);
  const Pv = vaporPressure(T);
  const Pamb = WATER.Patm + rho * 9.81 * depth;
  const Re = rho * v * PROJ.length / mu;
  const sigma = v > 0.01 ? (Pamb - Pv) / (0.5 * rho * v * v) : 999;
  const drag = computeDragCoefficient(Re, sigma, v);
  return { Cd: drag.total, sigma };
}

export function renderCdPlot() {
  const { ctx, w, h } = setupCanvas(document.getElementById('cdPlot'));
  drawGrid(ctx, w, h);

  const maxV = 120;
  const localT = state.temp;
  const localDepth = state.depth;

  // Fill under curve
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= 100; i++) {
    let v = (i / 100) * maxV;
    let { Cd } = computeCdAtVelocity(v, localT, localDepth);
    let x = (v / maxV) * w;
    let y = h - (Cd / 0.55) * h;
    y = Math.max(0, Math.min(h, y));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(45,226,230,0.05)';
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i <= 100; i++) {
    let v = (i / 100) * maxV;
    let { Cd } = computeCdAtVelocity(v, localT, localDepth);
    let x = (v / maxV) * w;
    let y = h - (Cd / 0.55) * h;
    y = Math.max(0, Math.min(h, y));
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(45,226,230,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Threshold line (find v where sigma crosses critical)
  let threshX = 0;
  for (let v = 0; v < 120; v += 0.5) {
    let { sigma } = computeCdAtVelocity(v, localT, localDepth);
    if (sigma < CAV_CRIT_SIGMA * 1.5) { threshX = v; break; }
  }

  if (threshX > 0) {
    let tx = (threshX / maxV) * w;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(245,166,35,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx, h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '8px "IBM Plex Mono"';
    ctx.fillStyle = 'rgba(245,166,35,0.6)';
    ctx.fillText('σ_crit', tx + 3, 10);
  }

  // Current point
  let curCd = computeCdAtVelocity(state.velocity, localT, localDepth).Cd;
  let cx = (state.velocity / maxV) * w;
  let cy = h - (curCd / 0.55) * h;
  cy = Math.max(0, Math.min(h, cy));
  ctx.fillStyle = 'rgba(245,166,35,0.2)';
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F5A623';
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

  ctx.font = '8px "IBM Plex Mono"';
  ctx.fillStyle = 'rgba(136,153,176,0.5)';
  ctx.fillText('0', 2, h - 3);
  ctx.fillText('120 m/s', w - 42, h - 3);
  ctx.fillText('0.55', 2, 10);
}

export function renderPressurePlot() {
  const { ctx, w, h } = setupCanvas(document.getElementById('pressPlot'));
  drawGrid(ctx, w, h);

  if (state.pressureDist.length === 0) return;
  let pMin = state.Pv * 0.5;
  let pMax = state.Pamb + 0.5 * state.rho * state.velocity * state.velocity;

  // Fill
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let pt of state.pressureDist) {
    let x = pt.x * w;
    let y = h - ((pt.p - pMin) / (pMax - pMin)) * h;
    y = Math.max(0, Math.min(h, y));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(45,226,230,0.08)';
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < state.pressureDist.length; i++) {
    let pt = state.pressureDist[i];
    let x = pt.x * w;
    let y = h - ((pt.p - pMin) / (pMax - pMin)) * h;
    y = Math.max(0, Math.min(h, y));
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#2DE2E6';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Vapor pressure line
  let vpY = h - ((state.Pv - pMin) / (pMax - pMin)) * h;
  if (vpY > 0 && vpY < h) {
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255,71,87,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, vpY); ctx.lineTo(w, vpY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '8px "IBM Plex Mono"';
    ctx.fillStyle = 'rgba(255,71,87,0.6)';
    ctx.fillText('Pv', w - 18, vpY - 3);
  }

  ctx.font = '8px "IBM Plex Mono"';
  ctx.fillStyle = 'rgba(136,153,176,0.5)';
  ctx.fillText('nose', 2, h - 3);
  ctx.fillText('tail', w - 18, h - 3);
}

export function renderDragPlot() {
  const { ctx, w, h } = setupCanvas(document.getElementById('dragPlot'));
  drawGrid(ctx, w, h);

  let hist = state.dragHistory;
  if (hist.length < 2) {
    ctx.font = '9px "IBM Plex Mono"';
    ctx.fillStyle = 'rgba(136,153,176,0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('Press PLAY to record', w / 2, h / 2);
    ctx.textAlign = 'left';
    return;
  }

  let maxF = 0;
  for (let d of hist) maxF = Math.max(maxF, d.F);
  maxF = Math.max(maxF, 100);

  // Fill
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < hist.length; i++) {
    let x = (i / (state.maxHistory - 1)) * w;
    let y = h - (hist[i].F / maxF) * h * 0.9;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(((hist.length - 1) / (state.maxHistory - 1)) * w, h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(245,166,35,0.06)';
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < hist.length; i++) {
    let x = (i / (state.maxHistory - 1)) * w;
    let y = h - (hist[i].F / maxF) * h * 0.9;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#F5A623';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  let last = hist[hist.length - 1];
  let lx = ((hist.length - 1) / (state.maxHistory - 1)) * w;
  let ly = h - (last.F / maxF) * h * 0.9;
  ctx.fillStyle = '#F5A623';
  ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();

  ctx.font = '8px "IBM Plex Mono"';
  ctx.fillStyle = 'rgba(136,153,176,0.5)';
  ctx.fillText(`max ${formatSci(maxF)} N`, 2, 10);
}
