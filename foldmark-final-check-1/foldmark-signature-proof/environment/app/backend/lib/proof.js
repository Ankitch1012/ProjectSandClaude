'use strict';

const crypto = require('crypto');
const { buildImposition } = require('./signatures');
const { buildGeometry, clearGeometryCache } = require('./geometry');

const proofCache = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cacheKey(state) {
  return JSON.stringify({
    pageCount: state.settings.pageCount,
    binding: state.settings.binding,
    sheet: state.settings.sheet,
    orientation: state.settings.orientation,
    fold: state.settings.fold,
    assignments: state.assignments || {}
  });
}

function allSlots(imposition) {
  return imposition.sheets.flatMap((sheet) => [...sheet.front, ...sheet.back]);
}

function validate(state, imposition) {
  const slots = allSlots(imposition);
  const pages = slots.map((slot) => slot.page);
  const expected = Array.from({ length: state.settings.pageCount }, (_, index) => index + 1);
  const numericPages = pages.filter((page) => Number.isInteger(page));
  const uniquePages = [...new Set(numericPages)].sort((a, b) => a - b);
  const complete = pages.length === state.settings.pageCount
    && uniquePages.length === expected.length
    && uniquePages.every((page, index) => page === expected[index]);
  const signatureCapacity = state.settings.binding === 'section-sewn' ? 8 : state.settings.pageCount;
  const boundariesComplete = state.settings.pageCount % 4 === 0
    && (state.settings.binding !== 'section-sewn' || state.settings.pageCount % signatureCapacity === 0);
  const bleedValid = Number(state.settings.bleed) >= 0 && Number(state.settings.bleed) <= 12;
  const issues = [];

  if (!complete) {
    issues.push('Every physical slot must contain one unique source page.');
  }
  if (!boundariesComplete) {
    issues.push('Each signature must be complete for its selected binding.');
  }
  if (!bleedValid) {
    issues.push('Bleed must remain within the supported production range.');
  }

  return {
    valid: issues.length === 0,
    complete,
    boundariesComplete,
    bleedValid,
    issues
  };
}

function proofFingerprint(state, imposition, geometry, validation) {
  const material = JSON.stringify({ state, imposition, geometry, validation });
  return crypto.createHash('sha256').update(material).digest('hex').slice(0, 12).toUpperCase();
}

function buildProof(state) {
  const key = cacheKey(state);
  if (proofCache.has(key)) {
    return clone(proofCache.get(key));
  }

  const imposition = buildImposition(state);
  const geometry = buildGeometry(state, imposition);
  const validation = validate(state, imposition);
  const proof = {
    imposition,
    geometry,
    validation,
    fingerprint: proofFingerprint(state, imposition, geometry, validation)
  };

  proofCache.set(key, clone(proof));
  return proof;
}

function clearProofCache() {
  proofCache.clear();
  clearGeometryCache();
}

module.exports = {
  buildProof,
  clearProofCache
};
