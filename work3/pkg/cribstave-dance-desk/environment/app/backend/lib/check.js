'use strict';

const faults = require('./faults');
const phraseReader = require('./phrase');
const preamble = require('./preamble');
const progress = require('./progress');
const ranges = require('./ranges');
const set = require('./set');
const tiling = require('./tiling');
const tokens = require('./tokens');

const DEFAULT_BARS = 32;

// Read a crib, dance it in the head, and say everything that is wrong with it.
function checkPhrase(phrase, state, found, top) {
  const scanned = phraseReader.scan(phrase.body, phrase.span.from);
  const gives = ranges.length(phrase.span);
  let walking = state;

  scanned.unknown.forEach((entry) => {
    found.push({
      bar: entry.bar,
      detail: { text: entry.text },
      kind: 'figure-not-in-the-book',
      phrase
    });
  });

  if (gives !== null && scanned.bars !== gives) {
    found.push({
      bar: phrase.span.from,
      detail: { gives, needs: scanned.bars, span: phrase.span },
      kind: scanned.bars > gives ? 'phrase-longer-than-its-bars' : 'phrase-shorter-than-its-bars',
      phrase
    });
  }

  scanned.clauses.forEach((clause) => {
    const requires = clause.figure.requires;

    if (requires && requires.kind === 'adjacent' && clause.couples.length >= 2) {
      if (!set.areAdjacent(top, clause.couples)) {
        found.push({
          bar: clause.bar,
          detail: { couples: clause.couples, figure: clause.figure.name },
          kind: 'couples-not-neighbours',
          phrase
        });
      }
    }

    if (requires && requires.kind === 'place' && clause.couples.length >= 1) {
      const couple = clause.couples[0];
      if (!set.isInPlace(top, couple, requires.place)) {
        found.push({
          bar: clause.bar,
          detail: {
            couples: clause.couples,
            figure: clause.figure.name,
            place: requires.place,
            standing: set.placeOf(top, couple)
          },
          kind: 'wrong-place-for-figure',
          phrase
        });
      }
    }

    if (requires && requires.kind === 'whole' && clause.couples.length !== set.COUPLES.length) {
      found.push({
        bar: clause.bar,
        detail: { couples: clause.couples, figure: clause.figure.name },
        kind: 'whole-set-not-named',
        phrase
      });
    }

    const moved = set.apply(walking, clause.figure.movement, clause.couples);
    if (moved.state) {
      walking = moved.state;
      return;
    }

    found.push({
      bar: clause.bar,
      detail: {
        couples: clause.couples,
        figure: clause.figure.name,
        place: clause.couples.length ? set.placeOf(walking, clause.couples[0]) : null
      },
      kind: moved.reason,
      phrase
    });
  });

  return {
    crossedAfter: set.crossedNow(walking),
    figures: scanned.clauses.map((clause) => ({
      bar: clause.bar,
      couples: clause.couples,
      name: clause.figure.name
    })),
    gives,
    line: phrase.line,
    lines: phrase.lines.slice(),
    needs: scanned.bars,
    orderAfter: set.order(walking),
    span: ranges.format(phrase.span),
    state: walking
  };
}

function check(text, requestedBars) {
  const danceBars = Number.isFinite(requestedBars) && requestedBars > 0 ? Math.floor(requestedBars) : DEFAULT_BARS;
  const read = tokens.read(text);
  ranges.closeOpenSpans(read.phrases, danceBars);

  const crossed = preamble.crossedCouples(read.preamble);
  const found = [];

  read.strays.forEach((stray) => {
    found.push({
      bar: null,
      detail: { text: stray.text },
      kind: stray.reason,
      phrase: { line: stray.line, lines: [stray.line] }
    });
  });

  if (read.phrases.length > 0 || read.strays.length === 0) {
    tiling.check(read.phrases, danceBars).forEach((fault) => found.push(fault));
  }

  let state = set.opening(crossed);
  const top = set.opening(crossed);
  const walked = read.phrases.map((phrase) => {
    const outcome = checkPhrase(phrase, state, found, top);
    state = outcome.state;
    return outcome;
  });

  if (read.phrases.length > 0) {
    const last = read.phrases[read.phrases.length - 1];

    // Whoever the preamble sent across the dance has to be brought home again
    // before the last bar, or the next couple through starts on the wrong side.
    const stranded = set.crossedNow(state);
    if (stranded.length > 0) {
      found.push({
        bar: danceBars,
        detail: { couples: stranded },
        kind: 'couples-finish-on-the-wrong-side',
        phrase: last
      });
    }

    const stumble = progress.check(state, danceBars);
    if (stumble) {
      found.push(Object.assign({}, stumble, { phrase: last }));
    }
  }

  const collected = faults.collect(found);

  return {
    bars: danceBars,
    closing: set.order(state),
    closingCrossed: set.crossedNow(state),
    crossed,
    faults: collected,
    good: collected.length === 0,
    opening: set.order(set.opening(crossed)),
    phrases: walked.map((entry) => ({
      crossedAfter: entry.crossedAfter,
      figures: entry.figures,
      gives: entry.gives,
      line: entry.line,
      lines: entry.lines,
      needs: entry.needs,
      orderAfter: entry.orderAfter,
      span: entry.span
    })),
    preamble: read.preamble.map((entry) => entry.text),
    source: read.sourceLines
  };
}

module.exports = {
  DEFAULT_BARS,
  check
};
