#!/usr/bin/env python3
"""Turn the correct Cribstave desk into the one the devisor is complaining about.

Eleven independent families, one per file, spread across the checking service
and the desk shell.
"""

import pathlib
import sys

APP = pathlib.Path(__file__).parent / "cribstave-dance-desk/environment/app"

PLANTS = []


def plant(tag, relative, old, new):
    PLANTS.append((tag, relative, old, new))


# ── D1 · ranges.js ─────────────────────────────────────────────────────────────
# Only one of the dashes a devisor might type is recognised, so a span written
# with an en dash is not read as a span at all.
plant(
    "D1",
    "backend/lib/ranges.js",
    "const DASHES = ['-', '\\u2013', '\\u2014'];",
    "const DASHES = ['-'];",
)

# ── D2 · tiling.js ────────────────────────────────────────────────────────────
# The bar a phrase hands on to is taken as its closing bar rather than the one
# after it, so contiguous phrases read as gapped and overlapping ones as sound.
plant(
    "D2",
    "backend/lib/tiling.js",
    "function nextExpected(span) {\n  return span.to + 1;\n}",
    "function nextExpected(span) {\n  return span.to;\n}",
)

# ── D3 · tokens.js ────────────────────────────────────────────────────────────
# A carried line replaces the phrase it belongs to instead of adding to it.
plant(
    "D3",
    "backend/lib/tokens.js",
    "      open.body += ` ${rawLine.trim()}`;",
    "      open.body = rawLine.trim();",
)

# ── D4 · phrase.js ────────────────────────────────────────────────────────────
# Figures are looked up only as far as the next punctuation, and whatever is
# left over after one has been read is taken for commentary.
plant(
    "D4",
    "backend/lib/phrase.js",
    """function isSeparator(ch) {
  return ch === ',' || ch === '.' || ch === ';' || /\\s/.test(ch);
}""",
    """function isSeparator(ch) {
  return ch === ',' || ch === '.' || ch === ';' || ch === '&' || /\\s/.test(ch);
}

// How far a figure may reach before the writing turns to something else.
function reach(body, from) {
  for (let i = from; i < body.length; i += 1) {
    const ch = body.charAt(i);
    if (ch === ',' || ch === ';' || ch === '&') {
      return i;
    }
  }
  return body.length;
}""",
)

plant(
    "D4",
    "backend/lib/phrase.js",
    """  let dancers = null;
  let whole = false;
  let bar = startBar;
  let i = 0;

  while (i < body.length) {
    if (isSeparator(body.charAt(i))) {
      i += 1;
      continue;
    }""",
    """  let dancers = null;
  let whole = false;
  let namedFigure = false;
  let bar = startBar;
  let i = 0;

  while (i < body.length) {
    const here = body.charAt(i);
    if (here === ',' || here === ';') {
      namedFigure = false;
      i += 1;
      continue;
    }
    if (isSeparator(here)) {
      i += 1;
      continue;
    }""",
)

plant(
    "D4",
    "backend/lib/phrase.js",
    """    const found = figures.matchAt(body, i);
    if (found) {
      clauses.push({""",
    """    const found = figures.matchAt(body.slice(0, reach(body, i)), i);
    if (found) {
      namedFigure = true;
      clauses.push({""",
)

plant(
    "D4",
    "backend/lib/phrase.js",
    """    const text = body.slice(i, end).trim();
    if (text !== '') {
      unknown.push({ bar, column: i, text });
    }""",
    """    const text = body.slice(i, end).trim();
    if (text !== '' && !namedFigure) {
      unknown.push({ bar, column: i, text });
    }""",
)

# ── D5 · set.js ───────────────────────────────────────────────────────────────
# Neighbours are worked out from the numbers the couples were given rather than
# from the places they are standing in.
plant(
    "D5",
    "backend/lib/set.js",
    "  const places = couples.map((couple) => placeOf(state, couple)).sort((a, b) => a - b);",
    "  const places = couples.slice().sort((a, b) => a - b);",
)

# ── D6 · check.js ─────────────────────────────────────────────────────────────
# What a figure asks of the set is tested against the top of the dance rather
# than against the bar the figure begins on.
plant(
    "D6",
    "backend/lib/check.js",
    "function checkPhrase(phrase, state, found) {",
    "function checkPhrase(phrase, state, found, top) {",
)

plant(
    "D6",
    "backend/lib/check.js",
    """    if (requires && requires.kind === 'adjacent' && clause.couples.length >= 2) {
      if (!set.areAdjacent(walking, clause.couples)) {""",
    """    if (requires && requires.kind === 'adjacent' && clause.couples.length >= 2) {
      if (!set.areAdjacent(top, clause.couples)) {""",
)

plant(
    "D6",
    "backend/lib/check.js",
    """      const couple = clause.couples[0];
      if (!set.isInPlace(walking, couple, requires.place)) {""",
    """      const couple = clause.couples[0];
      if (!set.isInPlace(top, couple, requires.place)) {""",
)

plant(
    "D6",
    "backend/lib/check.js",
    "            standing: set.placeOf(walking, couple)",
    "            standing: set.placeOf(top, couple)",
)

plant(
    "D6",
    "backend/lib/check.js",
    """  let state = set.opening(crossed);
  const walked = read.phrases.map((phrase) => {
    const outcome = checkPhrase(phrase, state, found);""",
    """  let state = set.opening(crossed);
  const top = set.opening(crossed);
  const walked = read.phrases.map((phrase) => {
    const outcome = checkPhrase(phrase, state, found, top);""",
)

# ── D7 · progress.js ──────────────────────────────────────────────────────────
# One place standing right is taken for the whole set having handed on.
plant(
    "D7",
    "backend/lib/progress.js",
    "  const matches = finished.every((couple, index) => couple === target[index]);",
    "  const matches = finished.some((couple, index) => couple === target[index]);",
)

# ── D8 · preamble.js ──────────────────────────────────────────────────────────
# Only one of the two ways a devisor writes the crossed-over line is honoured.
plant(
    "D8",
    "backend/lib/preamble.js",
    "const COUPLE_LIST = /(\\d\\s*s?(?:\\s*\\+\\s*\\d\\s*s?)*)\\s*(?:start(?:ing)?\\s*)?on\\s+opposite\\s+sides?/i;",
    "const COUPLE_LIST = /(\\d\\s*s?(?:\\s*\\+\\s*\\d\\s*s?)*)\\s*start(?:ing)?\\s+on\\s+opposite\\s+sides?/i;",
)

# ── D9 · faults.js ────────────────────────────────────────────────────────────
# A fault is filed under the bar its phrase opens on instead of the bar of the
# figure that is actually wrong.
plant(
    "D9",
    "backend/lib/faults.js",
    """    kept.push({
      bar: fault.bar,""",
    """    kept.push({
      bar: fault.phrase && fault.phrase.span ? fault.phrase.span.from : fault.bar,""",
)

# ── D10 · app.js ──────────────────────────────────────────────────────────────
# The desk found everything but the report only ever shows the first of them.
plant(
    "D10",
    "frontend/public/app.js",
    """  const faultedLines = {};
  report.faults.forEach((fault) => {""",
    """  const faultedLines = {};
  report.faults.slice(0, 1).forEach((fault) => {""",
)

plant(
    "D10",
    "frontend/public/app.js",
    """function renderFaults(report) {
  clear(el.faults);

  el.verdict.textContent = report.good
    ? `The crib is sound: ${report.bars} bars, and the set hands on ${report.closing.join('-')}.`
    : `${report.faults.length} ${report.faults.length === 1 ? 'fault' : 'faults'} to answer for.`;
  el.verdict.setAttribute('data-good', report.good ? 'yes' : 'no');
  el.verdict.setAttribute('data-fault-count', String(report.faults.length));

  report.faults.forEach((fault) => {""",
    """function renderFaults(report) {
  clear(el.faults);

  const listed = report.faults.slice(0, 1);

  el.verdict.textContent = report.good
    ? `The crib is sound: ${report.bars} bars, and the set hands on ${report.closing.join('-')}.`
    : `${listed.length} ${listed.length === 1 ? 'fault' : 'faults'} to answer for.`;
  el.verdict.setAttribute('data-good', report.good ? 'yes' : 'no');
  el.verdict.setAttribute('data-fault-count', String(listed.length));

  listed.forEach((fault) => {""",
)

# ── D11 · styles.css ──────────────────────────────────────────────────────────
# The margin numbering is set to a different rhythm from the writing it counts,
# and the heading of the set diagram to a different set of columns from the
# couples underneath it.
plant(
    "D11",
    "frontend/public/styles.css",
    """.gutterline,
.sourceline {
  height: var(--row);
  line-height: var(--row);
}

.gutterline {
  color: var(--ink-soft);""",
    """.sourceline {
  height: var(--row);
  line-height: var(--row);
}

.gutterline {
  height: 1.35rem;
  line-height: 1.35rem;
  color: var(--ink-soft);""",
)

plant(
    "D11",
    "frontend/public/styles.css",
    """.setrow.head {
  border-bottom: 1px solid var(--rule);
  margin-bottom: 0.3rem;
  padding-bottom: 0.4rem;
}""",
    """.setrow.head {
  border-bottom: 1px solid var(--rule);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 0.3rem;
  padding-bottom: 0.4rem;
}""",
)


def main():
    failures = []
    touched = {}
    spare = None
    if "--except" in sys.argv:
        spare = sys.argv[sys.argv.index("--except") + 1]

    for tag, relative, old, new in PLANTS:
        if tag == spare:
            continue
        path = APP / relative
        text = path.read_text(encoding="utf-8")
        if text.count(old) != 1:
            failures.append(f"{tag} {relative}: found {text.count(old)} matches, wanted exactly 1")
            continue
        path.write_text(text.replace(old, new), encoding="utf-8")
        touched.setdefault(tag, set()).add(relative)

    if failures:
        print("PLANT FAILED")
        for line in failures:
            print(f"  {line}")
        return 1

    for tag in sorted(touched, key=lambda t: int(t[1:])):
        print(f"  {tag}: {', '.join(sorted(touched[tag]))}")
    print(f"planted {len(touched)} families across {len({r for s in touched.values() for r in s})} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
