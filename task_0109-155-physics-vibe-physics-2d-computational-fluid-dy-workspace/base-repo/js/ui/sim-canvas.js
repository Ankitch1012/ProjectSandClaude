// ui/sim-canvas.js — Main simulation canvas rendering

import { state, CAV_CRIT_SIGMA } from '../state.js';
import { flowField } from '../physics.js';
import { hsl, clamp } from '../utils.js';

const simCanvas = document.getElementById('simCanvas');
const simCtx = simCanvas.getContext('2d');

export function initParticles() {
  state.particles = [];
  state.bubbleParticles = [];
  state.wakeParticles = [];
  
  for (let i = 0; i < 280; i++) {
    state.particles.push({
      x: Math.random() * 1.6 - 0.3,
      y: Math.random(),
      size: 0.8 + Math.random() * 2.5,
      alpha: 0.2 + Math.random() * 0.4,
      hueShift: Math.random() * 40 - 20,
    });
  }
  for (let i = 0; i < 60; i++) {
    state.bubbleParticles.push({
      angle: Math.random() * Math.PI * 2,
      r: Math.random(),
      speed: 0.3 + Math.random() * 0.7,
      size: 1.5 + Math.random() * 4,
      opacity: 0.2 + Math.random() * 0.6,
      wobble: Math.random() * Math.PI * 2,
    });
  }
  for (let i = 0; i < 50; i++) {
    state.wakeParticles.push({
      offset: Math.random(),
      lateralOffset: Math.random() * 2 - 1,
      size: 1 + Math.random() * 3,
      age: Math.random(),
      speed: 0.5 + Math.random() * 1.5,
    });
  }
}

export function resizeSimCanvas() {
  const wrap = simCanvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  simCanvas.width = wrap.clientWidth * dpr;
  simCanvas.height = wrap.clientHeight * dpr;
  simCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawPressureField(w, h) {
  if (state.velocity < 2) return;
  const step = 16;
  const pAmb = state.Pamb;
  const pMin = state.Pv * 0.5;
  const pMax = pAmb + 0.5 * state.rho * state.velocity * state.velocity;
  const intensity = Math.min(1, state.velocity / 60);

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w * 0.7; x += step) {
      let nx = x / w, ny = y / h;
      let px = nx - 0.48, py = ny - 0.5;
      let r = Math.sqrt(px * px + py * py);
      let projR = 0.06;

      if (r < projR * 4) {
        let pressure;
        if (r < projR * 0.5) {
          pressure = state.velocity > 1 ? pAmb + 0.5 * state.rho * state.velocity * state.velocity : pAmb;
        } else {
          let angle = Math.atan2(py, px);
          let nearNose = Math.max(0, -Math.cos(angle));
          let wake = Math.max(0, Math.cos(angle)) * (nx > 0.48 ? 1 : 0);
          pressure = pAmb
            - (pAmb - pMin) * nearNose * 0.8 * Math.exp(-(r - projR) * 18)
            + (pMax - pAmb) * 0.3 * wake * Math.exp(-(r - projR) * 12);
        }
        
        let t = clamp((pressure - pMin) / (pMax - pMin), 0, 1);
        let r2, g2, b2;
        if (t < 0.3) {
          let s = t / 0.3;
          r2 = Math.round(10 + s * 30);
          g2 = Math.round(8 + s * 50);
          b2 = Math.round(60 + s * 80);
        } else if (t < 0.6) {
          let s = (t - 0.3) / 0.3;
          r2 = Math.round(15 + s * 15);
          g2 = Math.round(50 + s * 110);
          b2 = Math.round(120 + s * 50);
        } else {
          let s = (t - 0.6) / 0.4;
          r2 = Math.round(30 + s * 215);
          g2 = Math.round(140 + s * 26);
          b2 = Math.round(150 - s * 115);
        }
        
        simCtx.globalAlpha = 0.3 * intensity;
        simCtx.fillStyle = `rgb(${r2},${g2},${b2})`;
        simCtx.fillRect(x - step / 2, y - step / 2, step, step);
      }
    }
  }
  simCtx.globalAlpha = 1;
}

function drawStreamlines(w, h) {
  if (state.velocity < 1) return;
  const numLines = 14;
  const steps = 80;
  const dt_step = 0.003;
  const intensity = Math.min(1, state.velocity / 60);
  
  simCtx.save();
  for (let i = 0; i < numLines; i++) {
    let startY = (i + 0.5) / numLines;
    let x = -0.1, y = startY;
    simCtx.beginPath();
    simCtx.moveTo(x * w, y * h);
    let valid = true;
    for (let s = 0; s < steps && valid; s++) {
      let f = flowField(x, y);
      x += f.vx * dt_step;
      y += f.vy * dt_step;
      let dx = x - 0.48, dy = y - 0.5;
      if (Math.sqrt(dx * dx + dy * dy) < 0.042) valid = false;
      simCtx.lineTo(x * w, y * h);
      if (x > 1.2 || y < -0.1 || y > 1.1) break;
    }
    let distFromCenter = Math.abs(startY - 0.5) * 2;
    let hue = 195 + distFromCenter * 20;
    let alpha = (0.06 + intensity * 0.12) * (0.5 + distFromCenter * 0.5);
    simCtx.strokeStyle = hsl(hue, 60, 55 + distFromCenter * 15, alpha);
    simCtx.lineWidth = 0.8;
    simCtx.stroke();
  }
  simCtx.restore();
}

function drawParticles(w, h, dt) {
  const v = state.velocity;
  for (let p of state.particles) {
    let f = flowField(p.x, p.y);
    let speed = v * 0.01;
    if (state.playing) {
      p.x += f.vx * speed * dt * 50;
      p.y += f.vy * speed * dt * 50;
    }
    if (p.x > 1.3 || p.x < -0.3 || p.y > 1.1 || p.y < -0.1) {
      p.x = -0.2 - Math.random() * 0.1;
      p.y = Math.random();
    }
    let dx = p.x - 0.48, dy = p.y - 0.5;
    if (Math.sqrt(dx * dx + dy * dy) < 0.045) continue;
    let localSpeed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
    let intensity = Math.min(1, (localSpeed - 0.8) / 0.8);
    if (v < 5 && intensity < 0.1) continue;
    let hue = 195 + p.hueShift + intensity * 25;
    let sat = 60 + intensity * 30;
    let light = 45 + intensity * 35;
    let alpha = (0.1 + intensity * 0.5) * Math.min(1, v / 5);
    simCtx.globalAlpha = alpha;
    simCtx.fillStyle = hsl(hue, sat, light);
    simCtx.beginPath();
    simCtx.arc(p.x * w, p.y * h, Math.max(0.3, p.size * (0.6 + intensity * 0.8)), 0, Math.PI * 2);
    simCtx.fill();
    if (intensity > 0.3 && v > 10) {
      simCtx.strokeStyle = hsl(hue, sat, light, alpha * 0.3);
      simCtx.lineWidth = p.size * 0.5;
      simCtx.beginPath();
      simCtx.moveTo(p.x * w, p.y * h);
      simCtx.lineTo(p.x * w - f.vx * 4, p.y * h - f.vy * 4);
      simCtx.stroke();
    }
  }
  simCtx.globalAlpha = 1;
}

function drawWake(w, h, dt) {
  if (state.velocity < 3) return;
  const cx = w * 0.48, cy = h * 0.5;
  const bodyLen = w * 0.2;
  const bodyH = h * 0.065;
  const tailX = cx + bodyLen * 0.5;
  const intensity = Math.min(1, state.velocity / 80);
  let wakeLen = bodyLen * (0.4 + state.velocity * 0.02);

  for (let wp of state.wakeParticles) {
    if (state.playing) {
      wp.offset += wp.speed * dt * 0.3;
      wp.age += dt * 0.2;
    }
    if (wp.offset > 1 || wp.age > 1) {
      wp.offset = 0;
      wp.age = 0;
      wp.lateralOffset = Math.random() * 2 - 1;
    }
    let t = wp.offset;
    let x = tailX + t * wakeLen;
    let spread = bodyH * (0.8 + t * 3.5) * intensity;
    let swirl = Math.sin(t * 12 + wp.age * 8 + wp.lateralOffset * 4) * spread;
    let y = cy + swirl + wp.lateralOffset * spread * 0.3;
    let size = Math.max(0.5, wp.size * (1 - t * 0.4) * (0.5 + intensity * 0.5));
    let alpha = (0.15 + intensity * 0.2) * (1 - t * 0.7) * (1 - wp.age * 0.3);
    if (alpha < 0.02) continue;
    let hue = state.regime === 'super' ? 350 + swirl * 2 : 195 + swirl;
    simCtx.globalAlpha = alpha;
    simCtx.fillStyle = hsl(hue, 40 + intensity * 30, 55 + intensity * 15);
    simCtx.beginPath();
    simCtx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
    simCtx.fill();
  }
  simCtx.globalAlpha = 1;

  if (state.bubbleFraction > 0.7) {
    let extLen = wakeLen * 2.0;
    simCtx.globalAlpha = 0.04 + state.bubbleFraction * 0.04;
    simCtx.fillStyle = '#c0dfff';
    simCtx.beginPath();
    simCtx.moveTo(tailX, cy);
    simCtx.bezierCurveTo(tailX + extLen * 0.3, cy - bodyH * 2.5, tailX + extLen * 0.7, cy - bodyH * 1.5, tailX + extLen, cy);
    simCtx.bezierCurveTo(tailX + extLen * 0.7, cy + bodyH * 1.5, tailX + extLen * 0.3, cy + bodyH * 2.5, tailX, cy);
    simCtx.fill();
    simCtx.globalAlpha = 1;
  }
}

function drawProjectile(w, h) {
  const cx = w * 0.48, cy = h * 0.5;
  const bodyLen = w * 0.2;
  const bodyH = h * 0.065;
  const noseW = w * 0.045;

  // Glow
  simCtx.save();
  let glowGrad = simCtx.createRadialGradient(cx, cy, bodyH, cx, cy, bodyLen * 0.8);
  glowGrad.addColorStop(0, 'rgba(45,226,230,0.06)');
  glowGrad.addColorStop(1, 'rgba(45,226,230,0)');
  simCtx.fillStyle = glowGrad;
  simCtx.fillRect(cx - bodyLen, cy - bodyH * 5, bodyLen * 2, bodyH * 10);
  simCtx.restore();

  // Cavitation bubble
  if (state.bubbleFraction > 0.01) {
    simCtx.save();
    const bLen = bodyLen + state.bubbleFraction * bodyLen * 2.0;
    const bH = bodyH * (1 + state.bubbleFraction * 3.5);
    const noseX = cx - bodyLen * 0.5;

    // Outer glow
    let glow = simCtx.createRadialGradient(cx + bodyLen * 0.2, cy, bodyH, cx + bodyLen * 0.2, cy, bLen * 0.8);
    let ga = 0.04 + state.bubbleFraction * 0.12;
    glow.addColorStop(0, `rgba(180,220,255,${ga})`);
    glow.addColorStop(0.6, `rgba(140,200,255,${ga * 0.4})`);
    glow.addColorStop(1, 'rgba(100,180,255,0)');
    simCtx.fillStyle = glow;
    simCtx.beginPath();
    simCtx.ellipse(cx + bodyLen * 0.2, cy, bLen * 0.7, bH * 1.3, 0, 0, Math.PI * 2);
    simCtx.fill();

    // Main bubble body
    simCtx.beginPath();
    simCtx.moveTo(noseX, cy);
    simCtx.bezierCurveTo(noseX - bH * 0.2, cy - bH * 0.6, noseX + bLen * 0.15, cy - bH * 0.95, noseX + bLen * 0.5, cy - bH * 0.9);
    simCtx.bezierCurveTo(noseX + bLen * 0.85, cy - bH * 0.7, noseX + bLen, cy - bH * 0.25, noseX + bLen, cy);
    simCtx.bezierCurveTo(noseX + bLen, cy + bH * 0.25, noseX + bLen * 0.85, cy + bH * 0.7, noseX + bLen * 0.5, cy + bH * 0.9);
    simCtx.bezierCurveTo(noseX + bLen * 0.15, cy + bH * 0.95, noseX - bH * 0.2, cy + bH * 0.6, noseX, cy);
    let ba = 0.05 + state.bubbleFraction * 0.08;
    simCtx.fillStyle = `rgba(200,235,255,${ba})`;
    simCtx.fill();
    simCtx.strokeStyle = `rgba(180,225,255,${0.12 + state.bubbleFraction * 0.18})`;
    simCtx.lineWidth = 1.2;
    simCtx.stroke();

    // Surface highlights
    simCtx.globalAlpha = 0.25 * state.bubbleFraction;
    simCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    simCtx.lineWidth = 0.6;
    for (let i = 0; i < 12; i++) {
      let t = (i + 0.5) / 12;
      let bx = noseX + t * bLen * 0.9;
      let localH = bH * (0.15 + Math.sin(t * Math.PI) * 0.75);
      let waveTop = Math.sin(t * 14 + state.time * 2.5) * bH * 0.06;
      let waveBot = Math.sin(t * 10 + state.time * 1.8 + 2) * bH * 0.06;
      simCtx.beginPath();
      simCtx.arc(bx, cy - localH + waveTop, Math.max(0.5, 1.5 + Math.sin(i + state.time) * 1), 0, Math.PI * 2);
      simCtx.stroke();
      simCtx.beginPath();
      simCtx.arc(bx, cy + localH + waveBot, Math.max(0.5, 1.5 + Math.cos(i + state.time) * 1), 0, Math.PI * 2);
      simCtx.stroke();
    }
    simCtx.globalAlpha = 1;

    // Vapor cloud particles
    for (let bp of state.bubbleParticles) {
      let t = bp.r;
      let bx = noseX + t * bLen * 0.9;
      let localH = bH * (0.1 + Math.sin(t * Math.PI) * 0.7);
      let by = cy + Math.sin(bp.angle + state.time * bp.speed) * localH;
      let wobble = Math.sin(bp.wobble + state.time * 1.2) * 2;
      simCtx.globalAlpha = bp.opacity * state.bubbleFraction * 0.4;
      let size = bp.size * (0.4 + state.bubbleFraction * 0.6);
      simCtx.fillStyle = '#d8ecff';
      simCtx.beginPath();
      simCtx.arc(bx + wobble, by, size, 0, Math.PI * 2);
      simCtx.fill();
    }
    simCtx.globalAlpha = 1;
    simCtx.restore();
  }

  // Projectile body
  simCtx.save();
  let bodyGrad = simCtx.createLinearGradient(cx, cy - bodyH, cx, cy + bodyH);
  bodyGrad.addColorStop(0, '#2a3a4a');
  bodyGrad.addColorStop(0.3, '#1a2a3a');
  bodyGrad.addColorStop(0.7, '#141e2e');
  bodyGrad.addColorStop(1, '#0e1620');
  simCtx.fillStyle = bodyGrad;
  simCtx.strokeStyle = '#3a5a7a';
  simCtx.lineWidth = 1.5;
  simCtx.beginPath();
  simCtx.moveTo(cx - bodyLen * 0.5, cy);
  simCtx.bezierCurveTo(cx - bodyLen * 0.5 - noseW, cy - bodyH * 0.65, cx - bodyLen * 0.5 - noseW, cy + bodyH * 0.65, cx - bodyLen * 0.5, cy);
  simCtx.lineTo(cx + bodyLen * 0.5, cy - bodyH);
  simCtx.lineTo(cx + bodyLen * 0.5, cy + bodyH);
  simCtx.closePath();
  simCtx.fill();
  simCtx.stroke();

  // Panel lines
  simCtx.strokeStyle = 'rgba(60,100,140,0.25)';
  simCtx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    let fx = cx - bodyLen * 0.5 + (bodyLen * i / 4);
    simCtx.beginPath();
    simCtx.moveTo(fx, cy - bodyH * 0.85);
    simCtx.lineTo(fx, cy + bodyH * 0.85);
    simCtx.stroke();
  }

  // Top highlight
  simCtx.beginPath();
  simCtx.moveTo(cx - bodyLen * 0.45, cy - bodyH * 0.85);
  simCtx.lineTo(cx + bodyLen * 0.45, cy - bodyH * 0.85);
  simCtx.strokeStyle = 'rgba(100,160,220,0.2)';
  simCtx.lineWidth = 1;
  simCtx.stroke();

  // Centerline
  simCtx.setLineDash([5, 5]);
  simCtx.strokeStyle = 'rgba(80,140,180,0.12)';
  simCtx.lineWidth = 0.8;
  simCtx.beginPath();
  simCtx.moveTo(cx - bodyLen * 0.6, cy);
  simCtx.lineTo(cx + bodyLen * 0.6, cy);
  simCtx.stroke();
  simCtx.setLineDash([]);
  simCtx.restore();

  // Drag force arrow
  if (state.velocity > 0.5 && state.dragForce > 0) {
    simCtx.save();
    let arrowLen = Math.min(bodyLen * 0.6, Math.max(15, state.dragForce * 0.003));
    let ax = cx + bodyLen * 0.5 + 10;
    let ay = cy - bodyH - 12;
    simCtx.strokeStyle = 'rgba(255,71,87,0.5)';
    simCtx.lineWidth = 2;
    simCtx.beginPath();
    simCtx.moveTo(ax + arrowLen, ay);
    simCtx.lineTo(ax, ay);
    simCtx.stroke();
    simCtx.fillStyle = 'rgba(255,71,87,0.5)';
    simCtx.beginPath();
    simCtx.moveTo(ax, ay);
    simCtx.lineTo(ax + 6, ay - 3);
    simCtx.lineTo(ax + 6, ay + 3);
    simCtx.closePath();
    simCtx.fill();
    simCtx.font = '9px "IBM Plex Mono"';
    simCtx.fillStyle = 'rgba(255,71,87,0.4)';
    simCtx.fillText('F_drag', ax + arrowLen + 4, ay + 3);
    simCtx.restore();
  }
}

function drawOverlay(w, h) {
  simCtx.save();
  simCtx.font = '9px "IBM Plex Mono"';
  simCtx.fillStyle = 'rgba(136,153,176,0.35)';

  // Depth scale
  let spacing = h / 10;
  for (let i = 0; i <= 10; i++) {
    let y = i * spacing;
    simCtx.fillText(`${(state.depth - 5 + i).toFixed(0)}m`, 6, y + 3);
    if (i > 0 && i < 10) {
      simCtx.strokeStyle = 'rgba(136,153,176,0.05)';
      simCtx.lineWidth = 0.5;
      simCtx.beginPath();
      simCtx.moveTo(40, y);
      simCtx.lineTo(w, y);
      simCtx.stroke();
    }
  }

  // Velocity arrow
  let arrowLen = Math.min(120, state.velocity * 1.2);
  if (state.velocity > 0.5) {
    let ax = w - 40, ay = h - 20;
    simCtx.strokeStyle = 'rgba(45,226,230,0.4)';
    simCtx.lineWidth = 1.5;
    simCtx.beginPath();
    simCtx.moveTo(ax - arrowLen, ay);
    simCtx.lineTo(ax, ay);
    simCtx.lineTo(ax - 6, ay - 4);
    simCtx.moveTo(ax, ay);
    simCtx.lineTo(ax - 6, ay + 4);
    simCtx.stroke();
    simCtx.fillStyle = 'rgba(45,226,230,0.5)';
    simCtx.fillText(`v = ${state.velocity.toFixed(1)} m/s`, ax - arrowLen, ay - 8);
  }

  // Cavitation number
  if (state.velocity > 0.5) {
    let sigColor = state.sigma < CAV_CRIT_SIGMA ? 'rgba(255,71,87,0.55)' :
                   state.sigma < CAV_CRIT_SIGMA * 1.5 ? 'rgba(245,166,35,0.55)' :
                   'rgba(46,213,115,0.45)';
    simCtx.fillStyle = sigColor;
    simCtx.fillText(`σ = ${state.sigma.toFixed(2)}`, w - 100, 20);
  }

  // Intro overlay at v=0
  if (state.velocity < 0.5 && !state.playing && state.time === 0) {
    simCtx.textAlign = 'center';
    simCtx.fillStyle = 'rgba(4,10,20,0.5)';
    simCtx.fillRect(0, 0, w, h);
    simCtx.font = '600 22px "Outfit"';
    simCtx.fillStyle = 'rgba(232,237,245,0.8)';
    simCtx.fillText('Underwater Cavitation Laboratory', w / 2, h * 0.35);
    simCtx.font = '300 14px "Outfit"';
    simCtx.fillStyle = 'rgba(136,153,176,0.7)';
    simCtx.fillText('Interactive 2D Hydrodynamic Telemetry', w / 2, h * 0.35 + 28);
    simCtx.font = '400 12px "IBM Plex Mono"';
    simCtx.fillStyle = 'rgba(45,226,230,0.6)';
    simCtx.fillText('Drag the Velocity slider → or press ↑ to accelerate', w / 2, h * 0.55);
    simCtx.fillStyle = 'rgba(245,166,35,0.5)';
    simCtx.fillText('Cross 50 m/s to trigger cavitation', w / 2, h * 0.55 + 22);
    simCtx.fillStyle = 'rgba(232,237,245,0.3)';
    simCtx.font = '400 16px "Outfit"';
    simCtx.fillText('→ → →', w / 2, h * 0.68);
    simCtx.font = '300 10px "IBM Plex Mono"';
    simCtx.fillStyle = 'rgba(136,153,176,0.4)';
    simCtx.fillText('Press ? for keyboard shortcuts  •  Space to play', w / 2, h * 0.78);
    simCtx.textAlign = 'left';
  }

  simCtx.restore();
}

export function renderSim(dt) {
  const w = simCanvas.width / (window.devicePixelRatio || 1);
  const h = simCanvas.height / (window.devicePixelRatio || 1);

  // Water gradient
  let grad = simCtx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#081828');
  grad.addColorStop(0.3, '#0c2040');
  grad.addColorStop(0.7, '#0D2847');
  grad.addColorStop(1, '#04111F');
  simCtx.fillStyle = grad;
  simCtx.fillRect(0, 0, w, h);

  drawPressureField(w, h);
  drawStreamlines(w, h);
  drawParticles(w, h, dt);
  drawWake(w, h, dt);
  drawProjectile(w, h);
  drawOverlay(w, h);
}
