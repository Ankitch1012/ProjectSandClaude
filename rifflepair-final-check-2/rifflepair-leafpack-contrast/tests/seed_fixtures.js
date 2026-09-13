#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const OUTPUT = process.env.FIXTURE_PATH || '/logs/verifier/fixture.json';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function measurement(afdm) {
  return {
    dry_gross: Number((afdm + 1.2).toFixed(3)),
    dry_tare: 0.2,
    ash_gross: 1.2,
    ash_tare: 0.2
  };
}

function bag(id, anchorId, mesh, afdm, elevation, deployment, retrieval) {
  return {
    id,
    anchor_id: anchorId,
    site: 'RIFFLE-7',
    batch: 'APR26',
    species: 'ALDER',
    mesh,
    cohort: 'C1',
    replicate: anchorId,
    elevation,
    threshold: Number((elevation + 0.1).toFixed(3)),
    deployment,
    retrieval,
    loaded_mass: 10,
    recovery: measurement(afdm),
    disposition: 'intact'
  };
}

function control(id, mesh, ratio = 0.8, loaded = 10, overrides = {}) {
  return {
    id,
    site: 'RIFFLE-7',
    batch: 'APR26',
    species: 'ALDER',
    mesh,
    cohort: 'C1',
    loaded_mass: loaded,
    recovery: measurement(ratio * loaded),
    ...overrides
  };
}

function stage(time, level, datumOffset = 0, valid = true) {
  return { time, level, datum_offset: datumOffset, valid };
}

function baseline() {
  const deployment = '2026-04-01T00:00:00+00:00';
  const retrieval = '2026-04-01T02:00:00+00:00';
  return {
    id: 'willow-bend-april',
    title: 'Willow Bend · April recovery',
    case: 'baseline',
    datum: 'WB-LOCAL',
    elevation_precision: 0.01,
    gap_limit_minutes: 61,
    anchors: [
      { id: 'A1', x: 14, bed_elevation: 1 },
      { id: 'A2', x: 37, bed_elevation: 0.9 },
      { id: 'A3', x: 71, bed_elevation: 1.1 }
    ],
    bags: [
      bag('A1-C', 'A1', 'coarse', 4, 1, deployment, retrieval),
      bag('A1-F', 'A1', 'fine', 5.6, 1, deployment, retrieval),
      bag('A2-C', 'A2', 'coarse', 6.4, 0.9, deployment, retrieval),
      bag('A2-F', 'A2', 'fine', 4.8, 0.9, deployment, retrieval),
      bag('A3-C', 'A3', 'coarse', 3.2, 1.1, deployment, retrieval),
      bag('A3-F', 'A3', 'fine', 3.2, 1.1, deployment, retrieval)
    ],
    controls: [
      control('CTRL-C1', 'coarse'),
      control('CTRL-F1', 'fine')
    ],
    stage: [
      stage('2026-04-01T00:00:00+00:00', 1.4),
      stage('2026-04-01T01:00:00+00:00', 1.4),
      stage('2026-04-01T02:00:00+00:00', 1.4)
    ]
  };
}

function windows(study, deployment, retrieval) {
  study.bags.forEach((item) => {
    item.deployment = deployment;
    item.retrieval = retrieval;
  });
}

function buildCase(name) {
  const study = baseline();
  study.case = name;

  if (name === 'datum-offset') {
    study.stage = [
      stage('2026-04-01T00:00:00+00:00', 0.9, 0.3),
      stage('2026-04-01T01:00:00+00:00', 0.9, 0.3),
      stage('2026-04-01T02:00:00+00:00', 0.9, 0.3)
    ];
  } else if (name === 'duplicate-conflict') {
    study.stage = [
      stage('2026-04-01T00:00:00+00:00', 1.4),
      stage('2026-04-01T01:00:00+00:00', 0.7),
      stage('2026-04-01T01:00:00+00:00', 1.5),
      stage('2026-04-01T02:00:00+00:00', 1.4)
    ];
  } else if (name === 'gap-equality') {
    study.gap_limit_minutes = 60;
    windows(study, '2026-04-01T00:00:00+00:00', '2026-04-01T01:00:00+00:00');
    study.stage = [
      stage('2026-04-01T00:00:00+00:00', 1.4),
      stage('2026-04-01T01:00:00+00:00', 1.4)
    ];
  } else if (name === 'crossing') {
    windows(study, '2026-04-01T00:00:00+00:00', '2026-04-01T01:00:00+00:00');
    study.bags.forEach((item) => { item.threshold = 1; });
    study.stage = [
      stage('2026-04-01T00:00:00+00:00', 0.8),
      stage('2026-04-01T01:00:00+00:00', 1.2)
    ];
  } else if (name === 'window-clip') {
    windows(study, '2026-04-01T00:15:00+00:00', '2026-04-01T00:45:00+00:00');
    study.stage = [
      stage('2026-04-01T00:00:00+00:00', 1.4),
      stage('2026-04-01T01:00:00+00:00', 1.4)
    ];
  } else if (name === 'no-bracket') {
    windows(study, '2026-04-01T00:00:00+00:00', '2026-04-01T01:00:00+00:00');
    study.stage = [
      stage('2026-04-01T00:10:00+00:00', 1.4),
      stage('2026-04-01T01:00:00+00:00', 1.4)
    ];
  } else if (name === 'sum-round') {
    windows(study, '2026-04-01T00:00:00+00:00', '2026-04-01T01:00:00+00:00');
    study.bags.forEach((item) => { item.threshold = 1; });
    study.stage = [
      stage('2026-04-01T00:00:00+00:00', 0.9),
      stage('2026-04-01T00:17:00+00:00', 1.2),
      stage('2026-04-01T00:41:00+00:00', 0.8),
      stage('2026-04-01T01:00:00+00:00', 1.3)
    ];
  } else if (name === 'tare-ash') {
    study.bags[0].recovery = { dry_gross: 8.7, dry_tare: 1.7, ash_gross: 3.4, ash_tare: 1.4 };
  } else if (name === 'ash-exceeds') {
    study.bags[0].recovery = { dry_gross: 3, dry_tare: 1, ash_gross: 4, ash_tare: 1 };
  } else if (name === 'nonpositive-initial') {
    study.controls[0].loaded_mass = 0;
  } else if (name === 'cohort-key') {
    study.controls.push(control('CTRL-C-WRONG', 'coarse', 0.2, 10, { cohort: 'OTHER' }));
  } else if (name === 'batch-key') {
    study.controls.push(control('CTRL-C-WRONG-BATCH', 'coarse', 0.2, 10, { batch: 'MAY26' }));
  } else if (name === 'mesh-key') {
    study.controls.push(control('CTRL-F-WRONG', 'fine', 0.2));
  } else if (name === 'mean-ratios') {
    study.controls = [
      control('CTRL-C-SMALL', 'coarse', 0.5, 2),
      control('CTRL-C-LARGE', 'coarse', 0.9, 18),
      control('CTRL-F1', 'fine', 0.8, 10)
    ];
  } else if (name === 'disturbed') {
    study.bags[0].disposition = 'disturbed';
  } else if (name === 'lost') {
    study.bags[0].disposition = 'lost';
    study.bags[0].recovery = null;
  } else if (name === 'missing-control') {
    study.controls = study.controls.filter((item) => item.mesh !== 'coarse');
  } else if (name === 'reordered-bags') {
    study.bags = [0, 2, 1, 3, 5, 4].map((index) => study.bags[index]);
  } else if (name === 'elevation-precision') {
    study.bags[1].elevation = 1.004;
  } else if (name === 'timezone-window') {
    study.bags[1].deployment = '2026-03-31T20:00:00-04:00';
    study.bags[1].retrieval = '2026-03-31T22:00:00-04:00';
  } else if (name === 'pair-mismatch') {
    study.bags[1].species = 'MAPLE';
  } else if (name === 'missing-mate') {
    study.bags = study.bags.filter((item) => item.id !== 'A1-F');
  } else if (name === 'equal-weight') {
    study.bags[0].loaded_mass = 2;
    study.bags[1].loaded_mass = 2;
    study.bags[0].recovery = measurement(0.32);
    study.bags[1].recovery = measurement(1.28);
    study.bags[2].loaded_mass = 20;
    study.bags[3].loaded_mass = 20;
    study.bags[2].recovery = measurement(12.8);
    study.bags[3].recovery = measurement(6.4);
    study.bags = study.bags.slice(0, 4);
    study.anchors = study.anchors.slice(0, 2);
  } else if (name === 'negative') {
    study.bags = study.bags.slice(0, 2);
    study.anchors = study.anchors.slice(0, 1);
    study.bags[0].recovery = measurement(6.4);
    study.bags[1].recovery = measurement(4);
  } else if (name === 'filter-keep') {
    study.bags[0].disposition = 'disturbed';
    study.bags[1].disposition = 'disturbed';
  } else if (name === 'pre-gap-outside') {
    study.stage = [
      stage('2026-03-31T21:00:00+00:00', 1.4),
      stage('2026-03-31T23:00:00+00:00', 1.4),
      stage('2026-04-01T00:00:00+00:00', 1.4),
      stage('2026-04-01T01:00:00+00:00', 1.4),
      stage('2026-04-01T02:00:00+00:00', 1.4)
    ];
  } else if (name === 'invalid-outside') {
    windows(study, '2026-04-01T00:00:00+00:00', '2026-04-01T01:00:00+00:00');
    study.bags.forEach((item) => { item.threshold = 1; });
    study.stage = [
      stage('2026-03-31T23:30:00+00:00', 0.4, 0, false),
      stage('2026-04-01T00:00:00+00:00', 0.8),
      stage('2026-04-01T01:00:00+00:00', 1.2)
    ];
  } else if (name === 'invalid-inside') {
    windows(study, '2026-04-01T00:00:00+00:00', '2026-04-01T01:00:00+00:00');
    study.bags.forEach((item) => { item.threshold = 1; });
    study.stage = [
      stage('2026-04-01T00:00:00+00:00', 0.8),
      stage('2026-04-01T00:30:00+00:00', 1.0, 0, false),
      stage('2026-04-01T01:00:00+00:00', 1.2)
    ];
  } else if (name === 'gap-inside') {
    study.gap_limit_minutes = 60;
    windows(study, '2026-04-01T00:00:00+00:00', '2026-04-01T01:30:00+00:00');
    study.stage = [
      stage('2026-04-01T00:00:00+00:00', 1.4),
      stage('2026-04-01T01:30:00+00:00', 1.4)
    ];
  } else if (name === 'invalid-control') {
    study.controls.push({
      ...control('CTRL-C-BAD', 'coarse'),
      recovery: { dry_gross: 2, dry_tare: 1, ash_gross: 4, ash_tare: 1 }
    });
  } else if (name === 'duplicate-control') {
    study.controls = [
      control('CTRL-C-SMALL', 'coarse', 0.5, 2),
      control('CTRL-C-LARGE', 'coarse', 0.9, 18),
      control('CTRL-C-SMALL', 'coarse', 0.5, 2),
      control('CTRL-F1', 'fine', 0.8, 10)
    ];
  } else if (name === 'conflicting-control') {
    study.controls = [
      control('CTRL-C-CONFLICT', 'coarse', 0.5, 10),
      control('CTRL-C-CONFLICT', 'coarse', 0.9, 10),
      control('CTRL-C-GOOD', 'coarse', 0.8, 10),
      control('CTRL-F1', 'fine', 0.8, 10)
    ];
  } else if (name === 'cross-key-conflict') {
    study.controls = [
      control('CTRL-C-SHARED', 'coarse', 0.8, 10),
      control('CTRL-C-SHARED', 'coarse', 0.2, 10, { batch: 'MAY26' }),
      control('CTRL-C-GOOD', 'coarse', 0.9, 10),
      control('CTRL-F1', 'fine', 0.8, 10)
    ];
  } else if (name === 'same-bag-id') {
    study.bags[1].id = study.bags[0].id;
  } else if (name === 'replicate-reused') {
    study.bags[2].replicate = 'A1';
    study.bags[3].replicate = 'A1';
  } else if (name === 'lost-stale') {
    study.bags[0].disposition = 'lost';
  }

  return study;
}

const caseNames = [
  'baseline', 'datum-offset', 'duplicate-conflict', 'gap-equality', 'crossing',
  'window-clip', 'no-bracket', 'sum-round', 'tare-ash', 'ash-exceeds',
  'nonpositive-initial', 'cohort-key', 'batch-key', 'mesh-key', 'mean-ratios', 'disturbed',
  'lost', 'missing-control', 'reordered-bags', 'elevation-precision',
  'timezone-window', 'pair-mismatch', 'missing-mate', 'equal-weight', 'negative', 'filter-keep',
  'pre-gap-outside', 'invalid-outside', 'invalid-inside', 'gap-inside',
  'invalid-control', 'duplicate-control', 'conflicting-control', 'cross-key-conflict',
  'same-bag-id', 'replicate-reused', 'lost-stale'
];

const payload = {
  studyId: 'willow-bend-april',
  anchorIds: ['A1', 'A2', 'A3'],
  expected: {
    baselineWetMinutes: 120,
    crossingWetMinutes: 30,
    clippedWetMinutes: 30,
    roundedWetMinutes: 34.7,
    equalWeightMean: 0.1,
    negativeContrast: -0.3
  },
  cases: Object.fromEntries(caseNames.map((name) => [name, clone(buildCase(name))]))
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2));
console.log(`fixture written to ${OUTPUT} with ${caseNames.length} hidden cases`);
console.log('SEED_OK');
