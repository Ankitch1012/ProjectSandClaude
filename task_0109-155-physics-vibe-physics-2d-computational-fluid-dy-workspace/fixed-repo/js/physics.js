// physics.js — Real numerical physics engine

import { WATER, CAV_CRIT_SIGMA, state, PROJ } from './state.js';

const PROJ_LENGTH = PROJ.length;

export function waterDensity(T) {
  return 1000 - 0.004 * (T - 4) * (T - 4) - 0.07 * Math.max(0, T - 4);
}

export function waterViscosity(T) {
  // Vogel equation: μ = A * exp(B / (T_kelvin - C))
  // T is in Celsius, convert to Kelvin internally
  // A=2.414e-5, B=247.8, C=-140
  const Tk = T + 273.15;
  return 2.414e-5 * Math.exp(247.8 / (Tk - (-140)));
}

export function vaporPressure(T) {
  return 611 * Math.exp(0.069 * T);
}

export function skinFrictionCf(Re) {
  if (Re < 1) return 0;
  if (Re < 5e5) return 1.328 / Math.sqrt(Re);
  return 0.074 * Math.pow(Re, -0.2);
}

export function computeDragCoefficient(Re, sigma, v) {
  if (v < 0.01) return { total: 0, friction: 0, form: 0, bubbleFraction: 0 };
  const Cf = skinFrictionCf(Re);
  // Friction Cd contribution: Cf * (Awet/Afront) converts wetted-area friction to frontal-area Cd
  const frictionRatio = PROJ.Awet / PROJ.Afront; // ≈28
  if (sigma > CAV_CRIT_SIGMA * 1.5) {
    return { total: 0.42 + Cf * frictionRatio, friction: Cf * frictionRatio, form: 0.42, bubbleFraction: 0 };
  } else if (sigma > CAV_CRIT_SIGMA * 0.3) {
    let cavProgress = 1 - (sigma - CAV_CRIT_SIGMA * 0.3) / (CAV_CRIT_SIGMA * 1.2);
    cavProgress = Math.max(0, Math.min(1, cavProgress));
    let CfForm = 0.42 * (1 - cavProgress * 0.85);
    let effectiveWetted = 1 - cavProgress * 0.8;
    return {
      total: CfForm + Cf * frictionRatio * effectiveWetted,
      friction: Cf * frictionRatio * effectiveWetted,
      form: CfForm,
      bubbleFraction: cavProgress
    };
  } else {
    return {
      total: 0.04 + Cf * 0.05,
      friction: Cf * 0.05,
      form: 0.04,
      bubbleFraction: 1.0
    };
  }
}

export function computePressureDistribution(v, sigma, bubbleFraction) {
  const N = 60;
  const dist = [];
  for (let i = 0; i < N; i++) {
    let x = i / (N - 1);
    let p;
    if (x < 0.08) {
      let stagnationOverP = 1 + 0.5 * state.rho * v * v / state.Pamb;
      p = state.Pamb * stagnationOverP;
      if (bubbleFraction > 0) p = state.Pamb + (p - state.Pamb) * (1 - bubbleFraction);
    } else if (x < 0.08 + bubbleFraction * 0.92) {
      p = state.Pv;
    } else {
      let recoverStart = 0.08 + bubbleFraction * 0.92;
      let recoverEnd = 1.0;
      let frac = (x - recoverStart) / Math.max(0.001, recoverEnd - recoverStart);
      frac = Math.max(0, Math.min(1, frac));
      let lowP = state.Pv + (1 - bubbleFraction) * (state.Pamb * 0.3 - state.Pv);
      p = lowP + (state.Pamb - lowP) * Math.pow(frac, 0.7);
    }
    dist.push({ x, p });
  }
  return dist;
}

export function flowField(nx, ny) {
  // Potential flow around a blunt body: uniform flow + doublet + wake deficit
  // Projectile center at normalized (0.48, 0.5), radius ~0.045
  const cx = 0.48, cy = 0.5, R = 0.045;
  const dx = nx - cx, dy = ny - cy;
  const r2 = dx * dx + dy * dy;
  const r = Math.sqrt(r2);
  const R2 = R * R;

  // Uniform flow (left-to-right)
  let vx = 1.0;
  let vy = 0.0;

  if (r > 0.001 && r2 > R2) {
    // Doublet: flow around cylinder of radius R
    const dot = dx * 1.0 + dy * 0.0; // dot with flow direction (1,0)
    const doubletStrength = R2;
    vx += doubletStrength * (r2 - 2 * dx * dx) / (r2 * r2);
    vy += doubletStrength * (-2 * dx * dy) / (r2 * r2);

    // Wake deficit behind the body (only for x > cx)
    if (dx > 0) {
      const wakeDecay = Math.exp(-dx / 0.12);
      const lateralGaussian = Math.exp(-(dy * dy) / (0.02 + dx * 0.15));
      vx -= 0.5 * wakeDecay * lateralGaussian;
    }
  } else if (r <= R * 0.3) {
    // Inside body center: stagnation
    vx = 0;
    vy = 0;
  } else {
    // On or very near the body surface: tangent flow
    const nr = r > 0.001 ? r : 0.001;
    const nx_dir = dx / nr, ny_dir = dy / nr;
    vx = -ny_dir;
    vy = nx_dir;
  }

  return { vx, vy };
}

export function updatePhysics() {
  const v = state.velocity;
  const T = state.temp;
  const depth = state.depth;

  state.rho = waterDensity(T);
  state.mu = waterViscosity(T);
  state.Pv = vaporPressure(T);
  state.Pamb = WATER.Patm + state.rho * 9.81 * depth;

  state.Re = state.rho * v * PROJ_LENGTH / state.mu;
  state.Cf = skinFrictionCf(state.Re);

  state.sigma = v > 0.01
    ? (state.Pamb - state.Pv) / (0.5 * state.rho * v * v)
    : 999;

  const drag = computeDragCoefficient(state.Re, state.sigma, v);
  state.Cd = drag.total;
  state.bubbleFraction = drag.bubbleFraction;
  state.bubbleLength = state.bubbleFraction * 2.0;
  state.dragForce = 0.5 * state.Cd * state.rho * v * v * 0.0707;
  state.frictionForce = 0.5 * state.Cf * state.rho * v * v * 1.979;
  state.power = state.dragForce * v;
  state.pressureDist = computePressureDistribution(v, state.sigma, state.bubbleFraction);

  if (state.sigma > CAV_CRIT_SIGMA * 1.5) state.regime = 'sub';
  else if (state.sigma > CAV_CRIT_SIGMA * 0.3) state.regime = 'transition';
  else state.regime = 'super';

}


