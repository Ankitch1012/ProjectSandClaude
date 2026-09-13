'use strict';

const { balance, chargeEmpty, chargeFill, lowPounds, openAccount, readPounds } = require('./pounds');
const { gateMayOpen, paddleMayRaise } = require('./interlocks');
const { lockfulCuFt } = require('./water');
const {
  CHAMBERS,
  LADDER,
  chamberById,
  gateBetween,
  poundById,
  riseInches,
  riseLabel,
  rungIndex
} = require('./flight');

const OPERATIONS = [
  'open-head-gate',
  'shut-head-gate',
  'open-tail-gate',
  'shut-tail-gate',
  'raise-head-paddle',
  'drop-head-paddle',
  'raise-tail-paddle',
  'drop-tail-paddle',
  'boat-up',
  'boat-down'
];

// The flight as the keeper finds it at the start of the day: every chamber
// empty, every gate shut, every paddle down, and the boat on the tail water.
function atRest() {
  const chambers = {};
  CHAMBERS.forEach((chamber) => {
    chambers[chamber.id] = {
      levelIn: 0,
      headGate: 'shut',
      tailGate: 'shut',
      headPaddle: 'down',
      tailPaddle: 'down'
    };
  });
  return {
    chambers,
    boat: { kind: 'pound', id: 'tail' },
    account: openAccount(),
    worked: []
  };
}

function endOf(operation) {
  return operation.indexOf('-head-') >= 0 ? 'head' : 'tail';
}

function applyStep(state, step) {
  const operation = String(step.operation || '');
  if (OPERATIONS.indexOf(operation) === -1) {
    return { ok: false, reason: 'no-such-operation' };
  }

  if (operation === 'boat-up' || operation === 'boat-down') {
    return moveBoat(state, operation === 'boat-up' ? 1 : -1);
  }

  const chamber = chamberById(step.chamber);
  if (!chamber) {
    return { ok: false, reason: 'no-such-chamber' };
  }
  const held = state.chambers[chamber.id];
  const end = endOf(operation);
  const gateKey = end === 'head' ? 'headGate' : 'tailGate';
  const paddleKey = end === 'head' ? 'headPaddle' : 'tailPaddle';

  if (operation.indexOf('shut-') === 0) {
    held[gateKey] = 'shut';
    return { ok: true };
  }

  if (operation.indexOf('drop-') === 0) {
    held[paddleKey] = 'down';
    return { ok: true };
  }

  if (operation.indexOf('open-') === 0) {
    const allowed = gateMayOpen(state.chambers, chamber.id, end);
    if (!allowed.ok) {
      return allowed;
    }
    held[gateKey] = 'open';
    return { ok: true };
  }

  const allowed = paddleMayRaise(state.chambers, chamber.id, end);
  if (!allowed.ok) {
    return allowed;
  }
  held[paddleKey] = 'raised';
  runWater(state, chamber, end);
  return { ok: true };
}

// Raising a paddle draws a lockful in over the head or sends a lockful out at
// the tail. Where the water comes from or goes to is another chamber, the two
// share it across their wall and no pound is touched.
function runWater(state, chamber, end) {
  const rise = riseInches(chamber);
  const held = state.chambers[chamber.id];

  if (end === 'head') {
    held.levelIn = rise;
    if (chamber.above.kind === 'chamber') {
      state.chambers[chamber.above.id].levelIn = 0;
    }
    chargeFill(state.account, chamber);
    return;
  }

  held.levelIn = 0;
  if (chamber.below.kind === 'chamber') {
    const lower = chamberById(chamber.below.id);
    state.chambers[lower.id].levelIn = riseInches(lower);
  }
  chargeEmpty(state.account, chamber);
}

function moveBoat(state, direction) {
  const here = rungIndex(state.boat.kind, state.boat.id);
  const target = here + direction;
  if (target < 0 || target >= LADDER.length) {
    return { ok: false, reason: 'off-the-flight' };
  }

  const gate = gateBetween(direction > 0 ? here : target);
  if (!gate) {
    return { ok: false, reason: 'no-gate-there' };
  }
  const held = state.chambers[gate.chamber];
  const gateKey = gate.end === 'head' ? 'headGate' : 'tailGate';
  if (held[gateKey] !== 'open') {
    return { ok: false, reason: 'gate-shut' };
  }

  const leaving = state.boat;
  state.boat = LADDER[target];

  // A chamber is worked once the boat is out of it.
  if (leaving.kind === 'chamber' && state.worked.indexOf(leaving.id) === -1) {
    state.worked.push(leaving.id);
  }

  return { ok: true };
}

// The plan is checked in the order it was written. The first step that cannot
// be worked is refused, and nothing after it is worked.
function evaluate(plan) {
  const state = atRest();
  const steps = [];
  let refusal = null;

  for (let index = 0; index < plan.length; index += 1) {
    if (refusal) {
      steps.push({
        at: index,
        chamber: plan[index].chamber || null,
        operation: plan[index].operation,
        worked: false,
        reason: 'after-a-refusal'
      });
      continue;
    }
    const outcome = applyStep(state, plan[index]);
    steps.push({
      at: index,
      chamber: plan[index].chamber || null,
      operation: plan[index].operation,
      worked: outcome.ok,
      reason: outcome.reason || null
    });
    if (!outcome.ok) {
      refusal = {
        at: index,
        chamber: plan[index].chamber || null,
        operation: plan[index].operation,
        reason: outcome.reason
      };
    }
  }

  return { state, steps, refusal };
}

function render(plan) {
  const walked = evaluate(plan);
  const state = walked.state;

  return {
    steps: walked.steps,
    refusal: walked.refusal,
    boat: state.boat,
    worked: state.worked.slice(),
    complete: state.boat.kind === 'pound'
      && state.boat.id === 'summit'
      && CHAMBERS.every((chamber) => state.worked.indexOf(chamber.id) !== -1),
    chambers: CHAMBERS.map((chamber) => {
      const held = state.chambers[chamber.id];
      return {
        id: chamber.id,
        name: chamber.name,
        riseIn: riseInches(chamber),
        riseLabel: riseLabel(chamber),
        areaSqFt: chamber.areaSqFt,
        lockfulCuFt: lockfulCuFt(chamber),
        levelIn: held.levelIn,
        headGate: held.headGate,
        tailGate: held.tailGate,
        headPaddle: held.headPaddle,
        tailPaddle: held.tailPaddle,
        above: chamber.above,
        below: chamber.below,
        holdsBoat: state.boat.kind === 'chamber' && state.boat.id === chamber.id
      };
    }),
    pounds: readPounds(state.account).map((pound) => ({
      ...pound,
      holdsBoat: state.boat.kind === 'pound' && state.boat.id === pound.id
    })),
    lowPounds: lowPounds(state.account),
    account: balance(state.account, state.chambers)
  };
}

module.exports = { OPERATIONS, applyStep, atRest, evaluate, render };
