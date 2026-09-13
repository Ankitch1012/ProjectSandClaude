'use strict';

const { buildProof, clearProofCache } = require('./proof');

const JOB_ID = 'atlas-field-guide';
let job;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normaliseState(input) {
  const source = input || {};
  const settings = source.settings || {};
  const pageCount = Number(settings.pageCount) === 8 ? 8 : 16;

  return {
    settings: {
      pageCount,
      binding: settings.binding === 'section-sewn' ? 'section-sewn' : 'saddle',
      sheet: settings.sheet === 'A3' ? 'A3' : 'SRA3',
      orientation: settings.orientation === 'portrait' ? 'portrait' : 'landscape',
      bleed: Math.max(0, Math.min(12, Number(settings.bleed) || 0)),
      fold: settings.fold === 'parallel' ? 'parallel' : 'center'
    },
    assignments: source.assignments && typeof source.assignments === 'object'
      ? clone(source.assignments)
      : {}
  };
}

function createJob() {
  const state = normaliseState({
    settings: {
      pageCount: 16,
      binding: 'saddle',
      sheet: 'SRA3',
      orientation: 'landscape',
      bleed: 3,
      fold: 'center'
    },
    assignments: {}
  });

  return {
    id: JOB_ID,
    name: 'Atlas Field Guide · Issue 12',
    revision: 12,
    state,
    proofSnapshot: buildProof(state),
    lastValidatedRevision: 11,
    releasedRevision: null,
    nextOrdinal: 2,
    operations: [
      {
        id: 'operation-1',
        label: 'Job opened',
        logicalTime: 1,
        ordinal: 1
      }
    ]
  };
}

function resetJob() {
  clearProofCache();
  job = createJob();
  return serialise(job);
}

function serialise(source) {
  return clone({
    id: source.id,
    name: source.name,
    revision: source.revision,
    state: source.state,
    proof: source.proofSnapshot,
    operations: source.operations,
    release: {
      eligible: Boolean(source.lastValidatedRevision),
      validatedRevision: source.lastValidatedRevision,
      releasedRevision: source.releasedRevision
    }
  });
}

function getJob(id) {
  if (!job) {
    resetJob();
  }
  return id === JOB_ID ? serialise(job) : null;
}

function previewJob(id, state) {
  if (id !== JOB_ID) {
    return null;
  }
  const normalised = normaliseState(state);
  return {
    state: normalised,
    proof: buildProof(normalised)
  };
}

function saveJob(id, payload) {
  if (id !== JOB_ID) {
    return { status: 404, body: { error: 'Print job not found.' } };
  }
  if (!job) {
    resetJob();
  }

  const previousRevision = job.revision;
  const nextState = normaliseState(payload.state);
  const previousProof = clone(job.proofSnapshot);
  const operations = Array.isArray(payload.operations) ? payload.operations : [];

  job.state = nextState;
  job.revision += 1;
  job.proofSnapshot = previousProof;
  job.lastValidatedRevision = previousProof.validation.valid ? previousRevision : null;

  operations.forEach((operation, index) => {
    job.operations.push({
      id: `operation-${job.nextOrdinal + index}`,
      label: String(operation.label || 'Proof changed'),
      logicalTime: Number(operation.logicalTime) || previousRevision,
      ordinal: job.nextOrdinal + index
    });
  });
  job.nextOrdinal += operations.length;
  job.operations.sort((left, right) => (
    left.logicalTime - right.logicalTime
    || left.label.localeCompare(right.label)
  ));

  return { status: 200, body: serialise(job) };
}

function releaseJob(id) {
  if (id !== JOB_ID) {
    return { status: 404, body: { error: 'Print job not found.' } };
  }
  if (!job) {
    resetJob();
  }
  if (!job.lastValidatedRevision) {
    return { status: 409, body: { error: 'No validated revision is available for release.' } };
  }

  job.releasedRevision = job.lastValidatedRevision;
  return { status: 200, body: serialise(job) };
}

resetJob();

module.exports = {
  JOB_ID,
  getJob,
  previewJob,
  releaseJob,
  resetJob,
  saveJob
};
