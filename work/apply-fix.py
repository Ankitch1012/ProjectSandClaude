#!/usr/bin/env python3
"""Turn the Cleftwood base tree into the corrected implementation.

Run from environment/app. Reproducible so the reference patch can be
regenerated from base_commit at any time.
"""

import pathlib
import sys

HELD = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '../../../fixed-hold/app')


def edit(path, *pairs):
    p = pathlib.Path(path)
    s = p.read_text()
    for old, new in pairs:
        if old not in s:
            raise SystemExit(f'{path}: could not find\n{old[:160]}')
        s = s.replace(old, new)
    p.write_text(s)


# --- every charge lands on the scale as it happens, and a cut-back is owed back
edit(
    'backend/lib/standings.js',
    ("  'cut-back': { standing: -4 },", "  'cut-back': { standing: -4, deadwood: 3 },"),
    ('    standings[field] += delta[field];', '    standings[field] = clamp(standings[field] + delta[field]);'),
    ("""
// The three standings are kept on a nought-to-twenty scale.
function onScale(standings) {
  return {
    canopy: clamp(standings.canopy),
    standing: clamp(standings.standing),
    deadwood: clamp(standings.deadwood)
  };
}
""", ''),
    ('module.exports = { DELTAS, MEND_RELIEF, apply, applyAct, blank, clamp, onScale };',
     'module.exports = { DELTAS, MEND_RELIEF, apply, applyAct, blank, clamp };'),
)

# --- a release is part of the season, and coming back to a stock builds its card
edit(
    'backend/lib/interpret.js',
    ("""    if (entry.act === 'bound') {
      cards.set(stock, board.newCard(stock, entry.visit));
      standingsLib.applyAct(standings, 'bound');
      return;
    }

    if (entry.act === 'rewrapped') {
      if (held) {
        board.rewrapCard(held);
        standingsLib.applyAct(standings, 'rewrapped');
      }
      return;
    }""",
     """    if (entry.act === 'bound' || entry.act === 'rewrapped') {
      if (held) {
        board.rewrapCard(held);
        standingsLib.applyAct(standings, 'rewrapped');
      } else {
        cards.set(stock, board.newCard(stock, entry.visit));
        standingsLib.applyAct(standings, 'bound');
      }
      return;
    }"""),
    ("""    if (entry.act === 'cut-back') {""",
     """    if (entry.act === 'released') {
      const released = board.releaseCard(held);
      standingsLib.applyAct(standings, 'released', { mended: released.mended });
      return;
    }

    if (entry.act === 'cut-back') {"""),
    ('  return { board: cardList, current, standings: standingsLib.onScale(standings) };',
     '  return { board: cardList, current, standings };'),
)

# --- the place a line took in the season is a number and is compared as one
edit(
    'backend/lib/record-book.js',
    ('    order: String(order),', '    order,'),
    ('      || (a.order > b.order ? 1 : -1)', '      || (orderOf(a) - orderOf(b))'),
)

# --- the ways in are read off the row as it stands
records = pathlib.Path('backend/lib/records.js')
s = records.read_text()
s = s[:s.index('const settled = new Map();')] + """function eligibleRecords(view) {
  return RECORDS.filter((record) =>
    (record.requires || []).every((requirement) => meetsRecord(view, requirement))
  ).map((record) => record.id);
}

""" + s[s.index('module.exports ='):]
s = s.replace('module.exports = { eligibleRecords, forgetSettled, meetsRecord };',
              'module.exports = { eligibleRecords, meetsRecord };')
records.write_text(s)

# --- the plan belongs to the season, identity goes by stock, and a reading is a reading
edit(
    'backend/lib/season.js',
    ("""  season.open = session.plan || [];
  season.ways = eligibleRecords(session, season);

  return season;
}

// The plan is settled when the season moves, which is when a visit is written
// up. Reading the season back again does not change what is open.
function settlePlan(session) {
  const season = session.season || derive(session);
  session.plan = VISITS.filter(
    (visit) => !session.played.includes(visit.id) && satisfied(season, visit.requires)
  ).map((visit) => visit.id);
  return session.plan;
}""",
     """  season.open = VISITS.filter(
    (visit) => !session.played.includes(visit.id) && satisfied(season, visit.requires)
  ).map((visit) => visit.id);
  season.ways = eligibleRecords(season);

  return season;
}"""),
    ("""    conflict: null,
    plan: [],
    season: null
  };
  settlePlan(session);
  refresh(session);""",
     """    conflict: null,
    season: null
  };
  refresh(session);"""),
    ("""    const here = workedAt(session, visit.id);
    recordBook.append(
      session,
      recordBook.makeEntry(session, {
        visit: visit.id,
        act: here[stock] ? 'rewrapped' : 'bound',
        stock
      })
    );""",
     """    recordBook.append(
      session,
      recordBook.makeEntry(session, {
        visit: visit.id,
        act: worked ? 'rewrapped' : 'bound',
        stock
      })
    );"""),
    ("""  if (effect.act === 'cutback') {
    // The line that recorded the binding becomes the line that records the
    // stock being cut back, so the record carries one act per stock.
    const binding = session.entries.find(
      (entry) => entry.stock === stock && entry.act === 'bound'
    );
    if (binding) {
      binding.act = 'cut-back';
    } else {
      recordBook.append(
        session,
        recordBook.makeEntry(session, { visit: visit.id, act: 'cut-back', stock })
      );
    }
    refresh(session);
    return;
  }

  const act = { release: 'released', leave: 'left' }[effect.act];""",
     """  const act = { release: 'released', cutback: 'cut-back', leave: 'left' }[effect.act];"""),
    ("""  if (!session.played.includes(visitId) && !session.plan.includes(visitId)) {
    return { error: 'visit-not-open', status: 409 };
  }""",
     """  if (!session.played.includes(visitId) && !satisfied(seasonOf(session), visit.requires)) {
    return { error: 'visit-not-open', status: 409 };
  }"""),
    ("""  if (!forced && !session.plan.includes(visitId) && !session.played.includes(visitId)) {
    return { error: 'visit-not-open', status: 409 };
  }""",
     """  if (!forced && session.played.includes(visitId)) {
    return { error: 'visit-already-walked', status: 409 };
  }
  if (!forced && !satisfied(season, visit.requires)) {
    return { error: 'visit-not-open', status: 409 };
  }"""),
    ("""  if (!session.played.includes(visitId)) {
    session.played.push(visitId);
  }
  settlePlan(session);

  session.day""",
     """  if (!session.played.includes(visitId)) {
    session.played.push(visitId);
  }
  session.day"""),
    ('function optionTakenAt(session, visitId) {',
     """// Turning back to a visit that has already been walked reads it again. It is
// noted in the record as a reading and it changes nothing else: the season does
// not move, no stock is worked, and nothing is charged to the standings.
function rereadVisit(session, visitId) {
  const visit = visitById(visitId);
  if (!visit) {
    return { error: 'no-such-visit', status: 404 };
  }
  if (!session.played.includes(visitId)) {
    return { error: 'visit-not-walked', status: 409 };
  }
  recordBook.append(
    session,
    recordBook.makeEntry(session, { visit: visitId, act: 're-read', stock: null })
  );
  session.currentVisit = visitId;
  refresh(session);
  return { ok: true, visit };
}

function optionTakenAt(session, visitId) {"""),
    ("""module.exports = {
  applyEffect,
  settlePlan,
  workedAt,""",
     """module.exports = {
  applyEffect,
  rereadVisit,
  workedAt,"""),
)

# --- the whole season goes onto the page, and only the revision this window
# --- took up may be written onto
edit(
    'backend/lib/notebook.js',
    ("'use strict';\n", "'use strict';\n\nconst recordBook = require('./record-book');\nconst season = require('./season');\n"),
    ("""// The revision of the page this window is working from.
function takenUpAt(store, session, pageId) {
  const page = store.pages.get(pageId);
  return page ? page.revision : 0;
}""",
     """// The revision of the page this window took up, by writing it or by bringing
// it back. A window that has not taken this page up has nothing to write onto.
function takenUpAt(session, pageId) {
  return Object.prototype.hasOwnProperty.call(session.basedOn, pageId)
    ? session.basedOn[pageId]
    : 0;
}"""),
    ("""    choices: Object.assign({}, session.choices),
    entries: session.entries.slice()
  };""",
     """    choices: Object.assign({}, session.choices),
    entries: session.entries.slice(),
    nextOrder: session.nextOrder
  };"""),
    ('  const workingFrom = takenUpAt(store, session, pageId);',
     '  const workingFrom = takenUpAt(session, pageId);'),
    ("""  Object.assign(session, JSON.parse(page.snapshot));

  session.basedOn[page.id] = page.revision;""",
     """  const paper = JSON.parse(page.snapshot);

  session.day = paper.day;
  session.light = paper.light;
  session.currentVisit = paper.currentVisit;
  session.played = (paper.played || []).slice();
  session.choices = Object.assign({}, paper.choices || {});
  session.entries = recordBook.ordered(paper.entries || []);
  session.nextOrder = Math.max(
    paper.nextOrder || 1,
    recordBook.nextOrderAfter(session.entries)
  );

  session.basedOn[page.id] = page.revision;"""),
    ("""  session.conflict = null;

  return { ok: true, page };
}

module.exports""",
     """  session.conflict = null;

  season.refresh(session);

  return { ok: true, page };
}

module.exports"""),
)

# --- a reading has its own route, and a refused save reports the season back
edit(
    'backend/server.js',
    ("""    if (method === 'POST' && action === 'pages') {""",
     """    if (method === 'POST' && action === 'reread') {
      const body = await readBody(req);
      const outcome = season.rereadVisit(session, body.visitId);
      if (outcome.error) {
        failed(res, outcome);
        return;
      }
      send(res, 200, handView(session));
      return;
    }

    if (method === 'POST' && action === 'pages') {"""),
    ("""      const outcome = notebook.savePage(store, session, body);
      if (outcome.error) {
        failed(res, outcome);
        return;
      }""",
     """      const outcome = notebook.savePage(store, session, body);
      if (outcome.error) {
        // A refused save still reports the season back, so the window that was
        // working from an older revision can say so.
        if (outcome.status === 409) {
          send(res, 409, Object.assign({ error: outcome.error }, handView(session)));
          return;
        }
        failed(res, outcome);
        return;
      }"""),
)

# --- the shell reads a visit back instead of walking it again, and reports a
# --- refused save
held_app = (HELD / 'frontend/public/app.js').read_text()
conflict = held_app[held_app.index('function renderConflict(view) {'):held_app.index('function renderSeasonRecord(view) {')]
edit(
    'frontend/public/app.js',
    ('function renderSeasonRecord(view) {', conflict + 'function renderSeasonRecord(view) {'),
    ('  renderPages(view);\n  renderSeasonRecord(view);',
     '  renderPages(view);\n  renderConflict(view);\n  renderSeasonRecord(view);'),
    ("""// Walk a visit that has already been played back through, so the panel shows
// what was said and what was chosen that day.
function reread(visitId) {
  const visit = latest && latest.visits.find((row) => row.id === visitId);
  const taken = visit ? visit.taken : null;
  if (!taken) {
    return enter(visitId);
  }
  return guard(() => post(`/hands/${encodeURIComponent(HAND)}/choose`, { visitId, optionId: taken }));
}

function savePage(pageId) {
  return guard(() =>
    post(`/hands/${encodeURIComponent(HAND)}/pages`, { pageId, label: pageId })
  );
}""",
     """// Turn back to a visit that has already been walked and read it again. It is a
// reading, not a second day of work, so nothing about the season moves.
function reread(visitId) {
  return guard(() => post(`/hands/${encodeURIComponent(HAND)}/reread`, { visitId }));
}

async function savePage(pageId) {
  try {
    say('');
    render(await post(`/hands/${encodeURIComponent(HAND)}/pages`, { pageId, label: pageId }));
  } catch (error) {
    if (error.code === 'page-moved-on' && error.payload) {
      say('');
      render(error.payload);
      return;
    }
    say(error.message || 'Something went wrong in the orchard.');
  }
}"""),
)

# --- a narrow window lays the season out for a narrow window
held_css = (HELD / 'frontend/public/styles.css').read_text()
good = held_css[held_css.index('/* --- narrower windows'):]
css = pathlib.Path('frontend/public/styles.css')
s = css.read_text()
css.write_text(s[:s.index('/* --- narrower windows')] + good)

print('the corrected implementation is in place')
