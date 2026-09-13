'use strict';

const API_PORT = new URLSearchParams(window.location.search).get('apiPort') || '5000';
const API = `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api`;

const ui = {
  analyze: document.querySelector('#analyze'),
  anchorElevation: document.querySelector('#anchor-elevation'),
  anchorGlyphs: document.querySelector('#anchor-glyphs'),
  anchorSelect: document.querySelector('#anchor-select'),
  anchorTargets: document.querySelector('#anchor-targets'),
  ashGross: document.querySelector('#ash-gross'),
  ashTare: document.querySelector('#ash-tare'),
  bagMesh: document.querySelector('#bag-mesh'),
  channelMap: document.querySelector('#channel-map'),
  coarseAfdm: document.querySelector('#coarse-afdm'),
  coarseLoss: document.querySelector('#coarse-loss'),
  datum: document.querySelector('#datum'),
  disposition: document.querySelector('#disposition'),
  dryGross: document.querySelector('#dry-gross'),
  dryTare: document.querySelector('#dry-tare'),
  filter: document.querySelector('#filter'),
  fineAfdm: document.querySelector('#fine-afdm'),
  fineLoss: document.querySelector('#fine-loss'),
  loadedMass: document.querySelector('#loaded-mass'),
  notice: document.querySelector('#notice'),
  pairContrast: document.querySelector('#pair-contrast'),
  pairReason: document.querySelector('#pair-reason'),
  pairStatus: document.querySelector('#pair-status'),
  reachMean: document.querySelector('#reach-mean'),
  reachN: document.querySelector('#reach-n'),
  selectedAnchor: document.querySelector('#selected-anchor'),
  stageBands: document.querySelector('#stage-bands'),
  stageQuality: document.querySelector('#stage-quality'),
  studyTitle: document.querySelector('#study-title'),
  summaryNote: document.querySelector('#summary-note'),
  wetDuration: document.querySelector('#wet-duration')
};

const model = {
  analysis: null,
  cachedMapWidth: null,
  filter: 'all',
  selectedBagMesh: 'coarse',
  selectedIndex: 0,
  study: null
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with ${response.status}.`);
  }
  return body;
}

function showNotice(message, tone = 'neutral') {
  ui.notice.textContent = message;
  ui.notice.dataset.tone = tone;
  ui.notice.classList.add('visible');
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => ui.notice.classList.remove('visible'), 3500);
}

function anchorById(anchorId) {
  return model.study.anchors.find((anchor) => anchor.id === anchorId);
}

function pairByAnchor(anchorId) {
  return model.analysis.pairs.find((pair) => pair.anchor_id === anchorId);
}

function bagsForAnchor(anchorId) {
  return model.study.bags.filter((bag) => bag.anchor_id === anchorId);
}

function visibleAnchors() {
  return model.study.anchors.filter((anchor) => {
    const pair = pairByAnchor(anchor.id);
    if (model.filter === 'eligible') return pair && pair.eligible;
    if (model.filter === 'ineligible') return !pair || !pair.eligible;
    if (model.filter === 'intact') {
      const bags = bagsForAnchor(anchor.id);
      return bags.length === 2 && bags.every((bag) => bag.disposition === 'intact');
    }
    return true;
  });
}

function selectedAnchor() {
  const visible = visibleAnchors();
  if (!visible.length) return null;
  if (model.selectedIndex >= visible.length) model.selectedIndex = 0;
  return visible[model.selectedIndex];
}

function mapPoint(anchor) {
  const x = 90 + (anchor.x / 85) * 1030;
  const y = 338 - ((anchor.bed_elevation - 0.75) / 0.8) * 240;
  return { x, y };
}

function renderStageBands() {
  const bands = model.study.anchors.map((anchor) => {
    const point = mapPoint(anchor);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(Math.max(55, point.x - 95)));
    line.setAttribute('x2', String(Math.min(1160, point.x + 95)));
    line.setAttribute('y1', String(point.y - 28));
    line.setAttribute('y2', String(point.y - 28));
    line.setAttribute('stroke', '#70c8cb');
    line.setAttribute('stroke-width', '16');
    line.setAttribute('stroke-opacity', '0.22');
    line.setAttribute('aria-label', `Stage exceedance band for anchor ${anchor.id}`);
    return line;
  });
  ui.stageBands.replaceChildren(...bands);
}

function renderAnchors() {
  const visibleIds = new Set(visibleAnchors().map((anchor) => anchor.id));
  const selected = selectedAnchor();
  const glyphs = model.study.anchors.map((anchor) => {
    const point = mapPoint(anchor);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', `translate(${point.x} ${point.y})`);
    group.setAttribute('role', 'img');
    group.setAttribute('aria-label', `Anchor ${anchor.id} spatial glyph`);
    group.setAttribute('opacity', visibleIds.has(anchor.id) ? '1' : '0.12');
    group.innerHTML = `
      <line x1="0" y1="-64" x2="0" y2="8" stroke="#384a45" stroke-width="4"/>
      <circle cx="0" cy="-67" r="7" fill="#e8ad50"/>
      <rect x="-34" y="-47" width="29" height="37" rx="5" fill="#c58a42" stroke="#fff1cf" stroke-width="3"/>
      <path d="M-30 -41h21M-30 -32h21M-30 -23h21" stroke="#ffe2ad" stroke-width="2"/>
      <rect x="5" y="-47" width="29" height="37" rx="5" fill="#3f8b86" stroke="#d9ffff" stroke-width="3"/>
      <path d="M10 -40h19M10 -34h19M10 -28h19M10 -22h19" stroke="#bfe3df" stroke-width="1"/>
      <text x="0" y="28" text-anchor="middle" fill="#f6f0dc" font-size="16" font-weight="800">${anchor.id}</text>
      ${selected && selected.id === anchor.id ? '<circle cx="0" cy="-25" r="47" fill="none" stroke="#ffcf6d" stroke-width="4"/>' : ''}
    `;
    return group;
  });
  ui.anchorGlyphs.replaceChildren(...glyphs);

  if (model.cachedMapWidth === null) {
    model.cachedMapWidth = ui.channelMap.clientWidth;
  }
  const width = model.cachedMapWidth || 1200;
  const height = width * (430 / 1200);
  const targets = model.study.anchors.map((anchor, index) => {
    const point = mapPoint(anchor);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'anchor-target';
    button.setAttribute('aria-label', `Select anchor ${anchor.id}`);
    button.hidden = !visibleIds.has(anchor.id);
    button.style.left = `${(point.x / 1200) * width - 30}px`;
    button.style.top = `${(point.y / 430) * height - 74}px`;
    button.addEventListener('click', () => {
      model.selectedIndex = index;
      render();
    });
    return button;
  });
  ui.anchorTargets.replaceChildren(...targets);
}

function formatPercent(value) {
  if (value === null || value === undefined) return 'Unavailable';
  return `${(value * 100).toFixed(1)}%`;
}

function renderSelected() {
  const anchor = selectedAnchor();
  if (!anchor) {
    ui.selectedAnchor.textContent = 'No anchor selected';
    ui.anchorElevation.textContent = '—';
    ui.wetDuration.textContent = '—';
    ui.pairStatus.textContent = 'Hidden by filter';
    ui.pairContrast.textContent = '—';
    ui.pairReason.textContent = 'The selected anchor is not visible in this view.';
    return;
  }
  const pair = pairByAnchor(anchor.id);
  ui.selectedAnchor.textContent = `Anchor ${anchor.id}`;
  ui.anchorElevation.textContent = `${anchor.bed_elevation.toFixed(2)} m`;
  const wet = pair && pair.coarse ? pair.coarse.wet_minutes : null;
  ui.wetDuration.textContent = wet === null ? 'Indeterminate' : `${Number(wet).toFixed(1)} min estimated`;
  ui.pairStatus.textContent = pair && pair.eligible ? 'Eligible pair' : 'Ineligible pair';
  ui.pairContrast.textContent = pair ? formatPercent(pair.contrast) : 'Unavailable';
  ui.coarseLoss.textContent = pair && pair.coarse ? formatPercent(pair.coarse.mass.proportional_loss) : 'Unavailable';
  ui.fineLoss.textContent = pair && pair.fine ? formatPercent(pair.fine.mass.proportional_loss) : 'Unavailable';
  ui.coarseAfdm.textContent = pair && pair.coarse ? `AFDM ${pair.coarse.mass.recovered_afdm.toFixed(2)} g` : 'AFDM unavailable';
  ui.fineAfdm.textContent = pair && pair.fine ? `AFDM ${pair.fine.mass.recovered_afdm.toFixed(2)} g` : 'AFDM unavailable';
  ui.pairReason.textContent = pair && pair.eligible
    ? 'Colocated pair contributes one equal-weight contrast to the reach.'
    : ((pair && (pair.reason || pair.coarse?.reason || pair.fine?.reason)) || 'Pair is unavailable.');
  syncBagControls();
}

function selectedBag() {
  const anchor = selectedAnchor();
  if (!anchor) return null;
  return bagsForAnchor(anchor.id).find((bag) => bag.mesh === model.selectedBagMesh) || null;
}

function syncBagControls() {
  const bag = selectedBag();
  ui.bagMesh.value = model.selectedBagMesh;
  if (!bag) return;
  ui.disposition.value = bag.disposition;
  ui.loadedMass.value = bag.loaded_mass;
  const recovery = bag.recovery || {};
  ui.dryGross.value = recovery.dry_gross ?? '';
  ui.dryTare.value = recovery.dry_tare ?? '';
  ui.ashGross.value = recovery.ash_gross ?? '';
  ui.ashTare.value = recovery.ash_tare ?? '';
}

function renderSummary() {
  const summary = model.analysis.summary;
  ui.reachMean.textContent = summary.available
    ? formatPercent(summary.mean_contrast)
    : 'Unavailable';
  ui.reachN.textContent = summary.available ? String(summary.n) : '—';
  ui.summaryNote.textContent = summary.available
    ? 'Descriptive paired contrast; no causal attribution.'
    : 'No eligible paired anchors are available.';
}

function renderAnchorSelect() {
  ui.anchorSelect.replaceChildren(...model.study.anchors.map((anchor) => {
    const option = document.createElement('option');
    option.value = anchor.id;
    option.textContent = `Anchor ${anchor.id} · x ${anchor.x.toFixed(0)} m`;
    return option;
  }));
  const anchor = selectedAnchor();
  ui.anchorSelect.value = anchor ? anchor.id : '';
}

function render() {
  ui.studyTitle.textContent = model.study.title;
  ui.datum.textContent = model.study.datum;
  ui.stageQuality.textContent = model.analysis.stage_quality.issues.length
    ? 'Indeterminate segments'
    : `${model.analysis.stage_quality.point_count} usable readings`;
  renderAnchorSelect();
  renderStageBands();
  renderAnchors();
  renderSelected();
  renderSummary();
}

function applyControlValues() {
  const bag = selectedBag();
  if (!bag) return;
  bag.disposition = ui.disposition.value;
  bag.loaded_mass = Number(ui.loadedMass.value);
  if (bag.disposition === 'lost') {
    bag.recovery = null;
    return;
  }
  bag.recovery = {
    dry_gross: Number(ui.dryGross.value),
    dry_tare: Number(ui.dryTare.value),
    ash_gross: Number(ui.ashGross.value),
    ash_tare: Number(ui.ashTare.value)
  };
}

async function analyzeReach() {
  applyControlValues();
  ui.analyze.disabled = true;
  ui.analyze.textContent = 'Analyzing…';
  try {
    const result = await request('/analyze', {
      method: 'POST',
      body: JSON.stringify({ study: model.study })
    });
    model.study = clone(result.study);
    model.analysis = result.analysis;
    render();
    showNotice('Estimated hydroperiod and paired recovery updated.', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    ui.analyze.disabled = false;
    ui.analyze.textContent = 'Analyze current reach';
  }
}

async function load() {
  try {
    const result = await request('/study');
    model.study = clone(result.study);
    model.analysis = result.analysis;
    model.cachedMapWidth = ui.channelMap.clientWidth;
    render();
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

ui.anchorSelect.addEventListener('change', () => {
  const index = visibleAnchors().findIndex((anchor) => anchor.id === ui.anchorSelect.value);
  model.selectedIndex = Math.max(0, index);
  render();
});

ui.bagMesh.addEventListener('change', () => {
  model.selectedBagMesh = ui.bagMesh.value;
  syncBagControls();
});

ui.filter.addEventListener('change', () => {
  model.filter = ui.filter.value;
  render();
});

ui.analyze.addEventListener('click', analyzeReach);

load();
