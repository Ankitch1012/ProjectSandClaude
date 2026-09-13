'use strict';

const recordBook = require('./record-book');
const season = require('./season');

// Pages of the season notebook. Saving writes the whole season onto a page and
// moves that page on a revision; loading brings the whole season back off the
// paper. A window may only write onto the revision of the page it took up, so a
// page another window has moved on is never quietly written over.

function pageList(store) {
  return Array.from(store.pages.values())
    .sort((a, b) => (a.savedOnDay - b.savedOnDay) || a.id.localeCompare(b.id))
    .map((page) => ({
      id: page.id,
      label: page.label,
      revision: page.revision,
      savedOnDay: page.savedOnDay,
      savedInLight: page.savedInLight
    }));
}

function heldRevision(store, pageId) {
  const page = store.pages.get(pageId);
  return page ? page.revision : 0;
}

function takenUpAt(session, pageId) {
  return Object.prototype.hasOwnProperty.call(session.basedOn, pageId)
    ? session.basedOn[pageId]
    : 0;
}

function seasonOnPaper(session) {
  return {
    day: session.day,
    light: session.light,
    currentVisit: session.currentVisit,
    played: session.played.slice(),
    choices: Object.assign({}, session.choices),
    entries: session.entries.slice(),
    nextOrder: session.nextOrder
  };
}

function savePage(store, session, options) {
  const pageId = String((options && options.pageId) || '').trim();
  if (!pageId) {
    return { error: 'page-name-required', status: 400 };
  }

  const standing = heldRevision(store, pageId);
  const workingFrom = takenUpAt(session, pageId);

  if (standing !== workingFrom) {
    session.conflict = {
      pageId,
      pageRevision: standing,
      basedOnRevision: workingFrom
    };
    return { error: 'page-moved-on', status: 409, conflict: session.conflict };
  }

  const existing = store.pages.get(pageId);
  const revision = standing + 1;

  store.pages.set(pageId, {
    id: pageId,
    label: String((options && options.label) || (existing && existing.label) || pageId),
    revision,
    savedOnDay: session.day,
    savedInLight: session.light,
    snapshot: JSON.stringify(seasonOnPaper(session))
  });

  session.basedOn[pageId] = revision;
  session.basePage = pageId;
  session.baseRevision = revision;
  session.conflict = null;

  return { ok: true, page: store.pages.get(pageId) };
}

function loadPage(store, session, pageId) {
  const page = store.pages.get(String(pageId || ''));
  if (!page) {
    return { error: 'no-such-page', status: 404 };
  }

  const paper = JSON.parse(page.snapshot);

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

  session.basedOn[page.id] = page.revision;
  session.basePage = page.id;
  session.baseRevision = page.revision;
  session.conflict = null;

  season.refresh(session);

  return { ok: true, page };
}

module.exports = { loadPage, pageList, savePage, seasonOnPaper };
