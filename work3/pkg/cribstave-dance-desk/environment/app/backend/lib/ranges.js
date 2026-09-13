'use strict';

// A crib line opens with the bars it covers, then a colon, then the figures.
//
//   1-8 : 1s+2s circle 4H round & back
//   9–16 : 1s lead down the middle & back
//   17– : 1s+2s poussette
//
// Devisors write the span with a dash, and may leave the closing bar off
// entirely, in which case the line runs to the bar before the next line
// starts, or to the end of the dance if it is the last one.
const DASHES = ['-'];

function dashAt(text, from) {
  for (let i = 0; i < DASHES.length; i += 1) {
    if (text.charAt(from) === DASHES[i]) {
      return DASHES[i];
    }
  }
  return null;
}

// Split "9–16 : 1s lead down..." into its span and its figures. Returns null
// when the line does not open with a bar span at all.
function split(line) {
  const colon = line.indexOf(':');
  if (colon === -1) {
    return null;
  }
  const head = line.slice(0, colon).trim();
  const body = line.slice(colon + 1).trim();
  const span = parseSpan(head);
  if (!span) {
    return null;
  }
  return { body, bodyColumn: colon + 1, span };
}

// "1-8" -> { from: 1, to: 8 }, "17–" -> { from: 17, to: null }
function parseSpan(head) {
  const match = /^(\d+)\s*(.?)\s*(\d*)$/.exec(head);
  if (!match) {
    return null;
  }
  const from = Number(match[1]);
  const separator = match[2];
  const closing = match[3];

  if (separator === '' && closing === '') {
    return { from, to: from };
  }
  if (!dashAt(separator, 0)) {
    return null;
  }
  if (closing === '') {
    return { from, to: null };
  }
  return { from, to: Number(closing) };
}

// Lines written with an open span borrow their closing bar from whatever comes
// next, so a crib is only fully spanned once every line has been read.
function closeOpenSpans(lines, danceBars) {
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].span.to !== null) {
      continue;
    }
    const next = lines[i + 1];
    lines[i].span.to = next ? next.span.from - 1 : danceBars;
  }
  return lines;
}

function length(span) {
  if (!span || span.to === null) {
    return null;
  }
  return span.to - span.from + 1;
}

function format(span) {
  if (!span) {
    return '';
  }
  return span.to === null ? `${span.from}-` : `${span.from}-${span.to}`;
}

module.exports = {
  closeOpenSpans,
  format,
  length,
  parseSpan,
  split
};
