'use strict';

const ranges = require('./ranges');

// Every bar of the dance has to be written down exactly once. The phrases run
// in order, the first opens on bar 1, the last closes on the final bar, and
// each phrase picks up where the one before it left off.
function nextExpected(span) {
  return span.to;
}

function check(phrases, danceBars) {
  const faults = [];

  if (phrases.length === 0) {
    faults.push({ bar: 1, kind: 'nothing-written', phrase: null });
    return faults;
  }

  const first = phrases[0];
  if (first.span.from !== 1) {
    faults.push({
      bar: 1,
      detail: { expected: 1, written: first.span.from },
      kind: 'dance-does-not-open-on-bar-1',
      phrase: first
    });
  }

  for (let i = 0; i < phrases.length; i += 1) {
    const current = phrases[i];
    const span = current.span;

    if (span.to < span.from) {
      faults.push({
        bar: span.from,
        detail: { span: ranges.format(span) },
        kind: 'bar-span-runs-backwards',
        phrase: current
      });
      continue;
    }

    const next = phrases[i + 1];
    if (!next) {
      continue;
    }

    const expected = nextExpected(span);
    if (next.span.from === expected) {
      continue;
    }

    if (next.span.from > expected) {
      faults.push({
        bar: expected,
        detail: { from: expected, to: next.span.from - 1 },
        kind: 'bars-not-written',
        phrase: next
      });
      continue;
    }

    faults.push({
      bar: next.span.from,
      detail: { from: next.span.from, to: Math.min(span.to, next.span.to) },
      kind: 'bars-written-twice',
      phrase: next
    });
  }

  const last = phrases[phrases.length - 1];
  if (last.span.to !== danceBars) {
    faults.push({
      bar: Math.min(last.span.to, danceBars),
      detail: { closes: last.span.to, expected: danceBars },
      kind: 'dance-does-not-close-on-last-bar',
      phrase: last
    });
  }

  return faults;
}

module.exports = {
  check,
  nextExpected
};
