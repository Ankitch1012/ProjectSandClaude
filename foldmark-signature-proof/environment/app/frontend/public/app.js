'use strict';

const API_PORT = new URLSearchParams(window.location.search).get('apiPort') || '5000';
const API = `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api`;
const JOB_ID = 'atlas-field-guide';

const elements = {
  binding: document.querySelector('#binding'),
  bleed: document.querySelector('#bleed'),
  clearSlot: document.querySelector('#clear-slot'),
  fold: document.querySelector('#fold-plan'),
  jobName: document.querySelector('#job-name'),
  metricBleed: document.querySelector('#metric-bleed'),
  metricDuplex: document.querySelector('#metric-duplex'),
  metricFold: document.querySelector('#metric-fold'),
  metricSheet: document.querySelector('#metric-sheet'),
  nextSheet: document.querySelector('#next-sheet'),
  notice: document.querySelector('#notice'),
  operationList: document.querySelector('#operation-list'),
  orientation: document.querySelector('#orientation'),
  pageCount: document.querySelector('#page-count'),
  previousSheet: document.querySelector('#previous-sheet'),
  proofFingerprint: document.querySelector('#proof-fingerprint'),
  proofStage: document.querySelector('#proof-stage'),
  regenerate: document.querySelector('#regenerate'),
  releaseNote: document.querySelector('#release-note'),
  releaseProof: document.querySelector('#release-proof'),
  releaseTarget: document.querySelector('#release-target'),
  reopenJob: document.querySelector('#reopen-job'),
  revisionBadge: document.querySelector('#revision-badge'),
  saveRevision: document.querySelector('#save-revision'),
  saveState: document.querySelector('#save-state'),
  sheetPosition: document.querySelector('#sheet-position'),
  sheetSize: document.querySelector('#sheet-size'),
  signatureHeading: document.querySelector('#signature-heading'),
  slotA: document.querySelector('#slot-a'),
  slotB: document.querySelector('#slot-b'),
  swapPages: document.querySelector('#swap-pages'),
  validationCard: document.querySelector('#validation-card'),
  validationIssues: document.querySelector('#validation-issues'),
  validationKicker: document.querySelector('#validation-kicker'),
  validationStatus: document.querySelector('#validation-status')
};

const controlOperations = new Map([
  [elements.pageCount, 'Page count changed'],
  [elements.binding, 'Binding changed'],
  [elements.sheetSize, 'Paper changed'],
  [elements.orientation, 'Orientation changed'],
  [elements.fold, 'Fold plan changed'],
  [elements.bleed, 'Bleed changed']
]);

const model = {
  currentSheet: 0,
  dirty: false,
  draft: null,
  needsRegeneration: false,
  pendingOperations: [],
  proof: null,
  server: null
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function stateFromControls() {
  return {
    settings: {
      pageCount: Number(elements.pageCount.value),
      binding: elements.binding.value,
      sheet: elements.sheetSize.value,
      orientation: elements.orientation.value,
      bleed: Number(elements.bleed.value),
      fold: elements.fold.value
    },
    assignments: clone((model.draft && model.draft.assignments) || {})
  };
}

function applyControls(state) {
  elements.pageCount.value = String(state.settings.pageCount);
  elements.binding.value = state.settings.binding;
  elements.sheetSize.value = state.settings.sheet;
  elements.orientation.value = state.settings.orientation;
  elements.bleed.value = String(state.settings.bleed);
  elements.fold.value = state.settings.fold;
}

function addOperation(label) {
  model.pendingOperations.push({
    label,
    logicalTime: model.server.revision,
    sequence: model.pendingOperations.length + 1
  });
}

function handleControlChange(event) {
  if (!model.draft) {
    return;
  }
  const structural = event.currentTarget === elements.pageCount
    || event.currentTarget === elements.binding;
  if (structural) {
    model.draft.assignments = {};
  }
  model.draft = stateFromControls();
  model.dirty = true;
  model.needsRegeneration = true;
  addOperation(controlOperations.get(event.currentTarget) || 'Proof changed');
  renderStatus();
}

function showNotice(message, tone = 'neutral') {
  elements.notice.textContent = message;
  elements.notice.dataset.tone = tone;
  elements.notice.classList.add('is-visible');
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    elements.notice.classList.remove('is-visible');
  }, 4500);
}

function allSlots() {
  if (!model.proof) {
    return [];
  }
  return model.proof.imposition.sheets.flatMap((sheet) => [...sheet.front, ...sheet.back]);
}

function slotLabel(slot) {
  const side = slot.side === 'front' ? 'Front' : 'Back';
  const position = slot.position === 'left' ? 'left' : 'right';
  const page = Number.isInteger(slot.page) ? `P${slot.page}` : 'blank';
  return `Signature ${slot.signature} · Sheet ${slot.sheet} · ${side} ${position} (${page})`;
}

function populateAssignmentControls() {
  const slots = allSlots();
  const previousA = elements.slotA.value;
  const previousB = elements.slotB.value;
  const options = slots.map((slot) => {
    const option = document.createElement('option');
    option.value = slot.id;
    option.textContent = slotLabel(slot);
    return option;
  });

  elements.slotA.replaceChildren(...options.map((option) => option.cloneNode(true)));
  elements.slotB.replaceChildren(...options.map((option) => option.cloneNode(true)));

  const ids = new Set(slots.map((slot) => slot.id));
  elements.slotA.value = ids.has(previousA) ? previousA : (slots[0] ? slots[0].id : '');
  elements.slotB.value = ids.has(previousB) ? previousB : (slots[1] ? slots[1].id : '');
}

function mmPercent(value, total) {
  return `${((value / total) * 100).toFixed(4)}%`;
}

function makeMarker(marker, geometry, kind) {
  const line = document.createElement('span');
  line.className = `sheet-guide sheet-guide-${kind}`;
  line.style.left = mmPercent(marker.xMm, geometry.sheet.widthMm);
  line.setAttribute('role', 'img');
  line.setAttribute(
    'aria-label',
    `${kind === 'fold' ? 'Fold' : 'Cut'} guide at ${Number(marker.xMm.toFixed(1))} mm`
  );
  return line;
}

function makePageSlot(slot, region, geometry, surface) {
  const group = document.createElement('div');
  const pageLabel = Number.isInteger(slot.page) ? `page ${slot.page}` : 'blank';
  group.className = `page-slot page-slot-${region.position}`;
  group.setAttribute('role', 'group');
  group.setAttribute(
    'aria-label',
    `${surface.sideLabel} sheet ${surface.sheet} ${region.position} slot, ${pageLabel}`
  );
  group.style.left = mmPercent(region.xMm, geometry.sheet.widthMm);
  group.style.top = mmPercent(region.yMm, geometry.sheet.heightMm);
  group.style.width = mmPercent(region.widthMm, geometry.sheet.widthMm);
  group.style.height = mmPercent(region.heightMm, geometry.sheet.heightMm);

  const bleed = document.createElement('span');
  bleed.className = 'bleed-boundary';
  bleed.setAttribute('aria-label', `Bleed boundary ${geometry.bleedMm} mm`);
  bleed.style.left = mmPercent(
    region.bleedBox.xMm - region.xMm,
    geometry.sheet.widthMm
  );
  bleed.style.top = mmPercent(
    region.bleedBox.yMm - region.yMm,
    geometry.sheet.heightMm
  );
  bleed.style.width = mmPercent(region.bleedBox.widthMm, geometry.sheet.widthMm);
  bleed.style.height = mmPercent(region.bleedBox.heightMm, geometry.sheet.heightMm);

  const folio = document.createElement('strong');
  folio.className = 'page-number';
  folio.textContent = Number.isInteger(slot.page) ? `P${slot.page}` : 'BLANK';

  const location = document.createElement('span');
  location.className = 'slot-location';
  location.textContent = `${surface.sideLabel.toUpperCase()} · ${region.position.toUpperCase()}`;

  const crop = document.createElement('span');
  crop.className = 'crop-corners';
  crop.setAttribute('aria-hidden', 'true');

  group.append(bleed, crop, folio, location);
  return group;
}

function makeSurface(side, sheet, geometry) {
  const sideLabel = side === 'front' ? 'Front' : 'Back';
  const article = document.createElement('article');
  article.className = `press-sheet press-sheet-${side}`;
  article.setAttribute('aria-label', `${sideLabel} sheet ${sheet.sheet}`);
  article.style.aspectRatio = `${geometry.sheet.widthMm} / ${geometry.sheet.heightMm}`;

  const label = document.createElement('div');
  label.className = 'surface-label';
  label.innerHTML = `<span>${sideLabel.toUpperCase()}</span><small>PRESS SIDE · ${model.proof.imposition.duplexTurn.replace('-', ' ').toUpperCase()}</small>`;
  article.append(label);

  const surface = {
    sideLabel,
    sheet: sheet.sheet
  };
  const slots = side === 'front' ? sheet.front : sheet.back;
  geometry.trimRegions.forEach((region, index) => {
    article.append(makePageSlot(slots[index], region, geometry, surface));
  });
  geometry.markers.folds.forEach((marker) => article.append(makeMarker(marker, geometry, 'fold')));
  geometry.markers.cuts.forEach((marker) => article.append(makeMarker(marker, geometry, 'cut')));

  const grain = document.createElement('span');
  grain.className = 'paper-grain';
  grain.setAttribute('aria-hidden', 'true');
  article.append(grain);
  return article;
}

function renderProof() {
  if (!model.proof) {
    return;
  }

  const sheets = model.proof.imposition.sheets;
  model.currentSheet = Math.max(0, Math.min(model.currentSheet, sheets.length - 1));
  const current = sheets[model.currentSheet];
  const geometry = model.proof.geometry;
  elements.proofStage.replaceChildren(
    makeSurface('front', current, geometry),
    makeSurface('back', current, geometry)
  );

  elements.signatureHeading.textContent = `Signature ${current.signature} · Sheet ${current.sheet}`;
  elements.sheetPosition.textContent = `${model.currentSheet + 1} / ${sheets.length}`;
  elements.previousSheet.disabled = model.currentSheet === 0;
  elements.nextSheet.disabled = model.currentSheet === sheets.length - 1;

  const foldPositions = geometry.markers.folds
    .map((marker) => `${Number(marker.xMm.toFixed(1))} mm`)
    .join(' · ');
  elements.metricSheet.textContent = `${geometry.sheet.name} · ${geometry.sheet.widthMm} × ${geometry.sheet.heightMm} mm`;
  elements.metricDuplex.textContent = model.proof.imposition.duplexTurn.replace('-', ' ');
  elements.metricBleed.textContent = `${geometry.bleedMm} mm`;
  elements.metricFold.textContent = foldPositions || 'None';
  elements.proofFingerprint.textContent = model.proof.fingerprint;
  populateAssignmentControls();
}

function renderValidation() {
  const validation = model.proof.validation;
  elements.validationCard.dataset.valid = String(validation.valid);
  elements.validationKicker.textContent = validation.valid ? 'CURRENT PROOF' : 'PROOF HOLD';
  elements.validationStatus.textContent = validation.valid ? 'Production checks pass' : 'Signature is incomplete';
  elements.validationIssues.replaceChildren();

  const messages = validation.issues.length
    ? validation.issues
    : ['Physical slots are complete.', 'Sheet geometry is within production limits.'];
  messages.forEach((message) => {
    const item = document.createElement('li');
    item.textContent = message;
    elements.validationIssues.append(item);
  });
}

function renderOperations() {
  elements.operationList.replaceChildren();
  model.server.operations.slice(-8).forEach((operation) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const sequence = document.createElement('small');
    label.textContent = operation.label;
    sequence.textContent = `cycle ${operation.logicalTime} · ${operation.ordinal}`;
    item.append(label, sequence);
    elements.operationList.append(item);
  });
}

function renderStatus() {
  if (!model.server || !model.proof) {
    return;
  }
  elements.jobName.textContent = model.server.name;
  elements.revisionBadge.textContent = `R${model.server.revision}`;
  elements.saveState.textContent = model.needsRegeneration
    ? 'Regeneration required'
    : (model.dirty ? 'Unsaved proof' : 'Saved revision');
  elements.saveState.dataset.state = model.needsRegeneration
    ? 'warning'
    : (model.dirty ? 'dirty' : 'saved');

  const target = model.server.release.validatedRevision;
  elements.releaseTarget.textContent = target ? `Validated R${target}` : 'No validated revision';
  elements.releaseNote.textContent = model.server.release.releasedRevision
    ? `Released revision R${model.server.release.releasedRevision}.`
    : 'Release uses the validated revision shown above.';
  elements.releaseProof.disabled = !model.server.release.eligible;
  elements.saveRevision.disabled = model.needsRegeneration;
}

function render() {
  applyControls(model.draft);
  renderProof();
  renderValidation();
  renderOperations();
  renderStatus();
}

async function loadJob(showConfirmation = false) {
  try {
    const job = await api(`/jobs/${JOB_ID}`);
    model.server = job;
    model.draft = clone(job.state);
    model.proof = clone(job.proof);
    model.dirty = false;
    model.needsRegeneration = false;
    model.pendingOperations = [];
    model.currentSheet = 0;
    render();
    if (showConfirmation) {
      showNotice(`Reopened saved revision R${job.revision}.`, 'success');
    }
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function regenerate() {
  try {
    model.draft = stateFromControls();
    elements.regenerate.disabled = true;
    elements.regenerate.textContent = 'Regenerating…';
    const result = await api(`/jobs/${JOB_ID}/preview`, {
      method: 'POST',
      body: JSON.stringify({ state: model.draft })
    });
    model.draft = clone(result.state);
    model.proof = clone(result.proof);
    model.dirty = true;
    model.needsRegeneration = false;
    model.currentSheet = Math.min(model.currentSheet, model.proof.imposition.sheets.length - 1);
    render();
    showNotice('Proof regenerated from the current controls.', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    elements.regenerate.disabled = false;
    elements.regenerate.innerHTML = '<span>Regenerate proof</span><span aria-hidden="true">↗</span>';
  }
}

function findSlot(id) {
  return allSlots().find((slot) => slot.id === id);
}

async function swapPages() {
  const first = findSlot(elements.slotA.value);
  const second = findSlot(elements.slotB.value);
  if (!first || !second || first.id === second.id) {
    showNotice('Choose two different physical slots.', 'error');
    return;
  }
  model.draft.assignments[first.id] = second.page;
  model.draft.assignments[second.id] = first.page;
  addOperation('Pages reassigned');
  model.dirty = true;
  model.needsRegeneration = false;
  await regenerate();
}

async function clearFirstSlot() {
  const first = findSlot(elements.slotA.value);
  if (!first) {
    showNotice('Choose a physical slot first.', 'error');
    return;
  }
  model.draft.assignments[first.id] = null;
  addOperation('Page slot cleared');
  model.dirty = true;
  model.needsRegeneration = false;
  await regenerate();
}

async function saveRevision() {
  if (model.needsRegeneration) {
    showNotice('Regenerate the proof before saving this setup.', 'error');
    return;
  }
  try {
    elements.saveRevision.disabled = true;
    const saved = await api(`/jobs/${JOB_ID}`, {
      method: 'PUT',
      body: JSON.stringify({
        expectedRevision: model.server.revision,
        state: model.draft,
        proofFingerprint: model.proof.fingerprint,
        operations: model.pendingOperations
      })
    });
    model.server = saved;
    model.draft = clone(saved.state);
    model.proof = clone(saved.proof);
    model.dirty = false;
    model.needsRegeneration = false;
    model.pendingOperations = [];
    render();
    showNotice(`Saved revision R${saved.revision}.`, 'success');
  } catch (error) {
    const message = error.status === 409
      ? `Revision conflict: ${error.message}`
      : error.message;
    showNotice(message, 'error');
  } finally {
    elements.saveRevision.disabled = model.needsRegeneration;
  }
}

async function releaseProof() {
  try {
    const released = await api(`/jobs/${JOB_ID}/release`, {
      method: 'POST',
      body: JSON.stringify({ revision: model.server.revision })
    });
    model.server = released;
    model.draft = clone(released.state);
    model.proof = clone(released.proof);
    render();
    showNotice(`Released revision R${released.release.releasedRevision}.`, 'success');
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

controlOperations.forEach((_, control) => {
  control.addEventListener('change', handleControlChange);
});
elements.regenerate.addEventListener('click', regenerate);
elements.swapPages.addEventListener('click', swapPages);
elements.clearSlot.addEventListener('click', clearFirstSlot);
elements.saveRevision.addEventListener('click', saveRevision);
elements.reopenJob.addEventListener('click', () => loadJob(true));
elements.releaseProof.addEventListener('click', releaseProof);
elements.previousSheet.addEventListener('click', () => {
  model.currentSheet -= 1;
  renderProof();
});
elements.nextSheet.addEventListener('click', () => {
  model.currentSheet += 1;
  renderProof();
});

loadJob();
