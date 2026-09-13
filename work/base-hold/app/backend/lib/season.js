'use strict';

const interpret = require('./interpret');
const recordBook = require('./record-book');
const { describe, satisfied, unmet } = require('./eligibility');
const { eligibleRecords } = require('./records');
const {
  OPENING,
  RECORDS,
  SCALE_MAX,
  VISITS,
  optionById,
  stockLabel,
  stockScion,
  stocksTouchedBy,
  visitById
} = require('./story');

function newSession(id) {
  const session = {
    id,
    day: OPENING.day,
    light: OPENING.light,
    currentVisit: null,
    played: [],
    choices: {},
    entries: [],
    nextOrder: 1,
    basePage: null,
    baseRevision: 0,
    basedOn: {},
    conflict: null,
    plan: [],
    season: null
  };
  settlePlan(session);
  refresh(session);
  return session;
}

// The whole season, read back off the record of the work: the graft board, what
// each stock currently stands at, the three standings, which visits are open and
// which ways of entering the row are open.
function derive(session) {
  const entries = recordBook.ordered(session.entries);
  const folded = interpret.foldSeason(entries);

  const season = {
    entries,
    board: folded.board,
    current: folded.current,
    standings: folded.standings
  };

  season.open = session.plan || [];
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
}

// Called whenever the record has been written to, so that nothing downstream is
// ever reading a season that has been left behind.
function refresh(session) {
  session.season = derive(session);
  return session.season;
}

function seasonOf(session) {
  return session.season || refresh(session);
}

// What this visit has already put its hand to, so the panel can show what has
// been done here today and so coming back to a stock builds the card that is
// standing rather than starting another one.
function workedAt(session, visitId) {
  const here = {};
  recordBook
    .ordered(session.entries)
    .filter((entry) => entry.visit === visitId && entry.stock)
    .forEach((entry) => {
      here[entry.stock] = entry.act;
    });
  return here;
}

// Work is recorded, never accounted for on the spot. What a line does to the
// board and to the standings is worked out when the record is read back.
function applyEffect(session, visit, effect) {
  const stock = effect.stock;
  const worked = seasonOf(session).current[stock] || null;

  if (effect.act === 'graft') {
    const here = workedAt(session, visit.id);
    recordBook.append(
      session,
      recordBook.makeEntry(session, {
        visit: visit.id,
        act: here[stock] ? 'rewrapped' : 'bound',
        stock
      })
    );
    refresh(session);
    return;
  }

  if (!worked) {
    return;
  }

  if (effect.act === 'cutback') {
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

  const act = { release: 'released', leave: 'left' }[effect.act];
  if (!act) {
    return;
  }

  recordBook.append(session, recordBook.makeEntry(session, { visit: visit.id, act, stock }));
  refresh(session);
}

function enterVisit(session, visitId) {
  const visit = visitById(visitId);
  if (!visit) {
    return { error: 'no-such-visit', status: 404 };
  }
  if (!session.played.includes(visitId) && !session.plan.includes(visitId)) {
    return { error: 'visit-not-open', status: 409 };
  }
  session.currentVisit = visitId;
  return { ok: true, visit };
}

function completeVisit(session, visitId, optionId, options) {
  const forced = Boolean(options && options.forced);
  const visit = visitById(visitId);
  if (!visit) {
    return { error: 'no-such-visit', status: 404 };
  }
  const option = optionById(visit, optionId);
  if (!option) {
    return { error: 'no-such-choice', status: 404 };
  }

  const season = seasonOf(session);

  if (!forced && !session.plan.includes(visitId)) {
    return { error: 'visit-not-open', status: 409 };
  }
  if (!forced && option.showWhen && !satisfied(season, option.showWhen)) {
    return { error: 'choice-not-open', status: 409 };
  }

  if (!session.played.includes(visitId)) {
    session.played.push(visitId);
  }
  settlePlan(session);

  session.day = Math.max(session.day, visit.day);
  session.light = visit.light;
  session.currentVisit = visitId;
  session.choices[visitId] = option.id;

  (option.effects || []).forEach((effect) => applyEffect(session, visit, effect));
  refresh(session);

  return { ok: true, visit, option };
}

// Turning back to a visit that has already been walked reads it again. It is
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

function optionTakenAt(session, visitId) {
  return session.choices[visitId] || null;
}

function touchesFor(session, visit, season) {
  const here = workedAt(session, visit.id);
  return stocksTouchedBy(visit).map((stock) => {
    const worked = season.current[stock] || null;
    return {
      stock,
      label: stockLabel(stock),
      scion: stockScion(stock),
      state: worked ? worked.state : 'unworked',
      hold: worked ? worked.hold : 0,
      doneHere: here[stock] || null
    };
  });
}

function renderVisit(session, visitId, season) {
  const visit = visitById(visitId);
  if (!visit) {
    return null;
  }
  return {
    id: visit.id,
    title: visit.title,
    day: visit.day,
    light: visit.light,
    setting: visit.setting,
    line: visit.line,
    played: session.played.includes(visit.id),
    taken: optionTakenAt(session, visit.id),
    touches: touchesFor(session, visit, season),
    options: visit.options
      .filter((option) => !option.showWhen || satisfied(season, option.showWhen))
      .map((option) => ({ id: option.id, text: option.text }))
  };
}

function visitStatuses(session, season) {
  return VISITS.map((visit) => {
    let status = 'locked';
    if (session.played.includes(visit.id)) {
      status = 'done';
    } else if (season.open.includes(visit.id)) {
      status = 'open';
    }
    return {
      id: visit.id,
      title: visit.title,
      day: visit.day,
      light: visit.light,
      status,
      taken: optionTakenAt(session, visit.id),
      blockedBy: unmet(season, visit.requires).map(describe)
    };
  });
}

function renderBoard(session, season) {
  return season.board.map((card) => ({
    stock: card.stock,
    label: card.label,
    scion: card.scion,
    state: card.state,
    hold: card.hold,
    boundAt: card.boundAt,
    boundAtTitle: visitById(card.boundAt) ? visitById(card.boundAt).title : '',
    history: recordBook.forStock(session.entries, card.stock).map((entry) => ({
      day: entry.day,
      light: entry.light,
      act: entry.act,
      visit: entry.visit,
      visitTitle: visitById(entry.visit) ? visitById(entry.visit).title : ''
    }))
  }));
}

function render(session, season, extras) {
  return Object.assign(
    {
      hand: session.id,
      day: session.day,
      light: session.light,
      scaleMax: SCALE_MAX,
      standings: {
        canopy: season.standings.canopy,
        standing: season.standings.standing,
        deadwood: season.standings.deadwood
      },
      graftCount: season.board.length,
      currentVisit: session.currentVisit
        ? renderVisit(session, session.currentVisit, season)
        : null,
      board: renderBoard(session, season),
      visits: visitStatuses(session, season),
      records: RECORDS.map((record) => ({
        id: record.id,
        title: record.title,
        blurb: record.blurb,
        eligible: season.ways.includes(record.id)
      })),
      seasonRecord: recordBook.present(session.entries),
      basePage: session.basePage,
      baseRevision: session.baseRevision,
      conflict: session.conflict || null
    },
    extras || {}
  );
}

module.exports = {
  applyEffect,
  settlePlan,
  workedAt,
  completeVisit,
  derive,
  enterVisit,
  newSession,
  optionTakenAt,
  refresh,
  render,
  renderVisit,
  rereadVisit,
  seasonOf,
  visitStatuses
};
