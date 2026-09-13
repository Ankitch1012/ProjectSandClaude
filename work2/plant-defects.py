#!/usr/bin/env python3
"""Turn the correct Bywash tree into the shipped base.

Run from environment/app. Eleven families across five files and two layers.
Kept in the workspace, never in the package.
"""

import pathlib


def edit(path, *pairs):
    p = pathlib.Path(path)
    s = p.read_text()
    for old, new in pairs:
        if old not in s:
            raise SystemExit(f'{path}: could not find\n{old[:200]}')
        s = s.replace(old, new, 1)
    p.write_text(s)


# --- D1  the level a gate is judged against is the one that end of the chamber
# --- sits at, which is only the water above where a pound is what lies above
# --- D11 a gate is opened without looking at the paddles
edit(
    'backend/lib/interlocks.js',
    ("const { chamberById, riseInches, surfaceOf } = require('./flight');",
     "const { DATUMS, chamberById, riseInches, surfaceOf } = require('./flight');"),
    ("""  const inside = surfaceOf(chambers, { kind: 'chamber', id: chamberId });
  const beyond = surfaceOf(chambers, end === 'head' ? chamber.above : chamber.below);

  if (inside !== beyond) {
    return { ok: false, reason: 'water-not-level' };
  }
  if (state.headPaddle === 'raised' || state.tailPaddle === 'raised') {
    return { ok: false, reason: 'paddle-still-raised' };
  }
  return { ok: true };""",
     """  const inside = surfaceOf(chambers, { kind: 'chamber', id: chamberId });
  const beyond = end === 'head'
    ? DATUMS.chambers[chamberId].head
    : DATUMS.chambers[chamberId].tail;

  if (inside !== beyond) {
    return { ok: false, reason: 'water-not-level' };
  }
  return { ok: true };"""),
    # --- D2  the paddle looks at the gate on its own end of the chamber
    ("""  if (state.headGate === 'open' || state.tailGate === 'open') {
    return { ok: false, reason: 'gate-still-open' };
  }

  const rise = riseInches(chamber);""",
     """  const nearGate = end === 'head' ? state.headGate : state.tailGate;
  if (nearGate === 'open') {
    return { ok: false, reason: 'gate-still-open' };
  }

  const rise = riseInches(chamber);"""),
)

# --- D3  the rise is already in inches when the lockful is worked out
# --- D4  a pound standing exactly at its permitted depth is called too low
edit(
    'backend/lib/water.js',
    ("  return (chamber.areaSqFt * riseInches(chamber)) / INCHES_PER_FOOT;",
     "  return chamber.areaSqFt * riseInches(chamber);"),
    ("  return round2(drawnIn) <= pound.permittedDrawIn;",
     "  return round2(drawnIn) < pound.permittedDrawIn;"),
)

# --- D5  a chamber filling is charged to the water at its tail
# --- D6  what lies above the lower chamber of a staircase is taken to be the
# ---     pound that feeds the pair
# --- D7  water sent back into a pound is not put to its credit
edit(
    'backend/lib/pounds.js',
    ("""  if (to && to.kind === 'pound' && account[to.id]) {
    account[to.id].delivered += cuFt;
  }""",
     """  if (to && to.kind === 'pound' && account[to.id]) {
    account[to.id].delivered += 0;
  }"""),
    ("""function chargeFill(account, chamber) {
  moveWater(account, chamber.above, { kind: 'chamber', id: chamber.id }, lockfulCuFt(chamber));
}""",
     """function chargeFill(account, chamber) {
  const drawnFrom = chamber.above.kind === 'chamber'
    ? feedingPound(chamber)
    : chamber.below;
  moveWater(account, drawnFrom, { kind: 'chamber', id: chamber.id }, lockfulCuFt(chamber));
}

// The pound that feeds a staircase stands above the upper chamber of the pair.
function feedingPound(chamber) {
  const above = chamberById(chamber.above.id);
  return above ? above.above : chamber.above;
}"""),
)

# --- D8  the plan is walked through to the end and the refusal that stands is
# ---     the last one
# --- D9  a chamber is counted as worked when its head gate is opened
edit(
    'backend/lib/passage.js',
    ("""  for (let index = 0; index < plan.length; index += 1) {
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
    const outcome = applyStep(state, plan[index]);""",
     """  for (let index = 0; index < plan.length; index += 1) {
    const outcome = applyStep(state, plan[index]);"""),
    ("""    if (operation.indexOf('open-') === 0) {
    const allowed = gateMayOpen(state.chambers, chamber.id, end);
    if (!allowed.ok) {
      return allowed;
    }
    held[gateKey] = 'open';
    return { ok: true };
  }""".replace('    if (operation', '  if (operation'),
     """  if (operation.indexOf('open-') === 0) {
    const allowed = gateMayOpen(state.chambers, chamber.id, end);
    if (!allowed.ok) {
      return allowed;
    }
    held[gateKey] = 'open';
    if (end === 'head' && state.worked.indexOf(chamber.id) === -1) {
      state.worked.push(chamber.id);
    }
    return { ok: true };
  }"""),
    ("""  const leaving = state.boat;
  state.boat = LADDER[target];

  // A chamber is worked once the boat is out of it.
  if (leaving.kind === 'chamber' && state.worked.indexOf(leaving.id) === -1) {
    state.worked.push(leaving.id);
  }

  return { ok: true };""",
     """  state.boat = LADDER[target];
  return { ok: true };"""),
)

# --- D10  the narrow window
css = pathlib.Path('frontend/public/styles.css')
s = css.read_text()
s = s[:s.index('/* --- narrower windows')] + """/* --- narrower windows --------------------------------------------------- */

@media (max-width: 1100px) {
  .yard {
    grid-template-columns: minmax(0, 1fr);
  }

  .stage {
    height: 230px;
  }

  .chamber {
    left: 20%;
    min-height: 74px;
    right: 4%;
  }

  .chamber-name {
    background: none;
    max-width: 92px;
    overflow: hidden;
    padding: 0;
  }

  .plan {
    left: 12px;
    max-height: 62vh;
    overflow: hidden;
    position: fixed;
    top: 120px;
    width: 340px;
    z-index: 40;
  }

  .account {
    bottom: 0;
    left: 0;
    margin: 0;
    position: fixed;
    right: 0;
    z-index: 50;
  }
}
"""
css.write_text(s)

print('the eleven families are planted')
