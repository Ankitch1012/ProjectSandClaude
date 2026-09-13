#!/usr/bin/env python3
"""Apply exactly one family's fix to the base tree, to measure what a single
plausible edit clears. Run from environment/app with the family key as argv[1].
"""

import pathlib
import sys

KEY = sys.argv[1]


def edit(path, old, new):
    p = pathlib.Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'{path}: could not find\n{old[:160]}')
    p.write_text(s.replace(old, new, 1))


if KEY == 'lockful':
    # the single most visible symptom: every lockful twelve times too large
    edit('backend/lib/water.js',
         '  return chamber.areaSqFt * riseInches(chamber);',
         '  return (chamber.areaSqFt * riseInches(chamber)) / INCHES_PER_FOOT;')

elif KEY == 'layout':
    css = pathlib.Path('frontend/public/styles.css')
    s = css.read_text()
    good = pathlib.Path('../../../fixed-hold/app/frontend/public/styles.css').read_text()
    css.write_text(s[:s.index('/* --- narrower windows')] + good[good.index('/* --- narrower windows'):])

elif KEY == 'interlocks':
    edit('backend/lib/interlocks.js',
         """  const nearGate = end === 'head' ? state.headGate : state.tailGate;
  if (nearGate === 'open') {
    return { ok: false, reason: 'gate-still-open' };
  }""",
         """  if (state.headGate === 'open' || state.tailGate === 'open') {
    return { ok: false, reason: 'gate-still-open' };
  }""")
    edit('backend/lib/interlocks.js',
         """  if (inside !== beyond) {
    return { ok: false, reason: 'water-not-level' };
  }
  return { ok: true };""",
         """  if (inside !== beyond) {
    return { ok: false, reason: 'water-not-level' };
  }
  if (state.headPaddle === 'raised' || state.tailPaddle === 'raised') {
    return { ok: false, reason: 'paddle-still-raised' };
  }
  return { ok: true };""")

elif KEY == 'account':
    edit('backend/lib/pounds.js',
         """  if (to && to.kind === 'pound' && account[to.id]) {
    account[to.id].delivered += 0;
  }""",
         """  if (to && to.kind === 'pound' && account[to.id]) {
    account[to.id].delivered += cuFt;
  }""")

elif KEY == 'attribution':
    edit('backend/lib/pounds.js',
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
}""",
         """function chargeFill(account, chamber) {
  moveWater(account, chamber.above, { kind: 'chamber', id: chamber.id }, lockfulCuFt(chamber));
}""")

else:
    raise SystemExit(f'unknown family key: {KEY}')

print(f'applied only the {KEY} fix')
