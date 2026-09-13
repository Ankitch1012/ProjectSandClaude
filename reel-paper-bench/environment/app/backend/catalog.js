const MODES = {
  lengthwise: {
    outcomes: [
      { id: 'no-drag', grade: 0, contact: 'close' },
      { id: 'light-drag', grade: 1, contact: 'neutral' },
      { id: 'binding', grade: 0, contact: 'open' },
    ],
    passingGrade: 1,
  },
  upright: {
    outcomes: [
      { id: 'clean-cut', grade: 2, contact: 'neutral' },
      { id: 'ragged-cut', grade: 1, contact: 'open' },
      { id: 'no-cut', grade: 0, contact: 'close' },
    ],
    passingGrade: 1,
  },
};

const STATIONS = [
  { id: 'drive-end', label: 'Drive end', shortLabel: 'D end', adjusters: ['drive'] },
  { id: 'drive-quarter', label: 'Drive quarter', shortLabel: 'D ¼', adjusters: ['nonDrive'] },
  { id: 'center', label: 'Center', shortLabel: 'Center', adjusters: ['drive'] },
  { id: 'non-drive-quarter', label: 'Non-drive quarter', shortLabel: 'ND ¼', adjusters: ['drive'] },
  { id: 'non-drive-end', label: 'Non-drive end', shortLabel: 'ND end', adjusters: ['nonDrive'] },
];

const FIXTURES = [
  {
    id: 'UNIT-A7',
    label: 'Unit A7',
    bladeCount: 7,
    driveSide: 'left',
    adjusterFamily: 'dual-point',
    clickPitchMm: 0.018,
    maxClicks: 3,
    closeDirection: { drive: 'CW', nonDrive: 'CCW' },
    correctionMm: { noDrag: 0.019, binding: 0.021 },
    adjusters: {
      drive: { clickPitchMm: 0.018, maxClicks: 3, closeDirection: 'CW', lastApproach: 'CW', takeupClicks: 0 },
      nonDrive: { clickPitchMm: 0.018, maxClicks: 3, closeDirection: 'CCW', lastApproach: 'CCW', takeupClicks: 0 },
    },
  },
  {
    id: 'UNIT-B5',
    label: 'Unit B5',
    bladeCount: 5,
    driveSide: 'right',
    adjusterFamily: 'dual-point',
    clickPitchMm: 0.025,
    maxClicks: 2,
    closeDirection: { drive: 'CCW', nonDrive: 'CW' },
    correctionMm: { noDrag: 0.071, binding: 0.026 },
    adjusters: {
      drive: { clickPitchMm: 0.025, maxClicks: 2, closeDirection: 'CCW', lastApproach: 'CCW', takeupClicks: 0 },
      nonDrive: { clickPitchMm: 0.025, maxClicks: 2, closeDirection: 'CW', lastApproach: 'CW', takeupClicks: 0 },
    },
  },
  {
    id: 'UNIT-C6',
    label: 'Unit C6',
    bladeCount: 6,
    driveSide: 'left',
    adjusterFamily: 'split-pitch',
    clickPitchMm: 0.012,
    maxClicks: 4,
    closeDirection: { drive: 'CW', nonDrive: 'CCW' },
    correctionMm: { noDrag: 0.025, binding: 0.023 },
    adjusters: {
      drive: { clickPitchMm: 0.012, maxClicks: 4, closeDirection: 'CW', lastApproach: 'CCW', takeupClicks: 1 },
      nonDrive: { clickPitchMm: 0.020, maxClicks: 3, closeDirection: 'CCW', lastApproach: 'CW', takeupClicks: 1 },
    },
  },
];

function fixtureById(id) {
  return FIXTURES.find((fixture) => fixture.id === id);
}

function modeOutcome(mode, outcomeId) {
  return MODES[mode]?.outcomes.find((outcome) => outcome.id === outcomeId);
}

function isAllowed(mode, outcomeId) {
  return Boolean(modeOutcome(mode, outcomeId));
}

function publicFixture(fixture) {
  return { ...fixture, stations: STATIONS };
}

module.exports = {
  FIXTURES,
  MODES,
  STATIONS,
  fixtureById,
  isAllowed,
  modeOutcome,
  publicFixture,
};
