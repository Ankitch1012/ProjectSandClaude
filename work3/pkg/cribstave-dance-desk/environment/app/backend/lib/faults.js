'use strict';

const ranges = require('./ranges');

// Everything the desk has to say about a crib comes back as a fault, and a
// fault is only useful if it points at the right piece of writing.
//
// A phrase may be written across several source lines. The fault belongs to the
// line the devisor started the phrase on, because that is the line holding the
// bar span the fault is about, not whichever line the desk happened to stop
// reading on.
function lineOf(phrase) {
  if (!phrase) {
    return null;
  }
  return phrase.line;
}

const WORDING = {
  'bar-span-runs-backwards': (fault) => `bar span ${fault.detail.span} runs backwards`,
  'bars-not-written': (fault) =>
    fault.detail.from === fault.detail.to
      ? `bar ${fault.detail.from} is not written`
      : `bars ${fault.detail.from} to ${fault.detail.to} are not written`,
  'bars-written-twice': (fault) =>
    fault.detail.from === fault.detail.to
      ? `bar ${fault.detail.from} is written twice`
      : `bars ${fault.detail.from} to ${fault.detail.to} are written twice`,
  'couples-finish-on-the-wrong-side': (fault) =>
    `${couples(fault.detail.couples)} finish the dance on the wrong side and are never brought back`,
  'couples-not-neighbours': (fault) =>
    `${couples(fault.detail.couples)} are not standing next to each other at bar ${fault.bar}`,
  'dance-does-not-close-on-last-bar': (fault) =>
    `the dance closes on bar ${fault.detail.closes} but runs to bar ${fault.detail.expected}`,
  'dance-does-not-open-on-bar-1': (fault) => `the dance opens on bar ${fault.detail.written} instead of bar 1`,
  'dance-does-not-progress': (fault) =>
    `after the last bar the set stands ${fault.detail.finished.join('-')} and the dance cannot be danced again`,
  'figure-not-in-the-book': (fault) => `"${fault.detail.text}" is not a figure the desk knows`,
  'no-bar-span': () => 'this line has no bar span',
  'no-room-below': (fault) => `${couples(fault.detail.couples)} cannot cast down from ${ordinal(fault.detail.place)} place`,
  'no-room-above': (fault) => `${couples(fault.detail.couples)} cannot cast up from ${ordinal(fault.detail.place)} place`,
  'nothing-written': () => 'the crib is empty',
  'phrase-longer-than-its-bars': (fault) =>
    `the figures need ${fault.detail.needs} bars but ${ranges.format(fault.detail.span)} gives ${fault.detail.gives}`,
  'phrase-shorter-than-its-bars': (fault) =>
    `the figures fill ${fault.detail.needs} bars of the ${fault.detail.gives} that ${ranges.format(fault.detail.span)} allows`,
  'wrong-place-for-figure': (fault) =>
    `${couples(fault.detail.couples)} are in ${ordinal(fault.detail.standing)} place at bar ${fault.bar}, not ${ordinal(fault.detail.place)}`,
  'continuation-without-phrase': () => 'this line is indented but there is no phrase above it for it to continue',
  'whole-set-not-named': (fault) => `${couples(fault.detail.couples)} cannot dance a figure written for the whole set`
};

function ordinal(place) {
  return ['', '1st', '2nd', '3rd', '4th'][place] || String(place);
}

function couples(list) {
  if (!list || list.length === 0) {
    return 'nobody';
  }
  return list.map((couple) => `${couple}s`).join('+');
}

function describe(fault) {
  const wording = WORDING[fault.kind];
  return wording ? wording(fault) : fault.kind;
}

// Faults read in the order the dance is danced, and a phrase that is wrong in
// two ways says so once for each.
function collect(raw) {
  const seen = {};
  const kept = [];

  raw.forEach((fault) => {
    const line = lineOf(fault.phrase);
    const key = `${fault.kind}|${fault.bar}|${line}|${JSON.stringify(fault.detail || null)}`;
    if (seen[key]) {
      return;
    }
    seen[key] = true;
    kept.push({
      bar: fault.phrase && fault.phrase.span ? fault.phrase.span.from : fault.bar,
      detail: fault.detail || null,
      kind: fault.kind,
      line,
      message: describe(fault)
    });
  });

  return kept.sort((a, b) => {
    const barA = a.bar === null ? -1 : a.bar;
    const barB = b.bar === null ? -1 : b.bar;
    if (barA !== barB) {
      return barA - barB;
    }
    return (a.line || 0) - (b.line || 0);
  });
}

module.exports = {
  collect,
  describe,
  lineOf,
  ordinal
};
