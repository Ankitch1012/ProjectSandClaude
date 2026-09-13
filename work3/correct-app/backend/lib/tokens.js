'use strict';

const ranges = require('./ranges');

// Reading a crib into lines the desk can work with.
//
// A crib is a preamble line, then one line per phrase. A phrase that will not
// fit on one line runs onto the following lines, which are indented by at least
// one space and belong to the phrase above them:
//
//   9-16 : 1s+2s dance RH across,
//           1s+2s dance LH across
//
// Both of those source lines are one phrase covering bars 9 to 16.
function classify(rawLine) {
  if (rawLine.trim() === '') {
    return 'blank';
  }
  if (/^\s*\*.*\*\s*$/.test(rawLine)) {
    return 'preamble';
  }
  if (/^\s/.test(rawLine)) {
    return 'continuation';
  }
  return 'phrase';
}

// Read the crib into phrases. Each phrase records every source line it was
// written across, and which of them it began on, because a fault found in a
// phrase belongs to the line the devisor started writing it on.
function read(text) {
  const rawLines = String(text).split(/\r\n|\r|\n/);
  const phrases = [];
  const preamble = [];
  const strays = [];

  for (let i = 0; i < rawLines.length; i += 1) {
    const rawLine = rawLines[i];
    const lineNumber = i + 1;
    const kind = classify(rawLine);

    if (kind === 'blank') {
      continue;
    }

    if (kind === 'preamble') {
      preamble.push({ line: lineNumber, text: rawLine.trim() });
      continue;
    }

    if (kind === 'continuation') {
      const open = phrases[phrases.length - 1];
      if (!open) {
        strays.push({ line: lineNumber, reason: 'continuation-without-phrase', text: rawLine.trim() });
        continue;
      }
      open.body += ` ${rawLine.trim()}`;
      open.lines.push(lineNumber);
      continue;
    }

    const parts = ranges.split(rawLine);
    if (!parts) {
      strays.push({ line: lineNumber, reason: 'no-bar-span', text: rawLine.trim() });
      continue;
    }

    phrases.push({
      body: parts.body,
      line: lineNumber,
      lines: [lineNumber],
      raw: rawLine,
      span: parts.span
    });
  }

  return { phrases, preamble, sourceLines: rawLines, strays };
}

module.exports = {
  classify,
  read
};
